import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { searchId, keyword } = await req.json();
    
    console.log(`🔧 Manual finalization requested for searchId: ${searchId}, keyword: ${keyword}`);

    // Find the search history entry
    let searchHistory;
    if (searchId) {
      const { data, error } = await supabaseClient
        .from('competitor_search_history')
        .select('*')
        .eq('id', searchId)
        .single();
      
      if (error || !data) {
        throw new Error(`Search history not found for ID: ${searchId}`);
      }
      searchHistory = data;
    } else if (keyword) {
      const { data, error } = await supabaseClient
        .from('competitor_search_history')
        .select('*')
        .eq('search_keyword', keyword.toLowerCase())
        .eq('search_status', 'processing')
        .order('searched_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        throw new Error(`No processing search found for keyword: ${keyword}`);
      }
      searchHistory = data;
    } else {
      throw new Error('Either searchId or keyword must be provided');
    }

    console.log(`📋 Found search history:`, searchHistory);

    const metadata = searchHistory.metadata || {};
    const runId = metadata.runId;

    if (!runId) {
      throw new Error('No runId found in search history metadata');
    }

    // Fetch run details from Apify
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    console.log(`🔍 Fetching Apify run details for: ${runId}`);

    const runResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!runResponse.ok) {
      throw new Error(`Failed to fetch run details: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runStatus = runData.data.status;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`📊 Run status: ${runStatus}, dataset: ${datasetId}`);

    if (runStatus !== 'SUCCEEDED') {
      // Update search history with current status
      await supabaseClient
        .from('competitor_search_history')
        .update({
          search_status: runStatus === 'FAILED' ? 'failed' : 'processing',
          error_message: runStatus === 'FAILED' ? 'Apify run failed' : null,
          completed_at: runStatus === 'FAILED' ? new Date().toISOString() : null
        })
        .eq('id', searchHistory.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Run is not completed yet. Status: ${runStatus}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch dataset items
    console.log(`📡 Fetching dataset items...`);

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&clean=true`
    );

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch dataset items: ${itemsResponse.status}`);
    }

    const items = await itemsResponse.json();
    console.log(`📦 Fetched ${items.length} items`);

    // Process and cache items
    const adsToInsert = items.map((item: any) => ({
      ad_id: item.adId || `ad_${Date.now()}_${Math.random()}`,
      ad_name: item.adName,
      page_name: item.pageName,
      page_id: item.pageId,
      ad_format: item.adFormat,
      ad_copy: item.adCopy,
      cta_text: item.ctaText,
      link_url: item.linkUrl,
      image_urls: item.imageUrls || [],
      video_url: item.videoUrl,
      thumbnail_url: item.thumbnailUrl || (item.imageUrls && item.imageUrls[0]),
      started_running_date: item.startedRunningDate,
      platform_positions: item.platformPositions || [],
      search_keyword: searchHistory.search_keyword,
      search_niche: searchHistory.search_niche,
      company_id: searchHistory.company_id,
      scraped_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      is_active: true
    }));

    if (adsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('competitor_ads_cache')
        .upsert(adsToInsert, {
          onConflict: 'ad_id,search_keyword,company_id',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('❌ Error caching ads:', insertError);
        throw insertError;
      }

      console.log(`✅ Cached ${adsToInsert.length} ads successfully`);
    }

    // Update search history as completed
    const { error: updateError } = await supabaseClient
      .from('competitor_search_history')
      .update({
        search_status: 'completed',
        completed_at: new Date().toISOString(),
        total_ads_found: items.length
      })
      .eq('id', searchHistory.id);

    if (updateError) {
      console.error('❌ Error updating search history:', updateError);
      throw updateError;
    }

    console.log('✅ Search finalized successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Search finalized successfully',
        adsCount: items.length,
        data: adsToInsert
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in finalize-competitor-search:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
