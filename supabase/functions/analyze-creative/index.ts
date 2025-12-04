import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GCS_BUCKET_NAME = Deno.env.get("GCS_BUCKET_NAME");
const GCS_SERVICE_ACCOUNT_KEY = Deno.env.get("GCS_SERVICE_ACCOUNT_KEY");
const MAX_MARKET_MEDIA_ATTACHMENTS = 1500;
const MAX_COMPETITORS_FOR_ANALYSIS = 1500;
const COMPETITOR_LOOKBACK_DAYS = 90;

interface CreativeData {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  image_url?: string;
  video_url?: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_rate: number;
  roas: number;
}

// ============================================================================
// HELPERS: Utilitários
// ============================================================================

function sanitizeKeyword(keyword: string) {
  if (!keyword) return "";
  return keyword.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJWT(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBinary = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey("pkcs8", privateKeyBinary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsignedToken));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${encodedSignature}`;
}

async function getGcsAccessToken() {
  if (!GCS_SERVICE_ACCOUNT_KEY) return null;
  const serviceAccount = JSON.parse(GCS_SERVICE_ACCOUNT_KEY);
  return await getAccessToken(serviceAccount);
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await signJWT(serviceAccount);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }
  const data = await response.json();
  return data.access_token;
}

function extractImageUrlsFromField(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    if (value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => item?.original_image_url || item?.url || item?.image_url)
            .filter((url: string | undefined): url is string => !!url);
        }
      } catch {
        if (value.startsWith("http")) return [value];
      }
    } else if (value.startsWith("http")) {
      return [value];
    }
  } else if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.original_image_url || item?.url || item?.image_url;
      })
      .filter((url: string | undefined): url is string => !!url);
  }
  return [];
}

function extractVideoUrlsFromField(value: any): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    if (value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => typeof item === "string");
        }
      } catch {
        return [];
      }
    }
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  return [];
}

const keywordAssetCache = new Map<
  string,
  {
    images: string[];
    videos: string[];
  }
>();

async function listKeywordAssets(keyword: string) {
  if (!keyword || !GCS_BUCKET_NAME || !GCS_SERVICE_ACCOUNT_KEY) {
    return { images: [] as string[], videos: [] as string[] };
  }
  const sanitized = sanitizeKeyword(keyword);
  if (keywordAssetCache.has(sanitized)) {
    return keywordAssetCache.get(sanitized)!;
  }
  try {
    const accessToken = await getGcsAccessToken();
    if (!accessToken) {
      return { images: [], videos: [] };
    }
    const prefix = `competitor/${sanitized}/`;
    let pageToken = "";
    const images: string[] = [];
    const videos: string[] = [];

    do {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET_NAME}/o`);
      url.searchParams.set("prefix", prefix);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) break;
      const data = await response.json();
      (data.items || []).forEach((item: any) => {
        const objectUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${item.name}`;
        if (item.name.includes("/images/")) {
          images.push(objectUrl);
        } else if (item.name.includes("/videos/")) {
          videos.push(objectUrl);
        }
      });
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    const assets = { images, videos };
    keywordAssetCache.set(sanitized, assets);
    return assets;
  } catch (error) {
    console.warn("⚠️ Falha ao listar assets do bucket:", error);
    return { images: [], videos: [] };
  }
}

function getCompetitorId(record: any) {
  return record?.ad_id || record?.adId || record?.id || record?.adID || Math.random().toString(36).slice(2);
}

async function resolveMediaForCompetitor(record: any, keyword: string) {
  const images = [
    ...extractImageUrlsFromField(record?.image_urls),
    ...extractImageUrlsFromField(record?.gcs_image_urls),
  ];
  const videos = [
    ...extractVideoUrlsFromField(record?.video_url),
    ...extractVideoUrlsFromField(record?.gcs_video_urls),
  ];
  if (keyword) {
    if (images.length === 0) {
      const fallback = await listKeywordAssets(keyword);
      images.push(...fallback.images);
    }
    if (videos.length === 0) {
      const fallback = await listKeywordAssets(keyword);
      videos.push(...fallback.videos);
    }
  }
  return {
    images: Array.from(new Set(images)),
    videos: Array.from(new Set(videos)),
  };
}

// Detectar se URL é de vídeo
function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return (
    urlLower.endsWith(".mp4") ||
    urlLower.endsWith(".mov") ||
    urlLower.endsWith(".m4v") ||
    urlLower.endsWith(".webm") ||
    urlLower.includes(".mp4?") ||
    urlLower.includes(".mov?")
  );
}

// Upload de imagem para Gemini File API
async function uploadImageToGemini(imageUrl: string, apiKey: string): Promise<{ uri: string; mimeType: string }> {
  console.log(`📤 Fazendo upload de imagem para Gemini: ${imageUrl.substring(0, 100)}...`);

  try {
    // 1. Download da imagem
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar imagem: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // 2. Detectar mimeType
    let mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      // Fallback por extensão
      if (imageUrl.toLowerCase().includes(".png")) mimeType = "image/png";
      else if (imageUrl.toLowerCase().includes(".webp")) mimeType = "image/webp";
      else mimeType = "image/jpeg";
    }

    console.log(`✅ Imagem baixada: ${imageBuffer.byteLength} bytes (${mimeType})`);

    // 3. Upload para Gemini File API
    const formData = new FormData();
    const extension = mimeType.split("/")[1] || "jpg";
    formData.append("file", new Blob([imageBuffer], { type: mimeType }), `image.${extension}`);

    const uploadResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Gemini File API error: ${uploadResponse.status} - ${errorText}`);
    }

    const fileData = await uploadResponse.json();
    const fileName = fileData.file?.name;

    if (!fileName) {
      throw new Error("Gemini não retornou nome do arquivo");
    }

    console.log(`✅ Imagem enviada para Gemini: ${fileName}`);

    // 4. Aguardar processamento (ACTIVE state)
    let attempts = 0;
    const maxAttempts = 15; // 15 segundos para imagens (mais rápido que vídeo)

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
        method: "GET",
      });

      const statusData = await statusResponse.json();

      if (statusData.state === "ACTIVE") {
        const geminiUri = statusData.uri;
        console.log(`✅ Imagem processada: ${geminiUri}`);
        return { uri: geminiUri, mimeType };
      }

      if (statusData.state === "FAILED") {
        throw new Error("Gemini falhou ao processar imagem");
      }

      console.log(`⏳ Aguardando processamento de imagem... (${attempts + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error("Timeout ao aguardar processamento da imagem");
  } catch (error) {
    console.error("❌ Erro ao fazer upload de imagem para Gemini:", error);
    throw error;
  }
}

// Upload de vídeo para Gemini File API
async function uploadVideoToGemini(videoUrl: string, apiKey: string): Promise<string> {
  console.log(`📤 Fazendo upload de vídeo para Gemini: ${videoUrl.substring(0, 100)}...`);

  try {
    // 1. Download do vídeo do GCS
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Falha ao baixar vídeo: ${videoResponse.status}`);
    }
    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();

    console.log(`✅ Vídeo baixado: ${videoBuffer.byteLength} bytes`);

    // 2. Upload para Gemini File API
    const formData = new FormData();
    formData.append("file", new Blob([videoBuffer], { type: "video/mp4" }), "video.mp4");

    const uploadResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Gemini File API error: ${uploadResponse.status} - ${errorText}`);
    }

    const fileData = await uploadResponse.json();
    const fileName = fileData.file?.name;

    if (!fileName) {
      throw new Error("Gemini não retornou nome do arquivo");
    }

    console.log(`✅ Vídeo enviado para Gemini: ${fileName}`);

    // 3. Aguardar processamento do vídeo (estado PROCESSING → ACTIVE)
    let attempts = 0;
    const maxAttempts = 30; // 30 segundos máximo

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
        method: "GET",
      });

      const statusData = await statusResponse.json();

      if (statusData.state === "ACTIVE") {
        const geminiUri = statusData.uri;
        console.log(`✅ Vídeo processado e pronto: ${geminiUri}`);
        return geminiUri;
      }

      if (statusData.state === "FAILED") {
        throw new Error("Gemini falhou ao processar vídeo");
      }

      console.log(`⏳ Aguardando processamento... (${attempts + 1}/${maxAttempts}) - Estado: ${statusData.state}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error("Timeout ao aguardar processamento do vídeo");
  } catch (error) {
    console.error("❌ Erro ao fazer upload de vídeo para Gemini:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();

    // Detectar se é análise individual ou em grupo
    console.log("🔀 Detectando tipo de análise:", {
      hasCreatives: !!requestBody.creatives,
      hasAnalysisType: !!requestBody.analysisType,
      hasAdName: !!requestBody.ad_name,
      allKeys: Object.keys(requestBody),
    });

    if (requestBody.creatives && requestBody.analysisType) {
      // Análise em grupo (TopCreativesList)
      console.log("📊 Roteando para handleGroupAnalysis");
      return await handleGroupAnalysis(requestBody);
    } else if (requestBody.ad_name) {
      // Análise individual (MetaAdsGrid) - mais específico
      console.log("🎯 Roteando para handleIndividualAnalysis");
      return await handleIndividualAnalysis(requestBody);
    } else {
      // Erro: tipo desconhecido
      console.error("❌ Tipo de análise desconhecido:", Object.keys(requestBody));
      throw new Error('Tipo de análise não reconhecido. Forneça "creatives + analysisType" ou "ad_name"');
    }
  } catch (error) {
    console.error("❌ Erro na função analyze-creative:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido na análise",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// ============================================================================
// ANÁLISE INDIVIDUAL
// ============================================================================
async function handleIndividualAnalysis(requestBody: any) {
  const {
    ad_name,
    campaign_name,
    metrics,
    image_url: imageUrl,
    video_url: videoUrl,
    all_ads_metrics: allAdsMetrics,
    selected_metrics: selectedMetrics,
    competitor_keyword: competitorKeyword,
  } = requestBody;

  const normalizedCompetitorKeyword =
    typeof competitorKeyword === "string" ? competitorKeyword.trim().toLowerCase() : "";

  console.log("🔍 Análise individual iniciada - Modo dual: Performance + Market Trends");

  const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY não encontrada");
  }

  // Inicializar Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Calcular performance vs média
  const performanceComparison: Record<string, { current: number; average: number; percentile: number }> = {};

  if (allAdsMetrics && allAdsMetrics.length > 0 && selectedMetrics && selectedMetrics.length > 0) {
    selectedMetrics.forEach((metricKey: string) => {
      const validValues = allAdsMetrics
        .map((ad: any) => Number(ad.metrics?.[metricKey] || 0))
        .filter((v: number) => !isNaN(v) && v > 0);

      if (validValues.length > 0) {
        const sum = validValues.reduce((acc: number, val: number) => acc + val, 0);
        const avg = sum / validValues.length;

        const currentValue = Number(metrics?.[metricKey] || 0);
        const percentile = (currentValue / avg) * 100;

        performanceComparison[metricKey] = {
          current: currentValue,
          average: avg,
          percentile: Math.round(percentile),
        };
      }
    });
  }

  // Performance geral
  const overallPerformance =
    Object.values(performanceComparison).length > 0
      ? Object.values(performanceComparison).reduce((acc, val) => acc + val.percentile, 0) /
        Object.values(performanceComparison).length
      : 100;

  console.log(`🎯 Performance geral: ${overallPerformance.toFixed(1)}% da média`);

  // Carregar TODOS os competidores se keyword fornecido
  let allCompetitors: any[] = [];

  if (normalizedCompetitorKeyword) {
    console.log(
      `🔍 Carregando TODOS os competidores para keyword normalizada: "${normalizedCompetitorKeyword}"`,
    );

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - COMPETITOR_LOOKBACK_DAYS);

    const { data: competitorData, error: competitorError } = await supabase
      .from("competitor_ads_cache")
      .select("*")
      .eq("search_keyword", normalizedCompetitorKeyword)
      .eq("is_active", true)
      .gte("scraped_at", ninetyDaysAgo.toISOString())
      .order("scraped_at", { ascending: false })
      .limit(MAX_COMPETITORS_FOR_ANALYSIS);

    if (competitorError) {
      console.error("❌ Erro ao carregar competidores:", competitorError);
    } else {
      allCompetitors = competitorData || [];
      console.log(`✅ ${allCompetitors.length} anúncios competitivos carregados`);

      // DEBUG: Mostrar estrutura do primeiro competidor
      if (allCompetitors.length > 0) {
        console.log("📝 Estrutura do primeiro competidor:", {
          page_name: allCompetitors[0].page_name,
          has_image_urls: !!allCompetitors[0].image_urls,
          image_urls_count: allCompetitors[0].image_urls?.length || 0,
          has_video_urls: !!allCompetitors[0].video_urls,
          video_urls_count: allCompetitors[0].video_urls?.length || 0,
          ad_format: allCompetitors[0].ad_format,
          search_keyword: allCompetitors[0].search_keyword,
        });
      } else {
        console.warn("⚠️ NENHUM competidor encontrado. Possíveis causas:");
        console.warn(`   - Keyword "${normalizedCompetitorKeyword}" não existe na tabela`);
        console.warn(`   - Campo is_active = false para todos`);
        console.warn(`   - Tabela competitor_ads_cache está vazia`);
      }
    }
  }
  const competitorMediaMap = new Map<string, { images: string[]; videos: string[] }>();
  const keywordForAssets = normalizedCompetitorKeyword || (allCompetitors[0]?.search_keyword ?? "");
  for (const competitor of allCompetitors) {
    const media = await resolveMediaForCompetitor(competitor, keywordForAssets);
    competitorMediaMap.set(getCompetitorId(competitor), media);
  }

  // ANÁLISE 1: Performance Criativa (SEMPRE executa)
  console.log("📊 Gerando análise de performance...");
  const performanceAnalysis = await generatePerformanceAnalysis({
    ad_name,
    campaign_name,
    metrics,
    imageUrl,
    videoUrl,
    allAdsMetrics,
    selectedMetrics,
    performanceComparison,
    overallPerformance,
    GEMINI_API_KEY,
  });

  // ANÁLISE 2: Tendências de Mercado (SOMENTE se competidores >= 10)
  let marketTrendsAnalysis = null;
  if (normalizedCompetitorKeyword && allCompetitors.length >= 10) {
    console.log("📊 Gerando análise de tendências de mercado...");
    marketTrendsAnalysis = await generateMarketTrendsAnalysis({
      competitorKeyword: normalizedCompetitorKeyword,
      allCompetitors,
      GEMINI_API_KEY,
      competitorMediaMap,
    });
  } else if (normalizedCompetitorKeyword && allCompetitors.length < 10) {
    console.log(`⚠️ Apenas ${allCompetitors.length} competidores - mínimo de 10 necessário para análise de mercado`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      performance_analysis: performanceAnalysis,
      market_trends_analysis: marketTrendsAnalysis,
      metadata: {
        model: "gemini-2.0-flash-exp",
        performance_level:
          overallPerformance >= 110 ? "excellent" : overallPerformance >= 90 ? "good" : "needs_improvement",
        has_market_analysis: !!marketTrendsAnalysis,
        competitors_analyzed: allCompetitors.length,
        has_video_analysis: !!videoUrl,
        has_image_analysis: !!imageUrl,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// ============================================================================
// ANÁLISE DE PERFORMANCE (Primeiro Prompt)
// ============================================================================
async function generatePerformanceAnalysis(params: {
  ad_name: string;
  campaign_name: string;
  metrics: any;
  imageUrl?: string;
  videoUrl?: string;
  allAdsMetrics: any[];
  selectedMetrics: string[];
  performanceComparison: Record<string, any>;
  overallPerformance: number;
  GEMINI_API_KEY: string;
}): Promise<string> {
  const systemPrompt = `Você é um analista de performance criativa. Analise este anúncio com base em dados e contexto, seguindo rigorosamente:

## Análise do Anúncio

**1. Interpretação de Métricas (conectando dados ao design)**
- Explique o que os números revelam sobre o comportamento do usuário
- Relacione CTR/CPC/ROAS aos elementos visuais, copy e CTA específicos
- Evite afirmações genéricas; sempre cite o "porquê" mensurável

**2. Fatores Visuais & Copy (análise causal)**
Avalie:
- Hierarquia visual (o que salta aos olhos primeiro?)
- Contraste e legibilidade (cor de fundo vs. texto/CTA)
- Posição e clareza do CTA (comprimento, ação, urgência)
- Presença de elementos humanos, logos, números (impacto de credibilidade)
- Tom de linguagem (urgência, curiosidade, benefício, etc.)
- Adequação ao formato (vídeo vs. imagem) e plataforma

**3. Comparação com Grupo (quando aplicável)**
- Se performance ≤ média: cite 1 anúncio melhor do grupo e explique a diferença específica (ex: "CTA mais curto em 3 palavras vs. 8 palavras aqui")
- Se performance > média: destaque 2-3 diferenciais que justificam o resultado

---
Seja objetivo. Evite genéricos. Priorize análise sobre descrição.Evite usar asteríscos`;

  const userPrompt = `Analise este criativo:

**CRIATIVO ANALISADO:**
- Nome: ${params.ad_name}
- Campanha: ${params.campaign_name}
- Performance: ${params.overallPerformance.toFixed(1)}% da média

**MÉTRICAS ATUAIS:**
${Object.entries(params.metrics as Record<string, any>)
  .map(([key, value]) => {
    const comparison = params.performanceComparison[key];
    const status = comparison
      ? `(${comparison.percentile}% da média - ${comparison.percentile >= 90 ? "✅" : "🔴"})`
      : "";
    return `- ${key}: ${typeof value === "number" ? value.toFixed(2) : value} ${status}`;
  })
  .join("\n")}

**ANÚNCIOS DO GRUPO (para comparação):**
${params.allAdsMetrics
  .slice(0, 5)
  .map((ad) => `- ${ad.ad_name}: CTR ${ad.metrics?.ctr?.toFixed(2)}%, CPC R$${ad.metrics?.cpc?.toFixed(2)}`)
  .join("\n")}`;

  // Preparar conteúdo para Gemini API
  const contentParts: any[] = [{ text: userPrompt }];

  if (params.imageUrl && params.imageUrl.trim() !== "" && !isVideoUrl(params.imageUrl)) {
    try {
      const { uri, mimeType } = await uploadImageToGemini(params.imageUrl, params.GEMINI_API_KEY);
      contentParts.push({ fileData: { mimeType, fileUri: uri } });
      console.log(`📷 Imagem anexada para análise: ${uri}`);
    } catch (error) {
      console.warn("⚠️ Análise sem imagem:", error);
    }
  }

  if (params.videoUrl && params.videoUrl.trim() !== "") {
    try {
      const geminiVideoUri = await uploadVideoToGemini(params.videoUrl, params.GEMINI_API_KEY);
      contentParts.push({ fileData: { mimeType: "video/mp4", fileUri: geminiVideoUri } });
      console.log(`🎥 Vídeo anexado para análise: ${geminiVideoUri}`);
    } catch (error) {
      console.warn("⚠️ Análise sem vídeo:", error);
    }
  }

  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: contentParts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini error: ${geminiResponse.status} - ${errorText}`);
  }

  const geminiData = await geminiResponse.json();
  return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ============================================================================
// ANÁLISE DE TENDÊNCIAS DE MERCADO (Segundo Prompt)
// ============================================================================
async function generateMarketTrendsAnalysis(params: {
  competitorKeyword: string;
  allCompetitors: any[];
  GEMINI_API_KEY: string;
  competitorMediaMap: Map<string, { images: string[]; videos: string[] }>;
}): Promise<string> {
  const systemPrompt = `Você é um analista de tendências criativas. Analise os criativos do mercado fornecidos (TEXTO + IMAGENS + VÍDEOS) e estruture assim:

## Análise de Tenências do Mercado

**1. Padrões Visuais (ANALISE AS IMAGENS E VÍDEOS FORNECIDOS)**
- Paletas dominantes (cite 2-3 combinações e frequência REAL observada)
- Elementos estruturais recorrentes (botões, posição de CTA, molduras, presença humana)
- Formatos mais comuns (% vídeo vs. imagem estática; dimensões)
- Tipografia (tamanho relativo, peso, efeitos) - BASEADO NAS IMAGENS

**2. Copywriting & Tom (ANALISE O TEXTO DOS ANÚNCIOS)**
- Tipo de apelo dominante: [Urgência | Aspiracional | Técnico | Social Proof | FOMO]
- Frases-chave mais frequentes (cite 3-5 exemplos REAIS encontrados)
- Comprimento médio de CTA (palavras)
- Uso de números, símbolos, pontuação (ênfase)

**3. Estrutura Visual (análise construtiva das IMAGENS/VÍDEOS)**
- Hierarquia visual: onde o olho pousa primeiro? (BASEADO NAS IMAGENS)
- Presença de: pessoas (%) | logos (%) | movimento | contraste alto (%)
- Densidade de informação: [Mínima | Moderada | Alta]
- Evite usar asteríscos 

---
⚠️ CRÍTICO: Cite dados e exemplos específicos DAS IMAGENS E VÍDEOS fornecidos. Evite genéricos. NÃO invente padrões não observados.`;

  // Criar prompt estruturado com marcadores de posição para mídia
  const competitorDetailsWithMedia: string[] = [];
  const mediaAttachmentQueue: Array<{ type: "image" | "video"; url: string; competitorName: string }> = [];
  const seenAssetUrls = new Set<string>();

  for (let i = 0; i < params.allCompetitors.length; i++) {
    const ad = params.allCompetitors[i];
    const media = params.competitorMediaMap.get(getCompetitorId(ad)) || { images: [], videos: [] };
    let details = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Concorrente ${i + 1}: ${ad.page_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    const imageUrls = media.images || [];
    const videoUrls = media.videos || [];

    for (const imageUrl of imageUrls) {
      if (!imageUrl || seenAssetUrls.has(imageUrl) || mediaAttachmentQueue.length >= MAX_MARKET_MEDIA_ATTACHMENTS) {
        continue;
      }
      seenAssetUrls.add(imageUrl);
      mediaAttachmentQueue.push({ type: "image", url: imageUrl, competitorName: ad.page_name });
    }

    for (const videoUrl of videoUrls) {
      if (!videoUrl || seenAssetUrls.has(videoUrl) || mediaAttachmentQueue.length >= MAX_MARKET_MEDIA_ATTACHMENTS) {
        continue;
      }
      seenAssetUrls.add(videoUrl);
      mediaAttachmentQueue.push({ type: "video", url: videoUrl, competitorName: ad.page_name });
    }

    details += `
- Copy: ${ad.ad_copy?.substring(0, 200) || "N/A"}
- CTA: ${ad.cta_text || "N/A"}
- Formato: ${ad.ad_format || "N/A"}
- Ativo desde: ${ad.started_running_date || "N/A"}
`;

    competitorDetailsWithMedia.push(details);
  }

  const mediaAssetsToUpload = mediaAttachmentQueue.slice(0, MAX_MARKET_MEDIA_ATTACHMENTS);

  const userPrompt = `Analise ${params.allCompetitors.length} criativos do mercado para a keyword "${params.competitorKeyword}" (janela de ${COMPETITOR_LOOKBACK_DAYS} dias).

${mediaAssetsToUpload.length} URLs reais (imagens e vídeos) foram anexadas abaixo para análise visual. Use TODAS as referências disponíveis (máximo ${MAX_MARKET_MEDIA_ATTACHMENTS}).

**DADOS COMPLETOS DE ${params.allCompetitors.length} CONCORRENTES REAIS:**
${competitorDetailsWithMedia.join("\n")}

**INSTRUÇÕES:**
1. Analise TODOS os ${params.allCompetitors.length} anúncios fornecidos
2. Use as IMAGENS e VÍDEOS anexados para análise visual detalhada
3. Identifique padrões com frequência > 30%
4. Use dados quantitativos em TODAS as observações
5. NÃO invente dados - use APENAS o que foi fornecido
6. Cite exemplos específicos (page_name dos concorrentes)
7. Não cite o número do criativo do concorrente, isso é irrelevante para o usuário e poluí a análise, exemplo: Telemax(7, 9 e 11)

**IMPORTANTE:** As imagens e vídeos estão anexados nesta mensagem. Analise TODOS os elementos visuais fornecidos.`;

  const contentParts: any[] = [{ text: userPrompt }];
  let successfulImageUploads = 0;
  let successfulVideoUploads = 0;
  let failedUploads = 0;

  console.log(
    `📸 Iniciando upload de até ${mediaAssetsToUpload.length} mídias (máximo ${MAX_MARKET_MEDIA_ATTACHMENTS})...`,
  );

  for (const asset of mediaAssetsToUpload) {
    if (!asset.url) continue;

    if (asset.type === "image" && !isVideoUrl(asset.url)) {
      try {
        const { uri, mimeType } = await uploadImageToGemini(asset.url, params.GEMINI_API_KEY);
        contentParts.push({ fileData: { mimeType, fileUri: uri } });
        successfulImageUploads++;
        console.log(
          `✅ [IMG ${successfulImageUploads}] Imagem do competidor "${asset.competitorName}" enviada: ${uri.substring(0, 80)}...`,
        );
      } catch (error) {
        failedUploads++;
        console.warn(
          `❌ [IMG] Falha ao processar ativo de "${asset.competitorName}":`,
          error instanceof Error ? error.message : error,
        );
      }
    } else if (asset.type === "video") {
      try {
        const geminiVideoUri = await uploadVideoToGemini(asset.url, params.GEMINI_API_KEY);
        contentParts.push({ fileData: { mimeType: "video/mp4", fileUri: geminiVideoUri } });
        successfulVideoUploads++;
        console.log(
          `✅ [VID ${successfulVideoUploads}] Vídeo do competidor "${asset.competitorName}" enviado: ${geminiVideoUri.substring(0, 80)}...`,
        );
      } catch (error) {
        failedUploads++;
        console.warn(
          `❌ [VID] Erro ao processar vídeo de "${asset.competitorName}":`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (successfulImageUploads + successfulVideoUploads >= MAX_MARKET_MEDIA_ATTACHMENTS) {
      console.log("🎯 Limite máximo de mídias atingido, interrompendo uploads adicionais");
      break;
    }
  }

  console.log(`📊 Resumo dos uploads:
  ✅ Imagens: ${successfulImageUploads}
  ✅ Vídeos: ${successfulVideoUploads}
  ❌ Falhas: ${failedUploads}
  🎯 Mídias solicitadas: ${mediaAssetsToUpload.length}`);

  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: contentParts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini error: ${geminiResponse.status} - ${errorText}`);
  }

  const geminiData = await geminiResponse.json();
  let analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Validar se análise menciona dados visuais
  if (successfulImageUploads + successfulVideoUploads > 0) {
    const hasVisualAnalysis = /paleta|cor|tipografia|hierarquia visual|elemento visual/i.test(analysisText);
    if (!hasVisualAnalysis) {
      console.warn("⚠️ Análise não menciona elementos visuais apesar de imagens terem sido enviadas!");
    }
  }

  console.log(`✅ Análise de mercado gerada com ${analysisText.length} caracteres`);

  return analysisText;
}

// ============================================================================
// CÓDIGO LEGADO REMOVIDO
// ============================================================================
// A lógica antiga foi refatorada e movida para:
// - generatePerformanceAnalysis() (análise de performance individual)
// - generateMarketTrendsAnalysis() (análise de tendências de mercado)

// ============================================================================
// ANÁLISE DE GRUPO
// ============================================================================
async function handleGroupAnalysis(requestBody: any) {
  const {
    creatives,
    analysisType,
    primaryMetric,
    secondaryMetric,
    competitor_keyword: competitorKeyword,
  } = requestBody;

  const normalizedCompetitorKeyword =
    typeof competitorKeyword === "string" ? competitorKeyword.trim().toLowerCase() : "";

  console.log(`🔍 Análise de grupo iniciada: ${analysisType}`);
  console.log(`📊 ${creatives.length} criativos para análise`);

  const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY não encontrada");
  }

  // Inicializar Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Para worst performers, carregar TODOS os competidores
  let allCompetitors: any[] = [];

  if (analysisType === "worst" && normalizedCompetitorKeyword) {
    console.log(`🔍 Carregando competidores para análise de worst performers...`);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - COMPETITOR_LOOKBACK_DAYS);

    const { data: competitorData, error: competitorError } = await supabase
      .from("competitor_ads_cache")
      .select("*")
      .eq("search_keyword", normalizedCompetitorKeyword)
      .eq("is_active", true)
      .gte("scraped_at", ninetyDaysAgo.toISOString())
      .order("scraped_at", { ascending: false })
      .limit(MAX_COMPETITORS_FOR_ANALYSIS);

    if (competitorError) {
      console.error("❌ Erro ao carregar competidores:", competitorError);
    } else {
      allCompetitors = competitorData || [];
      console.log(`✅ ${allCompetitors.length} anúncios competitivos carregados para comparação`);
    }
  }

  const dataValidationRules = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 REGRAS ABSOLUTAS DE VALIDAÇÃO DE DADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PERMITIDO:
- Descrever elementos presentes nos criativos fornecidos
- Calcular frequências baseadas nos dados reais
- Citar page_name de concorrentes quando fornecidos

❌ PROIBIDO:
- Inventar padrões não observados
- Especular sem base nos dados
- Citar concorrentes não fornecidos
`;

  let systemPrompt = "";
  let userPrompt = "";

  if (analysisType === "top") {
    // TOP PERFORMERS: Identificar padrões internos de sucesso
    systemPrompt = `${dataValidationRules}

Você é um especialista em análise de criativos de anúncios digitais.

🎯 OBJETIVO:
Identificar PADRÕES COMUNS entre os ${creatives.length} criativos de MELHOR performance.

📋 TAREFAS:
1. Elementos visuais presentes em TODOS ou MAIORIA
2. Características de copy compartilhadas
3. Estrutura criativa similar
4. Métricas em comum (alto CTR + baixo CPC, etc)

EXPLIQUE:
- POR QUE esses elementos geram resultados
- Como replicar esses sucessos
- Quais princípios estão sendo aplicados

🚨 IMPORTANTE:
- NÃO mencione concorrentes
- Foque nos padrões INTERNOS de sucesso
- Seja específico sobre elementos observados
`;

    const creativesDetails = creatives
      .map(
        (c: any, i: number) => `
Criativo ${i + 1}: ${c.ad_name}
- Campanha: ${c.campaign_name}
- CTR: ${c.ctr?.toFixed(2)}%
- CPC: R$ ${c.cpc?.toFixed(2)}
- ROAS: ${c.roas?.toFixed(2)}x
- Conversões: ${c.conversions}
${c.image_url ? `- Imagem: ${c.image_url}` : ""}
${c.video_url ? `- Vídeo: ${c.video_url}` : ""}
`,
      )
      .join("\n");

    userPrompt = `Analise ${creatives.length} criativos de MELHOR performance:

**CRIATIVOS:**
${creativesDetails}

**MÉTRICAS ANALISADAS:**
- Primária: ${primaryMetric}
- Secundária: ${secondaryMetric}

**INSTRUÇÕES:**
1. Identifique elementos comuns entre os criativos
2. Explique por que esses elementos geram sucesso
3. Recomende como replicar esses padrões
4. Baseie-se APENAS nos ${creatives.length} criativos fornecidos
`;
  } else {
    // WORST PERFORMERS: Comparar com mercado
    systemPrompt = `${dataValidationRules}

Você é um especialista em análise de criativos com foco em INTELIGÊNCIA DE MERCADO.

🎯 OBJETIVO:
Identificar O QUE FALTA nos ${creatives.length} criativos de BAIXA performance comparado aos ${allCompetitors.length} concorrentes do mercado.

📋 TAREFAS:
1. Elementos presentes nos concorrentes mas AUSENTES nos criativos analisados
2. Diferenças de estrutura, cores, copy, formato
3. Gaps de mercado (o que todos os concorrentes fazem mas você não)

ANÁLISE QUANTITATIVA:
- ${allCompetitors.length} concorrentes analisados
- Padrões com frequência > 30% são TENDÊNCIAS
- Citar números exatos em cada insight

🚨 REGRAS:
- Baseie-se APENAS nos dados fornecidos
- Use dados quantitativos
- Não precisa referênciar o número da imagem(ex: imagem 15-35 e imagem 14,17,20)
- Cite page_name dos concorrentes
`;

    const creativesDetails = creatives
      .map(
        (c: any, i: number) => `
Criativo ${i + 1}: ${c.ad_name}
- CTR: ${c.ctr?.toFixed(2)}%
- CPC: R$ ${c.cpc?.toFixed(2)}
- ROAS: ${c.roas?.toFixed(2)}x
${c.image_url ? `- Imagem: ${c.image_url}` : ""}
`,
      )
      .join("\n");

    const competitorDetails = allCompetitors
      .slice(0, 50)
      .map(
        (ad, i) => `
Concorrente ${i + 1}: ${ad.page_name}
- Copy: ${ad.ad_copy?.substring(0, 150) || "N/A"}
- CTA: ${ad.cta_text || "N/A"}
- Formato: ${ad.ad_format || "N/A"}
`,
      )
      .join("\n");

    userPrompt = `Analise ${creatives.length} criativos de BAIXA performance vs ${allCompetitors.length} concorrentes:

**CRIATIVOS ANALISADOS (baixa performance):**
${creativesDetails}

**${allCompetitors.length} CONCORRENTES DO MERCADO:**
${competitorDetails}

**INSTRUÇÕES:**
1. Compare criativos com concorrentes
2. Identifique gaps (o que falta)
3. Use dados quantitativos
4. Recomende melhorias específicas
`;
  }

  // Preparar mídia para Gemini
  const contentParts: any[] = [{ text: userPrompt }];

  // Adicionar imagens/vídeos dos criativos
  for (const creative of creatives.slice(0, 10)) {
    // Limitar a 10 para não sobrecarregar
    if (creative.image_url && creative.image_url.trim() !== "" && !isVideoUrl(creative.image_url)) {
      // Para imagens, fazer upload para Gemini File API
      try {
        const { uri, mimeType } = await uploadImageToGemini(creative.image_url, GEMINI_API_KEY);
        contentParts.push({
          fileData: {
            mimeType,
            fileUri: uri,
          },
        });
        console.log(`📷 Imagem ${creative.ad_name} enviada: ${uri}`);
      } catch (error) {
        console.warn(
          `⚠️ Não foi possível processar imagem de ${creative.ad_name}: ${error instanceof Error ? error.message : "erro"}`,
        );
        // Continua com os outros criativos
      }
    }
    if (creative.video_url && creative.video_url.trim() !== "") {
      // Para vídeos, fazer upload para Gemini File API
      try {
        const geminiVideoUri = await uploadVideoToGemini(creative.video_url, GEMINI_API_KEY);
        contentParts.push({
          fileData: {
            mimeType: "video/mp4",
            fileUri: geminiVideoUri,
          },
        });
        console.log(`🎥 Vídeo ${creative.ad_name} enviado: ${geminiVideoUri}`);
      } catch (error) {
        console.warn(
          `⚠️ Não foi possível processar vídeo de ${creative.ad_name}: ${error instanceof Error ? error.message : "erro"}`,
        );
        // Continua com os outros criativos
      }
    }
  }

  // Chamar Gemini
  const geminiPayload = {
    contents: [
      {
        role: "user",
        parts: contentParts,
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  console.log("🤖 Chamando Gemini 2.5 Flash para análise de grupo...");

  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(geminiPayload),
    },
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    let errorMessage = `Erro ${geminiResponse.status}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      errorMessage = errorText.substring(0, 200);
    }

    console.error("❌ Erro Gemini API:", geminiResponse.status, errorText);
    throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorMessage}`);
  }

  const geminiData = await geminiResponse.json();
  const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("✅ Análise de grupo gerada com sucesso");

  return new Response(
    JSON.stringify({
      success: true,
      performance_analysis: analysisText, // ✅ Novo formato consistente
      market_trends_analysis: null, // ✅ Adicionar campo
      metadata: {
        model: "gemini-2.0-flash-exp",
        analysis_type: analysisType,
        creatives_count: creatives.length,
        competitors_analyzed: allCompetitors.length,
        primary_metric: primaryMetric,
        secondary_metric: secondaryMetric,
        has_market_analysis: false,
        is_group_analysis: true, // ✅ Indicar que é análise de grupo
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// ============================================================================
// VALIDAÇÃO DE ANÁLISE
// ============================================================================
function validateAnalysis(analysis: string, competitorData: any[]): boolean {
  const analysisLower = analysis.toLowerCase();

  // Padrões suspeitos de dados fictícios
  const suspiciousPatterns = [
    /nike|adidas|coca-cola|apple|samsung|facebook|instagram(?! ads)/i,
    /segundo pesquisas|estudos mostram|análises indicam/i,
    /baseado em tendências globais|padrões do setor/i,
    /de acordo com especialistas|segundo dados de mercado/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(analysis)) {
      console.warn("⚠️ Análise contém padrões suspeitos:", pattern);
      return false;
    }
  }

  // Se mencionou concorrentes, verificar se são reais
  if (competitorData.length > 0) {
    const providedPageNames = competitorData.map((c) => c.page_name?.toLowerCase()).filter(Boolean);

    // Verificar se análise menciona concorrentes não fornecidos
    // (isso seria mais complexo, por agora apenas log)
    console.log("✅ Validação básica passou");
  }

  return true;
}
