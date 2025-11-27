import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      console.error("❌ OpenAI API key not found");
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ads, type, primaryMetric, secondaryMetric, competitorAds } = await req.json();

    console.log(`🔍 Analyzing ${type} group with ${ads.length} ads`);

    if (!ads || ads.length === 0) {
      return new Response(JSON.stringify({ error: "No ads provided for analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare ads data for analysis
    const adsData = ads.map((ad: any) => ({
      name: ad.ad_name,
      metrics: ad.metrics,
      imageUrl: ad.image_url,
      videoUrl: ad.video_url,
      status: ad.status,
    }));

    const groupType = type === "top" ? "melhores performers" : "que precisam de melhoria";
    const metricLabels = {
      ctr: "CTR (%)",
      roas: "ROAS",
      conversion_rate: "Taxa de Conversão (%)",
      impressions: "Impressões",
      clicks: "Cliques",
      spend: "Gasto",
      conversions: "Conversões",
    };

    const prompt = `
Analise este grupo de criativos Meta Ads classificados como "${groupType}" baseado na métrica principal "${(metricLabels as any)[primaryMetric] || primaryMetric}" e métrica secundária "${(metricLabels as any)[secondaryMetric] || secondaryMetric}".

Dados dos anúncios:
${JSON.stringify(adsData, null, 2)}

${competitorAds && competitorAds.length > 0 ? `
**ANÁLISE COMPETITIVA DISPONÍVEL:**
Você tem acesso a ${competitorAds.length} anúncios de concorrentes ativos na mesma categoria.

TENDÊNCIAS COMPETITIVAS IDENTIFICADAS:
${competitorAds.slice(0, 8).map((ad: any, i: number) => `
- Concorrente ${i + 1} (${ad.page_name}): 
  Copy: "${ad.ad_copy?.substring(0, 100) || 'N/A'}..."
  CTA: ${ad.cta_text || 'N/A'} | Formato: ${ad.ad_format || 'N/A'}
`).join('\n')}

**ATENÇÃO:** Use esses dados competitivos para identificar:
- Padrões de copy (tom, gatilhos, estrutura)
- CTAs mais utilizados pelos concorrentes
- Formatos preferidos no nicho
- Elementos visuais comuns (quando aplicável)
` : ''}

Por favor, forneça uma análise concisa e objetiva que inclua:

1. **Elementos Visuais Comuns**: Que padrões visuais, cores, composições ou elementos você identifica em comum entre esses criativos(no caso as imagens)? 

2. **Relação com Performance**: Como esses elementos comuns podem estar impactando as métricas de ${(metricLabels as any)[primaryMetric] || primaryMetric} e ${(metricLabels as any)[secondaryMetric] || secondaryMetric}?
- Correlacione elementos visuais específicos com as métricas de performance
- Seja objetivo e baseado em dados reais das imagens
- Não é necessário trazer as valores das métricas, apenas quando precisar citar o valor das métricas em alguns lugares para reforçar seu argumento ou precisar citar para expressas melhor sua explicaco3cc
- Associe elementos em comum dos entre os criativos que tiveram o melhor/pior desempnho. 
- Cite elementos em comum entre os criativos

3. **Análise Competitiva**: Como os criativos analisados se comparam aos padrões competitivos observados?
   - Os criativos estão seguindo ou divergindo das tendências?
   - Que oportunidades existem baseadas em gaps competitivos?

4. **Insights Estratégicos**: 
   ${
     type === "top"
       ? "Que lições podem ser extraídas desses top performers para replicar em outros criativos?"
       : "Que melhorias específicas podem ser implementadas para otimizar a performance deste grupo?"
   }

5. **Recomendações**: Ações práticas e específicas incluindo elementos competitivos que devem ser testados para ${type === "top" ? "maximizar ainda mais os resultados" : "melhorar a performance"}.

Mantenha a análise focada, prática e acionável. Use markdown para formatação.
`;

    console.log("🤖 Sending request to OpenAI...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em análise de performance de criativos Meta Ads. Forneça insights práticos e acionáveis baseados em dados de performance.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log("✅ Analysis generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        groupType,
        adsCount: ads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("💥 Error in analyze-group function:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate analysis",
        details: (error as Error)?.message || "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
