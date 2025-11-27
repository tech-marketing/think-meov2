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

    // Get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile and company
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User company not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Meta access token from secrets
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    if (!META_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Meta access token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Meta data sync for company:', profile.company_id);

    // Get request body for date range
    const { startDate, endDate } = await req.json();
    
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    const end = endDate || new Date().toISOString().split('T')[0]; // today

    console.log(`Syncing data from ${start} to ${end}`);

    // Get business accounts
    const businessResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?access_token=${META_ACCESS_TOKEN}&fields=id,name,owned_ad_accounts{id,name,account_status}`
    );

    if (!businessResponse.ok) {
      const errorData = await businessResponse.json();
      console.error('Error fetching business accounts:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch business data', details: errorData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const businessData = await businessResponse.json();
    console.log('Business data:', businessData);

    let syncedCampaigns = 0;
    let syncedAds = 0;

    // Process each business account
    for (const business of businessData.data || []) {
      console.log(`Processing business: ${business.name} (${business.id})`);
      
      // Process ad accounts for this business
      for (const adAccount of business.owned_ad_accounts?.data || []) {
        if (adAccount.account_status !== 'ACTIVE') {
          console.log(`Skipping inactive ad account: ${adAccount.name}`);
          continue;
        }

        console.log(`Processing ad account: ${adAccount.name} (${adAccount.id})`);
        const cleanAccountId = adAccount.id.replace('act_', '');

        // Sync campaigns for this account
        const campaignsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${adAccount.id}/campaigns?access_token=${META_ACCESS_TOKEN}&fields=id,name,status,objective,created_time&limit=500`
        );

        if (campaignsResponse.ok) {
          const campaignsData = await campaignsResponse.json();
          
          for (const campaign of campaignsData.data || []) {
            // Upsert campaign data
            const { error: campaignError } = await supabaseAdmin
              .from('meta_campaigns')
              .upsert({
                campaign_id: campaign.id,
                account_id: adAccount.id,
                name: campaign.name,
                status: campaign.status,
                objective: campaign.objective,
                created_time: campaign.created_time,
                company_id: profile.company_id
              }, {
                onConflict: 'campaign_id'
              });

            if (campaignError) {
              console.error(`Error saving campaign ${campaign.id}:`, campaignError);
            } else {
              syncedCampaigns++;
            }

            // Get ads for this campaign
            const adsResponse = await fetch(
              `https://graph.facebook.com/v21.0/${adAccount.id}/ads?access_token=${META_ACCESS_TOKEN}&filtering=[{field:"campaign.id",operator:"IN",value:["${campaign.id}"]}]&fields=id,name,status,adset{id,name},campaign{id,name,objective},creative{image_url,video_id}&limit=500`
            );

            if (adsResponse.ok) {
              const adsData = await adsResponse.json();
              
              for (const ad of adsData.data || []) {
                // Upsert ad data
                const { error: adError } = await supabaseAdmin
                  .from('meta_ads')
                  .upsert({
                    ad_id: ad.id,
                    account_id: adAccount.id,
                    campaign_id: campaign.id,
                    adset_id: ad.adset?.id || null,
                    name: ad.name,
                    status: ad.status,
                    adset_name: ad.adset?.name || null,
                    campaign_name: campaign.name,
                    campaign_objective: campaign.objective,
                    creative_id: ad.creative?.id || null,
                    image_url: ad.creative?.image_url || null,
                    video_id: ad.creative?.video_id || null,
                    company_id: profile.company_id
                  }, {
                    onConflict: 'ad_id'
                  });

                if (adError) {
                  console.error(`Error saving ad ${ad.id}:`, adError);
                } else {
                  syncedAds++;
                }

                // Get insights for this ad
                const insightsResponse = await fetch(
                  `https://graph.facebook.com/v21.0/${ad.id}/insights?access_token=${META_ACCESS_TOKEN}&time_range={'since':'${start}','until':'${end}'}&fields=impressions,reach,clicks,ctr,cpc,spend,actions,action_values,frequency,cpm,cpp,date_start,date_stop&level=ad&time_increment=1`
                );

                if (insightsResponse.ok) {
                  const insightsData = await insightsResponse.json();
                  
                  // Process each day's insights
                  for (const insight of insightsData.data || []) {
                    // Extract conversions from actions array
                    const actions = insight.actions || [];
                    const conversions = actions.reduce((sum: number, action: any) => {
                      if (['purchase', 'lead', 'complete_registration', 'add_to_cart', 'offsite_conversion.fb_pixel_purchase'].includes(action.action_type)) {
                        return sum + (Number(action.value) || 0);
                      }
                      return sum;
                    }, 0);

                    // Calculate ROAS using action_values (revenue) from actions
                    const actionValues = insight.action_values || [];
                    const revenue = actionValues.reduce((sum: number, action: any) => {
                      if (['purchase', 'offsite_conversion.fb_pixel_purchase'].includes(action.action_type)) {
                        return sum + (Number(action.value) || 0);
                      }
                      return sum;
                    }, 0);

                    // Calculate derived metrics
                    const clicks = Number(insight.clicks) || 0;
                    const spend = Number(insight.spend) || 0;
                    const impressions = Number(insight.impressions) || 0;
                    const reach = Number(insight.reach) || 0;
                    
                    const conversion_rate = clicks > 0 ? (conversions / clicks) * 100 : 0;
                    const roas = spend > 0 ? revenue / spend : 0;
                    const cost_per_conversion = conversions > 0 ? spend / conversions : 0;
                    const calculated_ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    const calculated_frequency = reach > 0 ? impressions / reach : 0;

                    // Use calculated values if Meta's values are missing/zero
                    const finalCtr = Number(insight.ctr) || calculated_ctr;
                    const finalFrequency = Number(insight.frequency) || calculated_frequency;

                    // Upsert daily metrics data
                    const { error: metricsError } = await supabaseAdmin
                      .from('meta_ad_metrics')
                      .upsert({
                        ad_id: ad.id,
                        account_id: `act_${cleanAccountId}`,
                        date_start: insight.date_start,
                        date_stop: insight.date_stop,
                        impressions: impressions,
                        clicks: clicks,
                        spend: spend,
                        reach: reach,
                        frequency: finalFrequency,
                        ctr: finalCtr,
                        cpc: Number(insight.cpc) || (clicks > 0 ? spend / clicks : 0),
                        cpm: Number(insight.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0),
                        cpp: Number(insight.cpp) || (reach > 0 ? (spend / reach) * 1000 : 0),
                        conversions: conversions,
                        conversion_rate: conversion_rate,
                        cost_per_conversion: cost_per_conversion,
                        roas: roas,
                        actions: insight.actions || [],
                        company_id: profile.company_id
                      }, {
                        onConflict: 'ad_id,date_start,date_stop'
                      });

                    if (metricsError) {
                      console.error(`Error saving metrics for ad ${ad.id} on ${insight.date_start}:`, metricsError);
                    }
                  }
                } else {
                  const errorText = await insightsResponse.text();
                  console.log(`No insights available for ad ${ad.id}:`, errorText);
                }
              }
            } else {
              console.error(`Failed to fetch ads for campaign ${campaign.id}`);
            }
          }
        } else {
          console.error(`Failed to fetch campaigns for account ${adAccount.id}`);
        }
      }
    }

    console.log(`Sync completed. Campaigns: ${syncedCampaigns}, Ads: ${syncedAds}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: {
          accounts: businessData.data?.length || 0,
          campaigns: syncedCampaigns,
          ads: syncedAds
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-meta-data:', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});