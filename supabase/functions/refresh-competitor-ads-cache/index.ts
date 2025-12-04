import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeywordToRefresh {
  id: string;
  keyword: string;
  company_id: string;
  last_updated: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting weekly competitor ads cache refresh');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Find all keywords with cache older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: keywordsToRefresh, error: fetchError } = await supabase
      .from('competitor_search_cache')
      .select('id, keyword, company_id, last_updated')
      .lt('last_updated', sevenDaysAgo.toISOString())
      .order('last_updated', { ascending: true })
      .limit(1500); // Process max 50 keywords per run to avoid timeout

    if (fetchError) {
      console.error('❌ Error fetching keywords:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch keywords', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!keywordsToRefresh || keywordsToRefresh.length === 0) {
      console.log('✅ No keywords need refresh at this time');
      return new Response(
        JSON.stringify({ message: 'No keywords need refresh', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${keywordsToRefresh.length} keywords to refresh`);

    const results = {
      total: keywordsToRefresh.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ keyword: string; error: string }>,
    };

    // Process each keyword
    for (const item of keywordsToRefresh as KeywordToRefresh[]) {
      try {
        console.log(`🔍 Refreshing keyword: "${item.keyword}" (company: ${item.company_id})`);

        // Call the scrape-competitor-ads function with forceRefresh
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
          'scrape-competitor-ads',
          {
            body: {
              keyword: item.keyword,
              companyId: item.company_id,
              forceRefresh: true,
            },
          }
        );

        if (scrapeError) {
          console.error(`❌ Failed to refresh "${item.keyword}":`, scrapeError);
          results.failed++;
          results.errors.push({
            keyword: item.keyword,
            error: scrapeError.message || 'Unknown error',
          });
          continue;
        }

        console.log(`✅ Successfully refreshed "${item.keyword}"`);
        results.success++;

        // Small delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Exception refreshing "${item.keyword}":`, error);
        results.failed++;
        results.errors.push({
          keyword: item.keyword,
          error: error instanceof Error ? error.message : 'Unknown exception',
        });
      }
    }

    console.log('📊 Refresh complete:', results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Fatal error in refresh-competitor-ads-cache:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
