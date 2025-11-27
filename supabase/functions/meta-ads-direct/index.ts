import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to normalize account ID for Meta API
function normalizeAccountId(accountId: string): string {
  if (!accountId) return accountId;
  return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
}

serve(async (req) => {
  console.log('🚀 Meta Ads Direct Edge Function iniciada');
  console.log('🚀 Método da requisição:', req.method);
  console.log('🚀 URL da requisição:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Respondendo requisição OPTIONS (CORS)');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📋 Tentando fazer parse do JSON da requisição...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No authorization header provided'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid user token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ User authenticated:', user.id);

    // Get user's Meta token from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('meta_access_token, meta_token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.meta_access_token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Meta account not connected',
        message: 'Please connect your Meta account first'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired
    const expiresAt = new Date(profile.meta_token_expires_at);
    if (expiresAt < new Date()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Meta token expired',
        message: 'Please reconnect your Meta account'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ACCESS_TOKEN = profile.meta_access_token;
    console.log('✅ Token Meta do usuário encontrado, comprimento:', ACCESS_TOKEN.length);
    
    const requestBody = await req.json();
    console.log('📋 Corpo da requisição recebido:', JSON.stringify(requestBody, null, 2));
    
    const { action } = requestBody;
    console.log(`📊 Action solicitada: ${action}`);

    let result;

    if (action === 'validate') {
      console.log('🔐 Validando token Meta...');
      
      const response = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${ACCESS_TOKEN}`);
      const data = await response.json();
      
      console.log('🔐 Status da validação:', response.status);
      console.log('🔐 Resposta da validação:', data);
      
      if (!response.ok) {
        console.error('❌ Erro na validação do token:', data.error);
        throw new Error(data.error?.message || 'Token validation failed');
      }
      
      result = { valid: true, user: data };
      
    } else if (action === 'accounts') {
      console.log('📋 Buscando contas de anúncios...');
      
      const url = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${ACCESS_TOKEN}&fields=id,account_id,name,currency,timezone_name,account_status`;
      console.log('📋 URL da chamada (token oculto):', url.replace(ACCESS_TOKEN, '[TOKEN_HIDDEN]'));
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📋 Status da resposta:', response.status);
      console.log('📋 Dados recebidos:', data);
      
      if (!response.ok) {
        console.error('❌ Erro da Meta API:', data.error);
        throw new Error(data.error?.message || 'Failed to fetch accounts');
      }
      
      const accounts = (data.data || []).map((account: any) => ({
        id: account.id,
        account_id: account.account_id || account.id,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
        status: account.account_status
      }));
      
      console.log(`✅ Encontradas ${accounts.length} contas:`, accounts);
      result = accounts;
      
    } else if (action === 'campaigns') {
      console.log('📋 Buscando campanhas...');
      
      const { accountId } = requestBody;
      if (!accountId) {
        throw new Error('accountId é obrigatório para buscar campanhas');
      }
      
      const normalizedAccountId = normalizeAccountId(accountId);
      console.log(`📋 Account ID normalizado: ${accountId} -> ${normalizedAccountId}`);
      
      const url = `https://graph.facebook.com/v21.0/${normalizedAccountId}/campaigns?access_token=${ACCESS_TOKEN}&fields=id,name,status,objective,created_time&limit=500`;
      console.log('📋 URL da chamada (token oculto):', url.replace(ACCESS_TOKEN, '[TOKEN_HIDDEN]'));
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📋 Status da resposta:', response.status);
      console.log('📋 Dados recebidos:', data);
      
      if (!response.ok) {
        console.error('❌ Erro da Meta API:', data.error);
        throw new Error(data.error?.message || 'Failed to fetch campaigns');
      }
      
      const campaigns = (data.data || []).map((campaign: any) => ({
        id: campaign.id,
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        created_at: campaign.created_time
      }));
      
      console.log(`✅ Encontradas ${campaigns.length} campanhas:`, campaigns);
      result = campaigns;
      
    } else if (action === 'ads') {
      console.log('📋 Buscando anúncios...');
      
      const { accountId, selectedCampaigns, startDate, endDate } = requestBody;
      if (!accountId) {
        throw new Error('accountId é obrigatório para buscar anúncios');
      }
      
      const normalizedAccountId = normalizeAccountId(accountId);
      console.log(`📋 Account ID normalizado para ads: ${accountId} -> ${normalizedAccountId}`);
      
      let filtering = '';
      if (selectedCampaigns && selectedCampaigns.length > 0) {
        const campaignIds = selectedCampaigns.map((id: string) => `"${id}"`).join(',');
        filtering = `&filtering=[{field:"campaign.id",operator:"IN",value:[${campaignIds}]}]`;
      }
      
      const url = `https://graph.facebook.com/v21.0/${normalizedAccountId}/ads?access_token=${ACCESS_TOKEN}${filtering}&fields=id,name,status,adset{id,name},campaign{id,name,objective},creative{image_url,video_id}&limit=500`;
      console.log('📋 URL da chamada (token oculto):', url.replace(ACCESS_TOKEN, '[TOKEN_HIDDEN]'));
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📋 Status da resposta:', response.status);
      console.log('📋 Dados recebidos:', data);
      
      if (!response.ok) {
        console.error('❌ Erro da Meta API:', data.error);
        throw new Error(data.error?.message || 'Failed to fetch ads');
      }
      
      const ads = (data.data || []).map((ad: any) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        adset_id: ad.adset?.id || null,
        adset_name: ad.adset?.name || null,
        campaign_id: ad.campaign?.id || null,
        campaign_name: ad.campaign?.name || null,
        campaign_objective: ad.campaign?.objective || null,
        creative_id: ad.creative?.id || null,
        image_url: ad.creative?.image_url || null,
        video_id: ad.creative?.video_id || null
      }));
      
      console.log(`✅ Encontrados ${ads.length} anúncios:`, ads);
      
      // Now fetch insights for each ad
      console.log('📊 Buscando insights dos anúncios...');
      const adsWithMetrics = await Promise.all(
        ads.map(async (ad: any) => {
          try {
            const timeRange = startDate && endDate 
              ? `&time_range={"since":"${startDate}","until":"${endDate}"}`
              : '';
            
            console.log(`📊 Buscando insights para anúncio ${ad.id}...`);
            
            const insightsUrl = `https://graph.facebook.com/v21.0/${ad.id}/insights?access_token=${ACCESS_TOKEN}&fields=impressions,reach,spend,actions,cost_per_action_type,video_thruplay_watched_actions,inline_link_clicks,inline_link_click_ctr,cpc,cpm,frequency,results&level=ad${timeRange}`;
            
            const insightsResponse = await fetch(insightsUrl);
            const insightsData = await insightsResponse.json();
            
            if (!insightsResponse.ok || !insightsData?.data || insightsData.data.length === 0) {
              console.warn(`⚠️ Erro ao buscar insights para ${ad.id}:`, insightsData?.error || insightsData);
              return {
                ...ad,
                metrics: {
                  impressions: 0,
                  clicks: 0,
                  ctr: 0,
                  cpc: 0,
                  spend: 0,
                  results: 0,
                  cost_per_result: 0,
                  conversions: 0,
                  conversion_rate: 0,
                  roas: 0,
                  reach: 0,
                  frequency: 0,
                  cpm: 0,
                  cpp: 0,
                  lpv: 0,
                  cost_per_lpv: 0,
                  thruplays: 0,
                  cost_per_thruplay: 0,
                  engagements: 0
                }
              };
            }
            
            const insights = insightsData.data?.[0] || {};
            
            // Helper functions to extract action values
            const getActionValue = (actions: any[], actionType: string): number => {
              if (!actions || !Array.isArray(actions)) return 0;
              const action = actions.find((a: any) => a.action_type === actionType);
              return parseInt(action?.value || '0');
            };

            const getCostPerActionValue = (costActions: any[], actionType: string): number => {
              if (!costActions || !Array.isArray(costActions)) return 0;
              const costAction = costActions.find((a: any) => a.action_type === actionType);
              return parseFloat(costAction?.value || '0');
            };

            const getVideoActionValue = (videoActions: any[], actionType: string): number => {
              if (!videoActions || !Array.isArray(videoActions)) return 0;
              const videoAction = videoActions.find((a: any) => a.action_type === actionType);
              return parseInt(videoAction?.value || '0');
            };
            
            // Calculate metrics from various sources
            let conversions = 0;
            let conversionValue = 0;
            let engagements = 0;
            let lpv = 0;
            let thruplays = 0;
            let results = 0;
            
            // Extract results directly from insights (respects campaign objective)
            if (insights.results && Array.isArray(insights.results)) {
              // Results can be an array like actions
              results = insights.results.reduce((sum: number, result: any) => {
                return sum + (parseInt(result.value || '0'));
              }, 0);
            } else if (typeof insights.results === 'string') {
              // Sometimes it's a direct string value
              results = parseInt(insights.results || '0');
            } else if (typeof insights.results === 'number') {
              // Or a direct number
              results = insights.results;
            }
            
            // Extract conversions and engagements from actions
            if (insights.actions) {
              conversions =
                getActionValue(insights.actions, 'lead') +
                getActionValue(insights.actions, 'purchase') +
                getActionValue(insights.actions, 'complete_registration') +
                getActionValue(insights.actions, 'submit_application') +
                getActionValue(insights.actions, 'contact');

              // LPVs from actions
              lpv = getActionValue(insights.actions, 'landing_page_view');

              // Engagements from multiple post interactions
              engagements =
                getActionValue(insights.actions, 'post_engagement') +
                getActionValue(insights.actions, 'post_reaction') +
                getActionValue(insights.actions, 'comment') +
                getActionValue(insights.actions, 'post_save') +
                getActionValue(insights.actions, 'share') +
                getActionValue(insights.actions, 'like') +
                getActionValue(insights.actions, 'page_engagement');
            }
            
            // Extract thruplays from video actions or actions fallback
            if (insights.video_thruplay_watched_actions) {
              thruplays = getVideoActionValue(insights.video_thruplay_watched_actions, 'video_view')
                || getVideoActionValue(insights.video_thruplay_watched_actions, 'thruplay');
            }
            if (!thruplays && insights.actions) {
              thruplays = getActionValue(insights.actions, 'thruplay') || getActionValue(insights.actions, 'video_view');
            }
            
            const spend = parseFloat(insights.spend) || 0;
            const linkClicks = (parseInt(insights.inline_link_clicks) || getActionValue(insights.actions, 'link_click') || 0);
            const impressions = parseInt(insights.impressions) || 0;
            const reach = parseInt(insights.reach) || 0;
            const cost_per_lpv = getCostPerActionValue(insights.cost_per_action_type || [], 'landing_page_view') || (lpv > 0 ? spend / lpv : 0);
            const cost_per_thruplay = getCostPerActionValue(insights.cost_per_action_type || [], 'video_view') || (thruplays > 0 ? spend / thruplays : 0);
            
            const metrics = {
              impressions,
              clicks: linkClicks,
              ctr: (insights.inline_link_click_ctr ? parseFloat(insights.inline_link_click_ctr) : (impressions > 0 ? (linkClicks / impressions) * 100 : 0)),
              cpc: (insights.cpc ? parseFloat(insights.cpc) : (linkClicks > 0 ? spend / linkClicks : 0)),
              spend,
              results: results, // Use native Meta API results field
              cost_per_result: results > 0 ? spend / results : 0,
              conversions,
              conversion_rate: linkClicks > 0 ? (conversions / linkClicks) * 100 : 0,
              roas: spend > 0 ? conversionValue / spend : 0,
              reach,
              frequency: parseFloat(insights.frequency) || 0,
              cpm: (insights.cpm ? parseFloat(insights.cpm) : (impressions > 0 ? (spend / impressions) * 1000 : 0)),
              cpp: parseFloat(insights.cpp) || 0,
              lpv,
              cost_per_lpv,
              thruplays,
              cost_per_thruplay,
              engagements
            } as const;
            
            console.log(`✅ Insights para ${ad.id}:`, metrics);
            
            return {
              ...ad,
              metrics
            };
            
          } catch (error) {
            console.error(`❌ Erro ao buscar insights para ${ad.id}:`, error);
            return {
              ...ad,
              metrics: {
                impressions: 0,
                clicks: 0,
                ctr: 0,
                cpc: 0,
                spend: 0,
                conversions: 0,
                conversion_rate: 0,
                roas: 0,
                reach: 0,
                frequency: 0,
                cpm: 0,
                cpp: 0
              }
            };
          }
        })
      );
      
      console.log(`✅ Processados ${adsWithMetrics.length} anúncios com métricas`);
      result = adsWithMetrics;
      
    } else if (action === 'daily-insights') {
      console.log('📊 Buscando insights diários...');
      
      const { adId, startDate, endDate } = requestBody;
      if (!adId) {
        throw new Error('adId é obrigatório para buscar insights diários');
      }
      
      const timeRange = startDate && endDate 
        ? `&time_range={"since":"${startDate}","until":"${endDate}"}`
        : '';
      
      console.log(`📊 Buscando insights diários para anúncio ${adId} de ${startDate} até ${endDate}...`);
      
      const insightsUrl = `https://graph.facebook.com/v21.0/${adId}/insights?access_token=${ACCESS_TOKEN}&fields=impressions,reach,spend,actions,cost_per_action_type,inline_link_clicks,inline_link_click_ctr,cpc,cpm,frequency&level=ad&time_increment=1${timeRange}`;
      
      console.log('📊 URL da chamada daily (token oculto):', insightsUrl.replace(ACCESS_TOKEN, '[TOKEN_HIDDEN]'));
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();
      
      console.log('📊 Status da resposta daily:', insightsResponse.status);
      console.log('📊 Dados diários recebidos:', insightsData);
      
      if (!insightsResponse.ok) {
        console.error('❌ Erro da Meta API (daily):', insightsData?.error);
        throw new Error(insightsData?.error?.message || 'Failed to fetch daily insights');
      }
      
      const dailyData = (insightsData.data || []).map((day: any) => ({
        date_start: day.date_start,
        date_stop: day.date_stop,
        impressions: day.impressions || '0',
        reach: day.reach || '0',
        spend: day.spend || '0',
        inline_link_clicks: day.inline_link_clicks || '0',
        inline_link_click_ctr: day.inline_link_click_ctr || '0',
        cpc: day.cpc || '0',
        cpm: day.cpm || '0',
        frequency: day.frequency || '0',
        actions: day.actions ? JSON.stringify(day.actions) : '[]'
      }));
      
      console.log(`✅ Encontrados ${dailyData.length} dias de dados para anúncio ${adId}`);
      result = dailyData;
      
    } else {
      throw new Error(`Action não suportada: ${action}`);
    }

    console.log('✅ Resposta final:', { success: true, data: result });

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na edge function:', error);
    console.error('❌ Stack trace:', (error as Error)?.stack);
    
    const errorResponse = { 
      success: false, 
      error: (error as Error)?.message || 'Unknown error'
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});