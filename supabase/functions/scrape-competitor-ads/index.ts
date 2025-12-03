import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_DURATION_DAYS = 7; // Cache válido por 7 dias

// Função para converter keyword em URL da Facebook Ad Library
function buildFacebookAdLibraryUrl(keyword: string, country = 'BR'): string {
  const encodedKeyword = encodeURIComponent(keyword);
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodedKeyword}&search_type=keyword_unordered&media_type=all`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (!user) throw new Error('Invalid user');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Cache global - company_id sempre NULL
    const companyId = null;

    const { keyword, niche, forceRefresh = false } = await req.json();

    if (!keyword) {
      throw new Error('Keyword is required');
    }

    console.log(`🔍 Buscando anúncios para: "${keyword}" (niche: ${niche || 'N/A'})`);

    // STEP 1: Verificar cache
    if (!forceRefresh) {
      const cacheExpiry = new Date();
      cacheExpiry.setDate(cacheExpiry.getDate() - CACHE_DURATION_DAYS);

      // Cache global: buscar por keyword sem filtrar por company_id
      const { data: cachedAds, count } = await supabaseAdmin
        .from('competitor_ads_cache')
        .select('*', { count: 'exact' })
        .eq('search_keyword', keyword.toLowerCase())
        .gte('scraped_at', cacheExpiry.toISOString())
        .eq('is_active', true);

      if (cachedAds && cachedAds.length > 0) {
        console.log(`✅ Cache encontrado: ${cachedAds.length} anúncios`);
        return new Response(
          JSON.stringify({
            success: true,
            source: 'cache',
            ads: cachedAds,
            total: count,
            cached_at: cachedAds[0].scraped_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // STEP 2: Buscar via Apify
    console.log('📡 Cache não encontrado, buscando via Apify...');

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Criar histórico de busca
    const { data: searchHistory } = await supabaseAdmin
      .from('competitor_search_history')
      .insert({
        search_keyword: keyword.toLowerCase(),
        search_niche: niche,
        company_id: null, // Cache global
        searched_by: profile.id,
        search_status: 'processing'
      })
      .select()
      .single();

    // Converter keyword para URL da Facebook Ad Library
    const facebookUrl = buildFacebookAdLibraryUrl(keyword);
    console.log(`🔗 URL gerada: ${facebookUrl}`);

    // Configuração do Apify Actor (SEM webhook, usaremos polling)
    console.log('🔄 Configurando Apify para modo síncrono com waitForFinish=120');
    
    const actorInput = {
      urls: [
        {
          url: facebookUrl
        }
      ],
      count: 150,
      "scrapePageAds.activeStatus": "all"
    };

    // Chamar Apify Actor com waitForFinish=120 (espera até 2 minutos)
    console.log('🚀 Iniciando Apify Actor com waitForFinish=120...');
    
    let apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_API_TOKEN}&waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      }
    );

    // Fallback para actor alternativo se falhar com 403
    if (!apifyResponse.ok && apifyResponse.status === 403) {
      console.log('⚠️ Tentando actor alternativo (apify/facebook-ad-library-scraper)...');
      
      apifyResponse = await fetch(
        `https://api.apify.com/v2/acts/apify~facebook-ad-library-scraper/runs?token=${APIFY_API_TOKEN}&waitForFinish=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actorInput)
        }
      );
    }

    if (!apifyResponse.ok) {
      const errorBody = await apifyResponse.text();
      console.error('❌ Apify error:', {
        status: apifyResponse.status,
        body: errorBody,
        actor: 'curious_coder/facebook-ads-library-scraper'
      });
      
      throw new Error(`Apify API error: ${apifyResponse.status} - ${errorBody.slice(0, 200)}`);
    }

    const apifyRun = await apifyResponse.json();
    const runId = apifyRun.data.id;
    const runStatus = apifyRun.data.status;
    
    console.log(`✅ Apify run: ${runId}, status: ${runStatus}`);

    // Atualizar histórico com runId
    await supabaseAdmin
      .from('competitor_search_history')
      .update({
        metadata: {
          runId,
          startedAt: new Date().toISOString()
        }
      })
      .eq('id', searchHistory.id);

    // Se completou sincronamente (SUCCEEDED), buscar e retornar dados
    if (runStatus === 'SUCCEEDED') {
      console.log('⚡ Run completou sincronamente! Buscando dataset...');
      
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
      );
      
      if (datasetResponse.ok) {
        const ads = await datasetResponse.json();
        console.log(`✅ Dataset recebido: ${ads.length} anúncios`);
        
        // Log da estrutura real dos dados do Apify (primeiro anúncio)
        if (ads.length > 0) {
          console.log('🔍 Estrutura do primeiro anúncio do Apify:', JSON.stringify(ads[0], null, 2));
        }

        // Processar e mapear anúncios com validação e fallback
        const adsToInsert = ads
          .filter((ad: any) => {
            // Validar que temos ao menos page_name
            const hasPageName = ad.pageName || ad.page_name;
            if (!hasPageName) {
              console.warn('⚠️ Anúncio ignorado: sem page_name', ad);
            }
            return hasPageName;
          })
          .map((ad: any) => {
            // Tentar múltiplos campos para ad_id
            const adId = ad.adArchiveID || ad.ad_id || ad.id || ad.adID || ad.archiveID;
            
            // Se ainda for NULL, gerar ID único baseado em campos disponíveis
            const pageName = ad.pageName || ad.page_name || 'unknown';
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const finalAdId = adId || `generated_${pageName}_${timestamp}_${randomId}`;
            
            if (!adId) {
              console.warn(`⚠️ ad_id não encontrado para ${pageName}, usando ID gerado: ${finalAdId}`);
            }
            
            return {
              search_keyword: keyword.toLowerCase(),
              search_niche: niche,
              ad_id: finalAdId,  // Garantido não-NULL
              ad_name: ad.adName || ad.ad_creative_body || null,
              page_name: pageName,
              page_id: ad.pageID || ad.page_id || null,
              image_urls: ad.snapshot?.images ? JSON.stringify(ad.snapshot.images) : (ad.images ? JSON.stringify(ad.images) : null),
              video_url: ad.snapshot?.videos?.[0] || ad.videoURL || null,
              thumbnail_url: ad.snapshot?.thumbnail || ad.thumbnailURL || null,
              ad_copy: ad.adText || ad.ad_creative_body || ad.text || null,
              cta_text: ad.ctaText || ad.cta_text || null,
              link_url: ad.linkURL || ad.ad_snapshot_url || null,
              started_running_date: ad.startDate || ad.ad_delivery_start_time || null,
              platform_positions: ad.platforms ? JSON.stringify(ad.platforms) : (ad.publisher_platforms ? JSON.stringify(ad.publisher_platforms) : null),
              ad_format: ad.mediaType || (ad.snapshot?.videos?.length > 0 ? 'video' : 'image'),
              company_id: null,
              is_active: true,
              scraped_at: new Date().toISOString()
            };
          });
        
        // Salvar no cache COM tratamento de erro
        if (adsToInsert.length > 0) {
          console.log(`💾 Salvando ${adsToInsert.length} anúncios no cache...`);
          
          const { data: insertedAds, error: cacheError } = await supabaseAdmin
            .from('competitor_ads_cache')
            .upsert(adsToInsert, {
              onConflict: 'ad_id,search_keyword',
              ignoreDuplicates: false
            })
            .select();
          
          if (cacheError) {
            console.error('❌ Erro ao salvar no cache:', cacheError);
          } else {
            console.log(`✅ ${insertedAds?.length || 0} anúncios salvos no cache com sucesso`);
          }
        }
        
        // Marcar como completed
        await supabaseAdmin
          .from('competitor_search_history')
          .update({
            search_status: 'completed',
            total_ads_found: adsToInsert.length,
            completed_at: new Date().toISOString(),
            cache_expires_at: new Date(Date.now() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', searchHistory.id);
        
        // Retornar ads direto
        return new Response(JSON.stringify({
          success: true,
          source: 'new_search',
          ads: adsToInsert,
          total: adsToInsert.length,
          message: 'Anúncios coletados com sucesso (modo síncrono)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Se não completou, retornar runId para polling
    return new Response(JSON.stringify({
      success: true,
      message: 'Busca iniciada, use polling para acompanhar',
      searchId: searchHistory.id,
      runId,
      status: 'processing',
      estimatedTime: '45-90 segundos'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
