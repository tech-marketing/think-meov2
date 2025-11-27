import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { runId, searchId } = await req.json();
    
    if (!runId && !searchId) {
      throw new Error('runId ou searchId é obrigatório');
    }

    console.log(`🔍 Polling: runId=${runId}, searchId=${searchId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Se só temos searchId, buscar runId do histórico
    let actualRunId = runId;
    if (!actualRunId && searchId) {
      const { data: history } = await supabase
        .from('competitor_search_history')
        .select('metadata')
        .eq('id', searchId)
        .single();
      
      actualRunId = history?.metadata?.runId;
      
      if (!actualRunId) {
        throw new Error('runId não encontrado no histórico');
      }
    }

    // Buscar status do run no Apify
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    
    console.log(`📥 Buscando status do run ${actualRunId}...`);
    const runResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${actualRunId}?token=${APIFY_API_TOKEN}`
    );

    if (!runResponse.ok) {
      throw new Error(`Erro ao buscar status do Apify: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const status = runData.data.status;

    console.log(`📊 Status do run: ${status}`);

    // Se ainda está processando
    if (status === 'RUNNING' || status === 'READY') {
      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        message: 'Ainda processando...'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se falhou
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      // Marcar como failed no histórico
      if (searchId) {
        await supabase
          .from('competitor_search_history')
          .update({
            search_status: 'failed',
            error_message: `Apify run status: ${status}`
          })
          .eq('id', searchId);
      }

      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        error: `Busca falhou no Apify: ${status}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Se completou (SUCCEEDED)
    if (status === 'SUCCEEDED') {
      console.log('✅ Run completou! Buscando dataset...');
      
      // Buscar dataset
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${actualRunId}/dataset/items?token=${APIFY_API_TOKEN}`
      );

      if (!datasetResponse.ok) {
        throw new Error(`Erro ao buscar dataset: ${datasetResponse.status}`);
      }

      const ads = await datasetResponse.json();
      console.log(`✅ Recebidos ${ads.length} anúncios`);

      // Buscar keyword do histórico
      let keyword = '';
      let niche = '';
      
      if (searchId) {
        const { data: history } = await supabase
          .from('competitor_search_history')
          .select('search_keyword, search_niche')
          .eq('id', searchId)
          .single();
        
        keyword = history?.search_keyword || '';
        niche = history?.search_niche || '';
      }

      // Log da estrutura real dos dados do Apify (primeiro anúncio)
      if (ads.length > 0) {
        console.log('🔍 [Poll] Estrutura do primeiro anúncio do Apify:', JSON.stringify(ads[0], null, 2));
      }

      // Processar e mapear anúncios com validação e fallback
      const adsToInsert = ads
        .filter((ad: any) => {
          // Validar que temos ao menos page_name
          const hasPageName = ad.pageName || ad.page_name;
          if (!hasPageName) {
            console.warn('⚠️ [Poll] Anúncio ignorado: sem page_name', ad);
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
            console.warn(`⚠️ [Poll] ad_id não encontrado para ${pageName}, usando ID gerado: ${finalAdId}`);
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

      // Salvar no cache
      if (adsToInsert.length > 0) {
        const { error: cacheError } = await supabase
          .from('competitor_ads_cache')
          .upsert(adsToInsert, {
            onConflict: 'ad_id,search_keyword'
          });

        if (cacheError) {
          console.error('❌ Erro ao salvar no cache:', cacheError);
        }
      }

      // Atualizar histórico como completed
      if (searchId) {
        await supabase
          .from('competitor_search_history')
          .update({
            search_status: 'completed',
            total_ads_found: adsToInsert.length,
            completed_at: new Date().toISOString(),
            cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', searchId);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        ads: adsToInsert,
        total: adsToInsert.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Status desconhecido
    return new Response(JSON.stringify({
      success: false,
      status: 'unknown',
      error: `Status desconhecido: ${status}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro em poll-competitor-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
