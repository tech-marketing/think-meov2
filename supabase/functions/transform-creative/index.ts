import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransformRequest {
  adId: string;
  accountId: string;
  targetFormat: 'carousel' | 'static' | 'video';
  sourceFormat: 'video' | 'carousel' | 'static';
  projectId: string;
  carouselSlides?: number;
  adData?: {
    ad_name?: string;
    ad_copy?: string;
    message?: string;
    call_to_action?: string;
    headline?: string;
    link_url?: string;
    image_url?: string;
    video_url?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Profile not found');
    }

    const body: TransformRequest = await req.json();
    const { adId, accountId, targetFormat, sourceFormat, projectId, adData, carouselSlides } = body;

    console.log(`Transforming creative ${adId} from ${sourceFormat} to ${targetFormat}`);
    console.log(`Ad data provided in request: ${adData ? 'Yes' : 'No'}`);
    if (targetFormat === 'carousel') {
      console.log(`Carousel slides requested: ${carouselSlides || 4}`);
    }

    // Buscar projeto para obter o company_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, company_id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project fetch error:', projectError);
      throw new Error('Project not found');
    }

    if (!project.company_id) {
      throw new Error('Project has no company assigned');
    }

    console.log(`Using company_id from project: ${project.company_id}`);

    // Buscar account name para verificar se é Mandic
    let accountName = '';
    if (accountId) {
      const { data: accountData } = await supabase
        .from('meta_ad_accounts')
        .select('account_name')
        .eq('account_id', accountId)
        .maybeSingle();
      
      accountName = accountData?.account_name || '';
      console.log(`Account name: ${accountName}`);
    }

    // Usar dados do anúncio fornecidos ou buscar do banco
    let ad: any;
    
    if (adData) {
      console.log(`Using ad data from request`);
      ad = {
        ad_id: adId,
        ad_name: adData.ad_name,
        ad_copy: adData.ad_copy,
        message: adData.message,
        call_to_action: adData.call_to_action,
        headline: adData.headline,
        link_url: adData.link_url,
        image_url: adData.image_url,
        video_url: adData.video_url
      };
    } else {
      console.log(`Looking for ad in database with adId: ${adId}, accountId: ${accountId}`);
      
      const { data: dbAd, error: adError } = await supabase
        .from('meta_ads')
        .select('*')
        .eq('ad_id', adId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (adError) {
        console.error('Error fetching ad:', adError);
        throw new Error(`Database error: ${adError.message}`);
      }

      if (!dbAd) {
        console.error(`Ad not found in meta_ads table. adId: ${adId}, accountId: ${accountId}`);
        throw new Error(`Ad ${adId} not found in database. Please provide ad data or sync Meta data first.`);
      }

      ad = dbAd;
    }

    console.log(`Using ad: ${ad.ad_name || adId}`);

    // Buscar análise criativa existente (incluindo tendências de mercado e insights competitivos)
    const { data: analysis } = await supabase
      .from('ai_creative_analysis')
      .select('*, visual_analysis, performance_insights, recommendations')
      .eq('ad_id', adId)
      .eq('account_id', accountId)
      .maybeSingle();

    console.log(`Analysis found: ${analysis ? 'Yes' : 'No'}`);

    // ============ EXTRAIR DNA DO CRIATIVO PARA REPLICAÇÃO FIEL ============
    console.log('🧬 Extraindo DNA do criativo original...');
    const mediaUrl = ad.image_url || ad.video_url || ad.thumbnail_url;
    const adCopy = ad.ad_copy || ad.message || ad.headline || '';
    
    let creativeDNA = null;
    try {
      creativeDNA = await extractCreativeDNA(mediaUrl, adCopy, geminiApiKey);
      if (creativeDNA) {
        console.log('✅ DNA extraído com sucesso');
        console.log('  - Cores:', creativeDNA.colors.length);
        console.log('  - Tokens críticos:', creativeDNA.criticalTokens);
        console.log('  - Persona:', creativeDNA.persona || 'Nenhuma');
      }
    } catch (error) {
      console.error('⚠️ Erro ao extrair DNA, continuando sem DNA:', error);
    }

    // Construir prompt baseado no formato alvo COM DNA
    const prompt = buildPrompt(targetFormat, sourceFormat, ad, analysis, accountName, carouselSlides, creativeDNA);

    // Usar tool calling para forçar estrutura JSON válida
    const tools = [{
      functionDeclarations: [{
        name: "create_transformation",
        description: "Create the creative transformation with structured data",
        parameters: getResponseSchema(targetFormat)
      }]
    }];

    // Montar partes com mídia
    const originalMediaUrl = ad.image_url || ad.video_url || null;
    let mediaPart: any = null;

    if (originalMediaUrl) {
      const inlineData = await fetchMediaAsBase64(originalMediaUrl);
      mediaPart = {
        inlineData: {
          mimeType: originalMediaUrl.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
          data: inlineData
        }
      };
    }

    const partsArray: any[] = [{ text: prompt }];
    if (mediaPart) partsArray.push(mediaPart);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: partsArray
          }],
          tools: tools,
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["create_transformation"]
            }
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Failed to generate creative transformation');
    }

    const geminiData = await geminiResponse.json();
    
    // Extrair dados do function call
    const functionCall = geminiData.candidates[0].content.parts[0].functionCall;
    
    if (!functionCall || functionCall.name !== 'create_transformation') {
      console.error('No valid function call in response:', JSON.stringify(geminiData).substring(0, 500));
      throw new Error('AI did not return structured data');
    }
    
    const generatedData = functionCall.args;
    console.log('Successfully extracted structured data from function call');

    console.log('3) Geração de dados estruturados com IA concluída');
    console.log('TargetFormat:', targetFormat);
    console.log('GeneratedData keys:', Object.keys(generatedData));
    
    // Verificar se é conta Mandic para validação
    const isMandic: boolean = !!(accountName && (
      accountName.toLowerCase().includes('são leopoldo mandic') ||
      accountName.toLowerCase().includes('mandic') ||
      accountName.toLowerCase().includes('pós-graduação medicina') ||
      accountName.toLowerCase().includes('medicina do sertão')
    ));
    console.log(`✅ Conta Mandic detectada: ${isMandic}`);
    
    // Garantir que sempre há caption
    if (!generatedData.newCaption || generatedData.newCaption.trim() === '') {
      console.warn('⚠️ Caption vazia gerada pela IA, usando fallback');
      generatedData.newCaption = `Criativo transformado para ${formatLabel(targetFormat)} baseado em ${ad.ad_name || ad.message || 'anúncio original'}.`;
    }
    
    // ============ VALIDAÇÕES DE CONTEXTO ============
    console.log('🔍 Aplicando validações de contexto...');
    
    // 1. Parafrasear legenda fielmente se houver DNA
    if (creativeDNA && creativeDNA.criticalTokens.length > 0) {
      const originalCaption = ad.ad_copy || ad.message || '';
      if (originalCaption) {
        console.log('📝 Parafraseando legenda original...');
        generatedData.newCaption = await paraphraseCaptionPTBR(
          originalCaption,
          creativeDNA.criticalTokens,
          isMandic,
          geminiApiKey
        );
      }
    }
    
    // 2. Aplicar validação Mandic e sanitização
    generatedData.newCaption = await enforceMandicAndLanguage(
      generatedData.newCaption,
      'caption',
      isMandic,
      geminiApiKey,
      ad
    );
    
    // 3. Validar tokens críticos na legenda
    if (creativeDNA && creativeDNA.criticalTokens.length > 0) {
      const tokensValid = validateCriticalTokens(generatedData.newCaption, creativeDNA.criticalTokens);
      if (!tokensValid) {
        console.warn('⚠️ Tokens críticos ausentes na legenda gerada');
      } else {
        console.log('✅ Tokens críticos presentes na legenda');
      }
    }
    
    // 4. Validar datas: se DNA não tem datas, gerado não deve ter
    if (creativeDNA) {
      const dnaDates = detectDates(adCopy);
      const generatedDates = detectDates(generatedData.newCaption);
      
      if (dnaDates.length === 0 && generatedDates.length > 0) {
        console.warn('⚠️ Datas detectadas no gerado mas não no original:', generatedDates);
        // Remove datas do gerado
        generatedDates.forEach(date => {
          generatedData.newCaption = generatedData.newCaption.replace(date, '');
        });
      } else {
        console.log('✅ Validação de datas: OK');
      }
    }
    
    console.log('Caption final após validação:', generatedData.newCaption ? `"${generatedData.newCaption.substring(0, 100)}..."` : 'VAZIA');
    console.log('Canvas Data presente:', !!generatedData.canvasData);

    // Gerar canvas JSON baseado no formato
    let canvasData: string;

    if (targetFormat === 'carousel') {
      const slideCount = carouselSlides || 4;
      console.log(`Generating carousel with ${slideCount} slides...`);
      
      // Gerar imagens para cada card
      const { imageUrls, caption, slides } = await generateCarouselImages(
        generatedData.cards || [],
        generatedData.newCaption || ad.ad_copy || ad.message || '',
        geminiApiKey,
        supabase,
        projectId,
        accountName,
        ad
      );
      
      console.log(`✅ ${imageUrls.length} imagens geradas com sucesso`);
      console.log('Carrossel - Caption final:', caption ? `"${caption.substring(0, 100)}..."` : 'VAZIA');
      console.log('Carrossel - imageUrls count:', imageUrls.length);
      console.log('Carrossel - slides count:', slides.length);
      
      // Criar material com tipo carousel
      const { data: newMaterial, error: materialError } = await supabase
        .from('materials')
        .insert({
          name: `Carrossel (${slideCount} slides) - Baseado em ${ad.ad_name || adId}`,
          type: 'carousel',
          is_briefing: true,
          project_id: projectId,
          company_id: project.company_id,
          created_by: profile.id,
          canvas_data: null,
          caption: caption,
          file_url: imageUrls[0],
          reference: adId,
          status: 'pending',
          metadata: {
            carousel_images: imageUrls,
            slide_count: slideCount,
            source_ad: adId
          },
          wireframe_data: {
            isCarousel: true,
            slideCount: slideCount,
            slides: slides
          }
        })
        .select()
        .single();
      
      if (materialError) throw materialError;
      
      console.log('✅ Material criado (carousel):', {
        id: newMaterial.id,
        name: newMaterial.name,
        type: newMaterial.type,
        caption: newMaterial.caption ? `"${newMaterial.caption.substring(0, 50)}..."` : 'NULL',
        is_briefing: newMaterial.is_briefing
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          materialId: newMaterial.id,
          message: `Carrossel de ${slideCount} slides criado com sucesso!`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (targetFormat === 'static') {
      canvasData = generateStaticCanvas(generatedData.layout);
    } else if (targetFormat === 'video') {
      // Construir prompt detalhado a partir do storyboard
      const videoPrompt = buildVideoPromptFromStoryboard(
        generatedData.storyboard,
        generatedData.videoDescription || '',
        adData || ad
      );
      
      console.log('Iniciando geração de vídeo com Veo 3.1...');
      console.log('Prompt:', videoPrompt);
      
      // Chamar API do Veo 3.1
      const veoOperation = await initiateVeoVideoGeneration({
        prompt: videoPrompt,
        imageUrl: ad.image_url || adData?.image_url,
        geminiApiKey
      });
      
      console.log('Veo operation initiated:', veoOperation.name);
      
      // Criar material com status processing
      const { data: newMaterial, error: insertError } = await supabase
        .from('materials')
        .insert({
          name: `Vídeo - Baseado em ${ad.ad_name || adId}`,
          type: 'video',
          is_briefing: true,
          project_id: projectId,
          company_id: project.company_id,
          created_by: profile.id,
          status: 'processing',
          canvas_data: null,
          caption: generatedData.newCaption,
          file_url: null,
          reference: adId,
          metadata: {
            veo_operation_name: veoOperation.name,
            storyboard: generatedData.storyboard,
            video_prompt: videoPrompt,
            source_image_url: ad.image_url || adData?.image_url
          }
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      console.log('✅ Material criado (video):', {
        id: newMaterial.id,
        name: newMaterial.name,
        type: newMaterial.type,
        caption: newMaterial.caption ? `"${newMaterial.caption.substring(0, 50)}..."` : 'NULL',
        is_briefing: newMaterial.is_briefing
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          materialId: newMaterial.id,
          status: 'processing',
          operation_name: veoOperation.name,
          message: 'Vídeo em processo de geração. Isso pode levar alguns minutos.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid target format');
    }

    // Criar novo material
    const materialName = `${formatLabel(targetFormat)} - Baseado em ${ad.ad_name || adId}`;
    
    const { data: newMaterial, error: materialError } = await supabase
      .from('materials')
      .insert({
        name: materialName,
        type: 'wireframe',
        is_briefing: true,
        project_id: projectId,
        company_id: project.company_id,
        created_by: profile.id,
        canvas_data: canvasData,
        caption: generatedData.newCaption,
        file_url: null,
        ai_generated_video: false,
        reference: adId,
        status: 'pending'
      })
      .select()
      .single();

    if (materialError) {
      console.error('Error creating material:', materialError);
      throw new Error('Failed to create material');
    }

    console.log('✅ Material criado (static):', {
      id: newMaterial.id,
      name: newMaterial.name,
      type: newMaterial.type,
      caption: newMaterial.caption ? `"${newMaterial.caption.substring(0, 50)}..."` : 'NULL',
      is_briefing: newMaterial.is_briefing
    });

    return new Response(
      JSON.stringify({
        success: true,
        materialId: newMaterial.id,
        message: `Criativo transformado com sucesso para ${formatLabel(targetFormat)}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Transform creative error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// ============ FUNÇÕES DE EXTRAÇÃO E VALIDAÇÃO DO DNA DO CRIATIVO ============

/**
 * Busca mídia e converte para base64
 */
async function fetchMediaAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64;
  } catch (error) {
    console.error('Erro ao buscar mídia:', error);
    throw error;
  }
}

/**
 * Extrai cores HEX do texto de análise
 */
function extractColorsFromText(text: string): string[] {
  const hexPattern = /#[0-9A-Fa-f]{6}/g;
  const matches = text.match(hexPattern) || [];
  return [...new Set(matches)];
}

/**
 * Extrai tokens críticos (datas, números, frases-chave)
 */
function extractTokensFromText(text: string): string[] {
  const tokens: string[] = [];
  
  const datePatterns = [
    /\d{4}\.\d/g,
    /\d{1,2}\/\d{1,2}/g,
    /\d{1,2}\s+de\s+\w+/gi
  ];
  
  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) tokens.push(...matches);
  });

  const numberPattern = /\d+\s+anos?/gi;
  const numberMatches = text.match(numberPattern);
  if (numberMatches) tokens.push(...numberMatches);

  if (text.toLowerCase().includes('nota do enem')) {
    tokens.push('nota do ENEM');
  }
  if (text.toLowerCase().includes('últimos 10 anos') || text.toLowerCase().includes('até 10 anos')) {
    tokens.push('últimos 10 anos');
  }

  return [...new Set(tokens)];
}

/**
 * Extrai o "DNA" estruturado do criativo original para replicação fiel
 */
async function extractCreativeDNA(mediaUrl: string | null, adCopy: string, geminiApiKey: string): Promise<any> {
  if (!mediaUrl) {
    console.log('⚠️ Sem mídia para extrair DNA visual, usando apenas texto');
    return {
      colors: [],
      textBlocks: { headline: adCopy?.substring(0, 60) || '', body: adCopy || '', cta: '', disclaimers: '' },
      criticalTokens: extractTokensFromText(adCopy || ''),
      persona: null
    };
  }

  try {
    const dnaPrompt = `Analise esta imagem de anúncio e extraia APENAS o que está VISÍVEL:

1. CORES (HEX): Liste as cores principais em ordem de hierarquia visual (background, destaque, botão, texto)
2. TEXTOS: Transcreva EXATAMENTE os textos visíveis (título, corpo, CTA, disclaimers) em PT-BR
3. TOKENS CRÍTICOS: Datas (ex: "2026.1"), números importantes ("10 anos"), frases únicas ("nota do ENEM")
4. PERSONA: Se houver pessoa visível, descreva brevemente (ex: "médica com jaleco")

IMPORTANTE: Se algo não estiver visível, retorne null. Não invente.`;

    const dnaResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: dnaPrompt },
              {
                inlineData: {
                  mimeType: mediaUrl.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
                  data: await fetchMediaAsBase64(mediaUrl)
                }
              }
            ]
          }]
        })
      }
    );

    if (!dnaResponse.ok) {
      console.error('Erro ao extrair DNA:', await dnaResponse.text());
      return null;
    }

    const dnaData = await dnaResponse.json();
    const dnaText = dnaData.candidates[0].content.parts[0].text;
    
    const dna = {
      colors: extractColorsFromText(dnaText),
      textBlocks: { headline: adCopy || '', body: adCopy || '', cta: '', disclaimers: '' },
      criticalTokens: extractTokensFromText(dnaText + ' ' + adCopy),
      persona: dnaText.toLowerCase().includes('médica') || dnaText.toLowerCase().includes('jaleco') ? 'médica com jaleco' : 
               dnaText.toLowerCase().includes('pessoa') ? 'pessoa visível' : null
    };

    console.log('✅ DNA do criativo extraído');
    return dna;

  } catch (error) {
    console.error('Erro ao extrair DNA:', error);
    return null;
  }
}

/**
 * Parafraseia legenda fielmente preservando tokens críticos
 */
async function paraphraseCaptionPTBR(
  originalCaption: string,
  criticalTokens: string[],
  isMandic: boolean,
  geminiApiKey: string
): Promise<string> {
  if (!originalCaption || originalCaption.trim() === '') {
    return '';
  }

  const tokensStr = criticalTokens.join(', ');
  
  const paraphrasePrompt = `Reescreva esta legenda de anúncio em português formal, mantendo EXATAMENTE o sentido e todos os tokens críticos.

LEGENDA ORIGINAL:
"${originalCaption}"

TOKENS CRÍTICOS QUE DEVEM PERMANECER IDÊNTICOS:
${tokensStr}

INSTRUÇÕES:
1. Reescrever em PT-BR formal e convincente
2. PRESERVAR exatamente: datas, números, CTAs, frases-chave dos tokens
3. Corrigir apenas ortografia/acentuação
4. NÃO inventar novos fatos ou benefícios
5. Tamanho similar ao original (±20%)
6. NÃO alterar o público-alvo mencionado

Retorne APENAS a legenda reescrita, sem explicações.`;

  try {
    const paraphraseResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: paraphrasePrompt }] }]
        })
      }
    );

    if (!paraphraseResponse.ok) {
      console.error('Erro ao parafrasear:', await paraphraseResponse.text());
      return originalCaption;
    }

    const paraphraseData = await paraphraseResponse.json();
    let paraphrased = paraphraseData.candidates[0].content.parts[0].text.trim();
    paraphrased = paraphrased.replace(/^["']|["']$/g, '');

    console.log('✅ Legenda parafraseada');
    return paraphrased;

  } catch (error) {
    console.error('Erro ao parafrasear legenda:', error);
    return originalCaption;
  }
}

/**
 * Valida que tokens críticos estão presentes no texto gerado
 */
function validateCriticalTokens(generatedText: string, criticalTokens: string[]): boolean {
  const normalizedGenerated = generatedText.toLowerCase();
  const missingTokens: string[] = [];

  for (const token of criticalTokens) {
    const normalizedToken = token.toLowerCase();
    if (!normalizedGenerated.includes(normalizedToken)) {
      missingTokens.push(token);
    }
  }

  if (missingTokens.length > 0) {
    console.warn('⚠️ Tokens críticos ausentes:', missingTokens);
    return false;
  }

  return true;
}

/**
 * Detecta datas no texto
 */
function detectDates(text: string): string[] {
  const datePatterns = [
    /\d{4}\.\d/g,
    /\d{1,2}\/\d{1,2}\/?\d{0,4}/g,
    /\d{1,2}\s+de\s+\w+/gi
  ];
  
  const dates: string[] = [];
  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) dates.push(...matches);
  });
  
  return dates;
}

/**
 * Valida e sanitiza texto seguindo regras Mandic e limites de caracteres
 */
async function enforceMandicAndLanguage(
  text: string,
  type: 'copy' | 'caption' | 'storyboard',
  isMandic: boolean,
  geminiApiKey: string,
  adData?: any
): Promise<string> {
  if (!text || text.trim() === '') return text;
  
  let cleaned = text.trim();
  
  // 1. Remover palavras proibidas Mandic
  if (isMandic) {
    const forbiddenWords = [
      'últimas vagas', 'faça já', 'imperdível', 'corra', 
      'tempo limitado', 'oferta imperdível', 'não perca',
      'aproveite agora', 'última chance', 'vagas limitadas'
    ];
    
    let removedWords: string[] = [];
    forbiddenWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      if (regex.test(cleaned)) {
        removedWords.push(word);
        cleaned = cleaned.replace(regex, '');
      }
    });
    
    if (removedWords.length > 0) {
      console.log(`✅ Palavras proibidas removidas: ${removedWords.join(', ')}`);
    }
    
    // Limpar espaços duplos
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }
  
  // 2. Validar e ajustar comprimento
  const limits = {
    copy: 110,
    caption: { min: 250, max: 500 },
    storyboard: 80
  };
  
  // Para caption, validar faixa 250-500
  if (type === 'caption') {
    if (cleaned.length < limits.caption.min) {
      // Expandir com informações relevantes
      if (isMandic && adData) {
        const expansion = ` Com infraestrutura completa, corpo docente de excelência e prática supervisionada, oferecemos a melhor formação em ${adData.ad_name || 'nossa área'}.`;
        cleaned += expansion;
      }
    }
    
    if (cleaned.length > limits.caption.max) {
      cleaned = cleaned.substring(0, limits.caption.max - 3) + '...';
    }
    
    console.log(`✅ Caption final: ${cleaned.length} caracteres (limite: 250-500)`);
  }
  
  // Para copy, validar máximo 110
  if (type === 'copy' && cleaned.length > limits.copy) {
    cleaned = cleaned.substring(0, limits.copy);
    console.log(`✅ Copy ajustado: ${cleaned.length} caracteres (limite: 110)`);
  }
  
  // Para storyboard, validar máximo 80
  if (type === 'storyboard' && cleaned.length > limits.storyboard) {
    cleaned = cleaned.substring(0, limits.storyboard);
    console.log(`✅ Storyboard ajustado: ${cleaned.length} caracteres (limite: 80)`);
  }
  
  return cleaned;
}

function buildPrompt(targetFormat: string, sourceFormat: string, ad: any, analysis: any, accountName: string = '', slideCount?: number, creativeDNA?: any): string {
  // Verificar se é conta Mandic
  const isMandic = accountName && (
    accountName.toLowerCase().includes('são leopoldo mandic') ||
    accountName.toLowerCase().includes('mandic') ||
    accountName.toLowerCase().includes('pós-graduação medicina') ||
    accountName.toLowerCase().includes('medicina do sertão')
  );
  
  const mandicGuidelines = isMandic ? `

**🩺 REGRAS OBRIGATÓRIAS MANDIC - BASE DE CONHECIMENTO:**

Você DEVE seguir rigorosamente as diretrizes de copywriting Mandic:

**ESTRUTURA OBRIGATÓRIA:**
- Copy principal: máximo 110 caracteres
- Legenda/Descrição: entre 250-500 caracteres
- CTA: único e coerente com o funil
- Tom: profissional, humano e inspirador

**PROIBIÇÕES ABSOLUTAS:**
- "últimas vagas", "faça já", "imperdível", "corra"
- Promessas de resultado ou títulos médicos (especialista, RQE)
- Linguagem de varejo ou urgência artificial
- Jargões complexos sem explicação

**OBRIGATÓRIO VALORIZAR:**
- Prática supervisionada (70% em pós-médica)
- Infraestrutura (laboratórios, ambulatórios, hospital próprio)
- Docentes atuantes e de referência
- Tradição e excelência acadêmica

**IDENTIFICAÇÃO DE PRODUTO (detectar automaticamente do anúncio):**

1. **Pós-Graduação Medicina** (Pós-Médica):
   - Tom: consultivo, técnico, inspirador
   - Mensagem: evolução profissional com prática
   - Provas: 70% prática, ambulatórios, docentes atuantes
   - CTA: "Conheça nossos cursos", "Inicie sua especialização"
   - Cidades: Campinas, SP, Brasília

2. **Pós-Graduação Odontologia** (Pós-Odonto):
   - Tom: educacional, técnico, profissional
   - Mensagem: tradição + prática + inovação
   - Provas: alta carga prática, docentes renomados
   - CTA: "Conheça as especialidades", "Garanta sua vaga"

3. **Vestibular Medicina**:
   - Tom: institucional, inspirador, confiável
   - Mensagem: tradição + excelência
   - Provas: nota máxima MEC, hospital próprio, prática desde início
   - CTA: "Inscreva-se", "Confira as datas"

4. **Vestibular Odontologia**:
   - Tom: acadêmico, moderno, jovem
   - Mensagem: 30 anos de história, 40 mil formados
   - Provas: clínicas e laboratórios avançados
   - CTA: "Inscreva-se agora"

5. **FMS - Medicina do Sertão**:
   - Tom: humano, regional, acolhedor
   - Mensagem: impacto social + oportunidade
   - Provas: interiorização, conexão comunidade
   - CTA: "Inscreva-se", "Veja como participar"
   - IMPORTANTE: NÃO mencionar Mandic

6. **BeautyCare** (Captação Pacientes):
   - Tom: acolhedor, seguro, transparente
   - Mensagem: clínica-escola supervisionada + acessibilidade
   - Provas: atendimentos supervisionados, docentes especialistas
   - CTA: "Agende sua consulta", "Faça sua triagem"
   - Evitar: promessas estéticas

**VALIDAÇÃO OBRIGATÓRIA:**
Antes de entregar, verifique:
✓ Copy ≤110 caracteres?
✓ Legenda 250-500 caracteres?
✓ CTA único e adequado ao produto?
✓ Sem palavras proibidas?
✓ Tom correto para o produto?
✓ Provas reais presentes?
✓ Coerência entre copy e legenda?

` : '';

  const baseInfo = `
[ANÁLISE DO CRIATIVO ORIGINAL]
Tipo: ${sourceFormat}
Nome do Anúncio: ${ad.ad_name || 'Sem nome'}
Copy/Texto: ${ad.ad_copy || ad.message || 'Sem texto'}
CTA: ${ad.call_to_action || 'Sem CTA'}
Headline: ${ad.headline || 'Sem headline'}
Link: ${ad.link_url || ''}

${analysis ? `
[ANÁLISE DE PERFORMANCE]
Métricas: ${JSON.stringify(analysis.metrics_analysis || {})}
Insights: ${JSON.stringify(analysis.performance_insights || {})}
Recomendações: ${JSON.stringify(analysis.recommendations || {})}
` : ''}

${mandicGuidelines}
`;

  if (targetFormat === 'carousel') {
    const numCards = slideCount || 4;
    return `${baseInfo}

[TAREFA]
Transforme este criativo em um carrossel de EXATAMENTE ${numCards} cards para Instagram/Facebook.

Para cada card (deve haver EXATAMENTE ${numCards} cards), forneça:
- headline: texto principal (máx 40 caracteres)
- body: texto secundário (máx 90 caracteres)
- cta: call-to-action (opcional, máx 20 caracteres)
- visualDescription: descrição MUITO detalhada e específica de como deve ser o visual deste card. Inclua:
  * Paleta de cores exata (ex: "fundo azul royal #0047AB com detalhes em dourado #FFD700")
  * Layout específico (ex: "título no topo centralizado, imagem ocupando 60% do meio, texto na parte inferior")
  * Elementos visuais (ex: "foto de produto em close, com sombra suave, sobre fundo clean")
  * Tipografia (ex: "fonte sans-serif bold para título, regular para corpo")
  * Estilo geral (ex: "minimalista moderno", "vibrante e jovem", "elegante e sofisticado")

IMPORTANTE:
- Cada card deve ter visual DISTINTO mas manter coerência de marca
- Os cards devem ter uma progressão lógica e storytelling claro
- O primeiro card deve capturar atenção IMEDIATAMENTE
- Cada visualDescription deve ser detalhada o suficiente para gerar uma imagem completa
- Use cores vibrantes e contrastantes que funcionem bem em redes sociais`;
  }

  if (targetFormat === 'static') {
    return `${baseInfo}

[TAREFA]
Consolide toda a mensagem em uma única imagem estática poderosa.

**Hierarquia de Informação:**
1º Oferta/Headline → 2º Visual do Produto → 3º CTA

**Layout:**
- Topo/Destaque: Headline ou Oferta principal
- Centro: Visual principal (produto, pessoa)
- Base: Call-to-Action
- Elementos Adicionais: Selos sem poluir os 3 elementos principais

Retorne um JSON com esta estrutura:
{
  "layout": {
    "headline": "texto principal",
    "subheadline": "texto secundário se houver",
    "mainVisual": "descrição do visual central",
    "cta": "texto do CTA",
    "offer": "texto da oferta (ex: '50% OFF')",
    "additionalElements": ["Frete Grátis", "Garantia"]
  },
  "newCaption": "Nova legenda/descrição"
}`;
  }

  if (targetFormat === 'video') {
    // DNA do criativo para replicação fiel
    const dnaContext = creativeDNA ? `
[DNA DO CRIATIVO BASE - REPLICAR FIELMENTE]
Cores: ${creativeDNA.colors.join(', ') || 'detectar automaticamente'}
Textos originais: "${creativeDNA.textBlocks.headline}" / "${creativeDNA.textBlocks.body}"
Tokens críticos (PRESERVAR): ${creativeDNA.criticalTokens.join(', ')}
Persona: ${creativeDNA.persona || 'Nenhuma'}
` : (analysis?.visual_analysis ? 
      `\n[CONTEXTO VISUAL DO CRIATIVO BASE]
Paleta de cores: ${analysis.visual_analysis.colors || analysis.visual_analysis.palette || 'detectar das imagens'}
Estilo visual: ${analysis.visual_analysis.style || 'moderno e profissional'}
Elementos principais: ${analysis.visual_analysis.elements || 'texto, logo, imagem do produto'}
Tipografia: ${analysis.visual_analysis.typography || 'clean e moderna'}
Layout: ${analysis.visual_analysis.layout || 'minimalista'}\n` : '');
    
    // Detectar tipo de produto para Mandic
    let productType = 'geral';
    const productHint = ad?.ad_name || ad?.headline || '';
    if (productHint.toLowerCase().includes('pós') && productHint.toLowerCase().includes('medic')) {
      productType = 'pós-graduação médica';
    } else if (productHint.toLowerCase().includes('pós') && productHint.toLowerCase().includes('odonto')) {
      productType = 'pós-graduação odontologia';
    } else if (productHint.toLowerCase().includes('vestibular') && productHint.toLowerCase().includes('medic')) {
      productType = 'vestibular medicina';
    } else if (productHint.toLowerCase().includes('vestibular') && productHint.toLowerCase().includes('odonto')) {
      productType = 'vestibular odontologia';
    } else if (productHint.toLowerCase().includes('sertão') || productHint.toLowerCase().includes('fms')) {
      productType = 'Faculdade de Medicina do Sertão';
    }
    
    return `${baseInfo}
${dnaContext}

[TAREFA]
Transforme em um vídeo curto de 8-12 segundos para anúncio, REPLICANDO FIELMENTE o criativo base.

**PRODUTO DETECTADO: ${productType}**

**REGRAS CRÍTICAS DE REPLICAÇÃO:**
1. A Cena 1 DEVE replicar EXATAMENTE o visual do criativo base (cores, layout, texto)
2. Cenas 2-4 DEVEM manter a paleta de cores e estilo visual do criativo base
3. Use os textos originais: headline "${ad.headline || ad.ad_copy || ''}", copy "${ad.ad_copy || ad.message || ''}", CTA "${ad.call_to_action || ''}"
4. Mantenha a identidade visual consistente em todas as cenas

**REGRAS TÉCNICAS:**
1. Crie EXATAMENTE 4 cenas, NÃO MAIS
2. Cada campo "text" deve ter NO MÁXIMO 50 caracteres (conte os caracteres!)
3. Cada "description" deve ter NO MÁXIMO 100 caracteres
4. NÃO repita o mesmo texto várias vezes
5. Seja objetivo e direto

**Estrutura do Vídeo:**
- Cena 1 (2s): REPLICAR criativo base (mesmos cores, texto, layout)
- Cena 2 (2-3s): Expandir benefício principal mantendo cores
- Cena 3 (2-3s): Solução/produto com elementos visuais do base
- Cena 4 (2s): CTA original + oferta

**Diretrizes de Animação:**
- Use "fade in", "slide up", "zoom in", "bounce", etc.
- Mantenha simples e moderno
- Foco no texto e produto
- Transições suaves mantendo coerência visual

Retorne JSON com esta estrutura (respeite os limites!):
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "2s",
      "description": "REPLICAR criativo base: [descrever visual exato] (máx 100 chars)",
      "text": "Texto original do criativo (máx 50 chars)",
      "animation": "Tipo de animação (máx 80 chars)"
    }
  ],
  "videoDescription": "Resumo do vídeo mantendo identidade visual do base (máx 200 chars)",
  "newCaption": "Legenda para o post (250-500 chars)"
}`;
  }

  return '';
}

function getResponseSchema(targetFormat: string): any {
  if (targetFormat === 'carousel') {
    return {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              headline: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
              visualDescription: { type: "string" }
            },
            required: ["headline", "body", "visualDescription"]
          }
        },
        newCaption: { type: "string" }
      },
      required: ["cards", "newCaption"]
    };
  }

  if (targetFormat === 'static') {
    return {
      type: "object",
      properties: {
        layout: {
          type: "object",
          properties: {
            headline: { type: "string" },
            subheadline: { type: "string" },
            mainVisual: { type: "string" },
            cta: { type: "string" },
            offer: { type: "string" },
            additionalElements: { 
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["headline", "mainVisual", "cta"]
        },
        newCaption: { type: "string" }
      },
      required: ["layout", "newCaption"]
    };
  }

  if (targetFormat === 'video') {
    return {
      type: "object",
      properties: {
        storyboard: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              scene: { type: "number" },
              duration: { type: "string", maxLength: 10 },
              description: { type: "string", maxLength: 150 },
              text: { type: "string", maxLength: 80 },
              animation: { type: "string", maxLength: 100 }
            },
            required: ["scene", "duration", "description"]
          }
        },
        videoDescription: { type: "string", maxLength: 250 },
        newCaption: { type: "string", maxLength: 500 }
      },
      required: ["storyboard", "videoDescription", "newCaption"]
    };
  }

  return {};
}

function generateCarouselCanvas(cards: any[]): string {
  const cardWidth = 700;
  const cardHeight = 700;
  const spacing = 50;
  const objects: any[] = [];

  cards.forEach((card, index) => {
    const leftOffset = index * (cardWidth + spacing);

    // Background do card
    objects.push({
      type: 'rect',
      left: leftOffset,
      top: 0,
      width: cardWidth,
      height: cardHeight,
      fill: '#FFFFFF',
      stroke: '#E5E7EB',
      strokeWidth: 2,
      selectable: true,
      rx: 10,
      ry: 10
    });

    // Headline
    objects.push({
      type: 'textbox',
      left: leftOffset + cardWidth / 2,
      top: 80,
      width: cardWidth - 100,
      text: card.headline,
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      originX: 'center',
      fill: '#111827',
      selectable: true,
      fontFamily: 'Arial'
    });

    // Body text
    objects.push({
      type: 'textbox',
      left: leftOffset + cardWidth / 2,
      top: 200,
      width: cardWidth - 100,
      text: card.body,
      fontSize: 18,
      textAlign: 'center',
      originX: 'center',
      fill: '#4B5563',
      selectable: true,
      fontFamily: 'Arial'
    });

    // CTA se existir
    if (card.cta) {
      objects.push({
        type: 'rect',
        left: leftOffset + cardWidth / 2,
        top: 580,
        width: 300,
        height: 60,
        fill: '#8B5CF6',
        originX: 'center',
        rx: 30,
        ry: 30,
        selectable: true
      });

      objects.push({
        type: 'text',
        left: leftOffset + cardWidth / 2,
        top: 600,
        text: card.cta,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        fill: '#FFFFFF',
        selectable: true,
        fontFamily: 'Arial'
      });
    }

    // Visual placeholder
    objects.push({
      type: 'rect',
      left: leftOffset + 150,
      top: 350,
      width: 400,
      height: 200,
      fill: '#F3F4F6',
      selectable: true,
      rx: 8,
      ry: 8
    });

    objects.push({
      type: 'text',
      left: leftOffset + cardWidth / 2,
      top: 450,
      text: card.visualDescription,
      fontSize: 14,
      textAlign: 'center',
      originX: 'center',
      fill: '#9CA3AF',
      selectable: true,
      fontFamily: 'Arial'
    });
  });

  return JSON.stringify({
    version: '6.0.0',
    objects,
    background: '#F9FAFB'
  });
}

function generateStaticCanvas(layout: any): string {
  const objects = [];

  // Background
  objects.push({
    type: 'rect',
    left: 0,
    top: 0,
    width: 1080,
    height: 1080,
    fill: '#FFFFFF',
    selectable: false
  });

  // Headline (topo)
  objects.push({
    type: 'textbox',
    left: 540,
    top: 100,
    width: 900,
    text: layout.headline,
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    originX: 'center',
    fill: '#111827',
    selectable: true,
    fontFamily: 'Arial'
  });

  // Offer badge se existir
  if (layout.offer) {
    objects.push({
      type: 'rect',
      left: 540,
      top: 220,
      width: 250,
      height: 80,
      fill: '#DC2626',
      originX: 'center',
      rx: 40,
      ry: 40,
      selectable: true
    });

    objects.push({
      type: 'text',
      left: 540,
      top: 260,
      text: layout.offer,
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      fill: '#FFFFFF',
      selectable: true,
      fontFamily: 'Arial'
    });
  }

  // Main visual (centro)
  objects.push({
    type: 'rect',
    left: 290,
    top: 350,
    width: 500,
    height: 400,
    fill: '#F3F4F6',
    selectable: true,
    rx: 12,
    ry: 12
  });

  objects.push({
    type: 'text',
    left: 540,
    top: 550,
    text: layout.mainVisual,
    fontSize: 16,
    textAlign: 'center',
    originX: 'center',
    fill: '#9CA3AF',
    selectable: true,
    fontFamily: 'Arial'
  });

  // CTA (base)
  objects.push({
    type: 'rect',
    left: 540,
    top: 860,
    width: 400,
    height: 80,
    fill: '#8B5CF6',
    originX: 'center',
    rx: 40,
    ry: 40,
    selectable: true
  });

  objects.push({
    type: 'text',
    left: 540,
    top: 900,
    text: layout.cta,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    fill: '#FFFFFF',
    selectable: true,
    fontFamily: 'Arial'
  });

  // Additional elements
  if (layout.additionalElements && layout.additionalElements.length > 0) {
    layout.additionalElements.forEach((elem: string, index: number) => {
      objects.push({
        type: 'text',
        left: 150 + (index * 300),
        top: 980,
        text: elem,
        fontSize: 14,
        fill: '#6B7280',
        selectable: true,
        fontFamily: 'Arial'
      });
    });
  }

  return JSON.stringify({
    version: '6.0.0',
    objects,
    background: '#FFFFFF'
  });
}

function generateVideoCanvas(storyboard: any[], caption: string): string {
  const objects = [];
  const frameWidth = 600;
  const frameHeight = 120;
  const margin = 20;
  
  // Título "STORYBOARD DO VÍDEO"
  objects.push({
    type: 'textbox',
    left: 50,
    top: 30,
    width: 600,
    fontSize: 28,
    fontWeight: 'bold',
    fill: '#1a1a1a',
    text: 'STORYBOARD DO VÍDEO',
    fontFamily: 'Arial',
    selectable: true
  });

  // Legenda gerada
  if (caption) {
    objects.push({
      type: 'textbox',
      left: 50,
      top: 80,
      width: 600,
      fontSize: 14,
      fill: '#666666',
      text: `Legenda: ${caption}`,
      fontFamily: 'Arial',
      selectable: true
    });
  }

  // Cada frame do storyboard
  storyboard.forEach((scene, index) => {
    const yPos = 140 + (index * (frameHeight + margin));
    
    // Retângulo do frame
    objects.push({
      type: 'rect',
      left: 50,
      top: yPos,
      width: frameWidth,
      height: frameHeight,
      fill: '#f0f4f8',
      stroke: '#3b82f6',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
      selectable: true
    });
    
    // Número da cena
    objects.push({
      type: 'text',
      left: 70,
      top: yPos + 15,
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#3b82f6',
      text: `Cena ${index + 1}`,
      fontFamily: 'Arial',
      selectable: true
    });
    
    // Descrição da cena
    objects.push({
      type: 'textbox',
      left: 70,
      top: yPos + 45,
      width: frameWidth - 40,
      fontSize: 13,
      fill: '#1a1a1a',
      text: scene.description || '',
      fontFamily: 'Arial',
      selectable: true
    });
    
    // Texto da cena (se houver)
    if (scene.text) {
      objects.push({
        type: 'textbox',
        left: 70,
        top: yPos + 80,
        width: frameWidth - 40,
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#059669',
        text: `"${scene.text}"`,
        fontFamily: 'Arial',
        selectable: true
      });
    }
  });

  return JSON.stringify({
    version: '6.0.0',
    objects,
    background: '#ffffff'
  });
}

function formatLabel(format: string): string {
  const labels: Record<string, string> = {
    'carousel': 'Carrossel',
    'static': 'Estático',
    'video': 'Vídeo'
  };
  return labels[format] || format;
}

/**
 * Gera imagens para cada card do carrossel usando Gemini Image API
 */
async function generateCarouselImages(
  cards: Array<{
    headline: string;
    body: string;
    cta?: string;
    visualDescription: string;
  }>,
  originalCaption: string,
  geminiApiKey: string,
  supabaseClient: any,
  projectId: string,
  accountName: string = '',
  ad: any = null
): Promise<{
  imageUrls: string[];
  caption: string;
  slides: Array<{ imageUrl: string; index: number }>;
}> {
  const imageUrls: string[] = [];
  const slides: Array<{ imageUrl: string; index: number }> = [];
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    
    console.log(`Generating image for card ${i + 1}/${cards.length}...`);
    
    // Prompt detalhado para geração de imagem
    const imagePrompt = `
Crie uma imagem publicitária profissional para redes sociais (1080x1080px) com:

TEXTO PRINCIPAL (em destaque): "${card.headline}"
TEXTO SECUNDÁRIO: "${card.body}"
${card.cta ? `BOTÃO/CTA: "${card.cta}"` : ''}

ESTILO VISUAL:
${card.visualDescription}

REQUISITOS:
- Tipografia moderna e legível
- Cores vibrantes e profissionais
- Design limpo e balanceado
- Adequado para Instagram/Facebook
- Sem watermarks ou logos genéricos
- Texto bem integrado ao design visual
    `.trim();
    
      // Tenta primeiro com Gemini usando o modelo de imagem
      try {
        const geminiModel = 'gemini-2.5-flash-image';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: imagePrompt }
                  ]
                }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gemini API error for card ${i + 1}:`, response.status, errorText);
          throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();

        // Procurar a imagem em inlineData (camelCase) ou inline_data (snake_case)
        const parts = data?.candidates?.[0]?.content?.parts || [];
        let base64Image: string | undefined;
        let mimeType: string = 'image/jpeg';
        for (const part of parts) {
          if (part?.inlineData?.data) {
            base64Image = part.inlineData.data;
            mimeType = part.inlineData.mimeType || mimeType;
            break;
          }
          if (part?.inline_data?.data) {
            base64Image = part.inline_data.data;
            mimeType = part.inline_data.mimeType || mimeType;
            break;
          }
        }

        if (!base64Image) {
          console.error('Unexpected Gemini response structure:', JSON.stringify(data).substring(0, 500));
          throw new Error('Invalid response from Gemini Image API');
        }

        // Converter base64 para Uint8Array
        const binaryString = atob(base64Image);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Upload para Supabase Storage
        const fileName = `carousel-${projectId}-${Date.now()}-slide-${i + 1}.jpg`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('materials')
          .upload(fileName, bytes, {
            contentType: mimeType,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Obter URL pública
        const { data: { publicUrl } } = supabaseClient.storage
          .from('materials')
          .getPublicUrl(fileName);

        console.log(`Card ${i + 1} image generated successfully (Gemini): ${publicUrl}`);

        imageUrls.push(publicUrl);
        slides.push({ imageUrl: publicUrl, index: i });
      } catch (geminiErr) {
        console.error(`Gemini failed for card ${i + 1}, falling back to OpenAI:`, geminiErr);
        // Fallback EXCLUSIVO para geração de imagem com OpenAI
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiKey) {
          throw new Error('OPENAI_API_KEY not configured');
        }

        const oaResp = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: imagePrompt,
            size: '1024x1024',
            n: 1
          })
        });

        if (!oaResp.ok) {
          const t = await oaResp.text();
          console.error('OpenAI image generation error:', oaResp.status, t);
          throw new Error(`OpenAI image generation error: ${oaResp.status}`);
        }

        const oaData = await oaResp.json();
        const b64 = oaData?.data?.[0]?.b64_json as string | undefined;
        if (!b64) {
          console.error('Unexpected OpenAI image response:', JSON.stringify(oaData).substring(0, 500));
          throw new Error('Invalid response from OpenAI Image API');
        }

        const binaryString2 = atob(b64);
        const bytes2 = new Uint8Array(binaryString2.length);
        for (let j = 0; j < binaryString2.length; j++) {
          bytes2[j] = binaryString2.charCodeAt(j);
        }

        const fileName2 = `carousel-${projectId}-${Date.now()}-slide-${i + 1}.png`;
        const { error: uploadError2 } = await supabaseClient.storage
          .from('materials')
          .upload(fileName2, bytes2, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError2) {
          console.error('Upload error (OpenAI):', uploadError2);
          throw uploadError2;
        }

        const { data: { publicUrl: publicUrl2 } } = supabaseClient.storage
          .from('materials')
          .getPublicUrl(fileName2);

        console.log(`Card ${i + 1} image generated successfully (OpenAI): ${publicUrl2}`);
        imageUrls.push(publicUrl2);
        slides.push({ imageUrl: publicUrl2, index: i });
      }
  }
  
  // Gerar legenda apropriada ao invés de usar a original
  const isMandic = accountName && (
    accountName.toLowerCase().includes('são leopoldo mandic') ||
    accountName.toLowerCase().includes('mandic') ||
    accountName.toLowerCase().includes('pós-graduação medicina') ||
    accountName.toLowerCase().includes('medicina do sertão')
  );
  
  let generatedCaption = originalCaption;
  
  if (isMandic && cards.length > 0) {
    // Gerar legenda seguindo as regras Mandic
    const firstCard = cards[0];
    const productHint = ad?.ad_name || ad?.headline || '';
    
    // Detectar tipo de produto
    let productType = 'geral';
    if (productHint.toLowerCase().includes('pós') && productHint.toLowerCase().includes('medic')) {
      productType = 'pós-graduação médica';
    } else if (productHint.toLowerCase().includes('pós') && productHint.toLowerCase().includes('odonto')) {
      productType = 'pós-graduação odontologia';
    } else if (productHint.toLowerCase().includes('vestibular') && productHint.toLowerCase().includes('medic')) {
      productType = 'vestibular medicina';
    } else if (productHint.toLowerCase().includes('vestibular') && productHint.toLowerCase().includes('odonto')) {
      productType = 'vestibular odontologia';
    } else if (productHint.toLowerCase().includes('sertão') || productHint.toLowerCase().includes('fms')) {
      productType = 'Faculdade de Medicina do Sertão';
    } else if (productHint.toLowerCase().includes('beauty')) {
      productType = 'beautycare';
    }
    
    console.log(`✅ Produto detectado para carousel: ${productType}`);
    
    // Construir legenda baseada no tipo de produto e seguindo regras Mandic (250-500 caracteres)
    const cardSummary = cards.map((c, i) => `${i + 1}. ${c.headline}`).join(' | ');
    
    generatedCaption = `${firstCard.headline}. ${firstCard.body} ` +
      `Explore cada slide para descobrir mais sobre nossa proposta de excelência. ` +
      `${cards[cards.length - 1].cta || 'Entre em contato para saber mais'}.`;
    
    // Garantir que fique entre 250-500 caracteres
    if (generatedCaption.length < 250) {
      generatedCaption += ` Com infraestrutura completa, docentes de referência e prática supervisionada, oferecemos a melhor formação em ${productType}.`;
    }
    if (generatedCaption.length > 500) {
      generatedCaption = generatedCaption.substring(0, 497) + '...';
    }
    
    console.log(`✅ Caption do carousel gerada: ${generatedCaption.length} caracteres`);
  }
  
  return { imageUrls, caption: generatedCaption, slides };
}

/**
 * Constrói prompt detalhado para o Veo 3.1 baseado no storyboard
 */
function buildVideoPromptFromStoryboard(
  storyboard: any[],
  videoDescription: string,
  adData: any
): string {
  let prompt = `Create a professional 8-second video advertisement based on this storyboard:\n\n`;
  
  // Adicionar contexto do anúncio
  if (adData.ad_name || adData.headline) {
    prompt += `Product/Campaign: ${adData.ad_name || adData.headline}\n\n`;
  }
  
  // Adicionar descrição geral
  if (videoDescription) {
    prompt += `Overall vision: ${videoDescription}\n\n`;
  }
  
  // Adicionar cada cena do storyboard
  prompt += `Scene breakdown:\n`;
  storyboard.forEach((scene, idx) => {
    prompt += `\nScene ${idx + 1} (${scene.duration || '2s'}):\n`;
    prompt += `- Visual: ${scene.description}\n`;
    if (scene.text) {
      prompt += `- Text on screen: "${scene.text}"\n`;
    }
    if (scene.animation) {
      prompt += `- Animation style: ${scene.animation}\n`;
    }
  });
  
  // Diretrizes técnicas
  prompt += `\n\nTechnical requirements:
- Style: Modern, dynamic, professional advertising
- Pacing: Fast-paced with smooth transitions
- Camera: Use subtle movements (pan, zoom, tracking)
- Lighting: Bright, appealing, highlight key elements
- Audio: Background music matching the mood
- Quality: Cinematic, high production value`;
  
  return prompt;
}

/**
 * Inicia geração de vídeo com Veo 3.1
 */
async function initiateVeoVideoGeneration({
  prompt,
  imageUrl,
  geminiApiKey
}: {
  prompt: string;
  imageUrl: string;
  geminiApiKey: string;
}): Promise<{ name: string }> {
  
  // Primeiro, fazer upload da imagem para o Gemini Files API
  let imageData: any;
  
  if (imageUrl) {
    try {
      // Download da imagem
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      const base64Image = btoa(
        new Uint8Array(imageBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      
      imageData = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      };
    } catch (error) {
      console.error('Error processing image:', error);
      // Continuar sem imagem se falhar
    }
  }
  
  // Chamar API do Veo 3.1
  const requestBody: any = {
    instances: [{
      prompt: prompt
    }],
    parameters: {
      aspectRatio: '16:9',
      negativePrompt: 'low quality, blurry, distorted, cartoon, drawing'
    }
  };
  
  // Adicionar imagem de referência se disponível
  if (imageData) {
    requestBody.instances[0].image = imageData;
  }
  
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Veo API error:', response.status, errorText);
    throw new Error(`Veo API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('Veo operation created:', data);
  
  return { name: data.name };
}

