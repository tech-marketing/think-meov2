import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User company not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { adId, accountId, patternId, adName, campaignName, materialData } = await req.json();
    
    if (!adId || !accountId || !patternId) {
      return new Response(
        JSON.stringify({ error: 'Ad ID, Account ID and Pattern ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating taxonomy suggestion for ad:', adId);

    // 1. Get taxonomy pattern
    const { data: pattern } = await supabaseAdmin
      .from('taxonomy_patterns')
      .select('*')
      .eq('id', patternId)
      .eq('company_id', profile.company_id)
      .single();

    if (!pattern) {
      return new Response(
        JSON.stringify({ error: 'Taxonomy pattern not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get additional context if available
    const { data: analysis } = await supabaseAdmin
      .from('ai_creative_analysis')
      .select('visual_analysis')
      .eq('ad_id', adId)
      .eq('account_id', accountId)
      .single();

    // 3. Generate taxonomy with OpenAI
    const taxonomyPrompt = `
Gere uma taxonomia padronizada baseada no padrão definido para este anúncio:

PADRÃO DE TAXONOMIA:
${JSON.stringify(pattern.pattern_rules, null, 2)}

DADOS DO ANÚNCIO:
- Nome do Anúncio: ${adName || 'N/A'}
- Nome da Campanha: ${campaignName || 'N/A'}
- ID do Anúncio: ${adId}

DADOS DO MATERIAL (se disponível):
${materialData ? JSON.stringify(materialData, null, 2) : 'Não disponível'}

ANÁLISE VISUAL (se disponível):
${analysis?.visual_analysis ? JSON.stringify(analysis.visual_analysis, null, 2) : 'Não disponível'}

INSTRUÇÕES:
1. Analise o padrão de taxonomia fornecido
2. Aplique as regras definidas (separadores, limites de tamanho, valores válidos)
3. Gere uma taxonomia consistente e descritiva
4. Mantenha a padronização conforme as regras

Retorne apenas a taxonomia gerada como string, seguindo exatamente o padrão definido.

Exemplo de resposta esperada:
"campanha_produto_formato_variacao_v1"

Não inclua explicações, apenas a taxonomia final.
`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em nomenclatura e taxonomia digital. Gere taxonomias consistentes e padronizadas seguindo regras específicas.'
          },
          {
            role: 'user',
            content: taxonomyPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3 // Lower temperature for more consistent results
      }),
    });

    const openaiData = await openaiResponse.json();
    
    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiData);
      return new Response(
        JSON.stringify({ error: 'Failed to generate taxonomy' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generatedTaxonomy = openaiData.choices[0].message.content.trim()
      .replace(/['"]/g, '') // Remove quotes
      .toLowerCase(); // Ensure lowercase

    // 4. Validate against pattern rules if specified
    const rules = pattern.pattern_rules;
    let validatedTaxonomy = generatedTaxonomy;

    // Apply basic validation and cleanup
    if (rules.separator) {
      // Ensure consistent separators
      validatedTaxonomy = validatedTaxonomy.replace(/[\s\-_]+/g, rules.separator);
    }

    if (rules.max_length) {
      validatedTaxonomy = validatedTaxonomy.substring(0, rules.max_length);
    }

    if (rules.allowed_chars) {
      // Remove characters not in allowed list
      const allowedRegex = new RegExp(`[^${rules.allowed_chars}]`, 'g');
      validatedTaxonomy = validatedTaxonomy.replace(allowedRegex, '');
    }

    // 5. Save or update taxonomy suggestion
    const { data: savedTaxonomy, error: saveError } = await supabaseAdmin
      .from('applied_taxonomies')
      .upsert({
        ad_id: adId,
        account_id: accountId,
        pattern_id: patternId,
        generated_taxonomy: validatedTaxonomy,
        is_approved: false,
        company_id: profile.company_id,
        created_by: profile.id,
      }, {
        onConflict: 'ad_id,account_id,pattern_id'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving taxonomy:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save taxonomy suggestion' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Taxonomy suggestion generated for ad:', adId);

    return new Response(
      JSON.stringify({
        success: true,
        taxonomy: savedTaxonomy,
        suggested_name: validatedTaxonomy
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-taxonomy:', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});