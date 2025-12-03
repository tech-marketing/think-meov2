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

    const CUSTOM_EVENT_ACTION_MAP: Record<string, string> = {
      LEAD: 'lead',
      LEAD_FORM: 'lead',
      PURCHASE: 'purchase',
      OFFSITE_CONVERSION: 'purchase',
      VIEW_CONTENT: 'view_content',
      ADD_TO_CART: 'add_to_cart',
      ADD_PAYMENT_INFO: 'add_payment_info',
      LANDING_PAGE_VIEW: 'landing_page_view',
      SUBSCRIBE: 'subscribe',
      COMPLETE_REGISTRATION: 'complete_registration',
      SUBMIT_APPLICATION: 'submit_application',
      CONTACT: 'contact',
      APP_INSTALL: 'app_install'
    };

    const OBJECTIVE_ACTION_MAP: Record<string, string> = {
      LEAD_GENERATION: 'lead',
      OUTCOME_LEADS: 'onsite_conversion.lead_grouped',
      OUTCOME_SALES: 'purchase',
      OUTCOME_PURCHASE_INTENT: 'purchase',
      CONVERSIONS: 'onsite_conversion.purchase',
      OUTCOME_TRAFFIC: 'landing_page_view',
      TRAFFIC: 'landing_page_view',
      LINK_CLICKS: 'link_click',
      OUTCOME_ENGAGEMENT: 'post_engagement',
      MESSAGES: 'onsite_conversion.messaging_first_reply',
      CATALOG_SALES: 'purchase',
      SALES: 'purchase',
      APP_PROMOTION: 'app_install'
    };

    const sumValues = (items: any[], predicate: (item: any) => boolean, parser: (value: any) => number) => {
      if (!items || !Array.isArray(items)) return 0;
      return items
        .filter(predicate)
        .reduce((sum: number, item: any) => sum + parser(item?.value), 0);
    };

    const getActionValue = (actions: any[], actionType: string): number => {
      return sumValues(actions, (item) => item.action_type === actionType, (value) => parseInt(value || '0'));
    };

    const getCostPerActionValue = (costActions: any[], actionType: string): number => {
      if (!costActions || !Array.isArray(costActions)) return 0;
      const costEntry = costActions.find((a: any) => a.action_type === actionType);
      return parseFloat(costEntry?.value || '0');
    };

    const getVideoActionValue = (videoActions: any[], actionType: string): number => {
      return sumValues(videoActions, (item) => item.action_type === actionType, (value) => parseInt(value || '0'));
    };

    const parseResultsValue = (resultsField: any): number => {
      if (!resultsField) return 0;
      if (Array.isArray(resultsField)) {
        return resultsField.reduce((sum, entry) => sum + parseInt(entry?.value || '0'), 0);
      }
      if (typeof resultsField === 'string') {
        return parseInt(resultsField || '0');
      }
      if (typeof resultsField === 'number') {
        return resultsField;
      }
      return 0;
    };

    const determineResultAction = (ad: any): string | null => {
      const customEvent = (ad.promoted_object_custom_event_type || ad.adset_custom_event_type || '').toUpperCase();
      if (customEvent && CUSTOM_EVENT_ACTION_MAP[customEvent]) {
        return CUSTOM_EVENT_ACTION_MAP[customEvent];
      }

      const objective = (ad.campaign_objective || ad.adset_optimization_goal || '').toUpperCase();
      if (objective && OBJECTIVE_ACTION_MAP[objective]) {
        return OBJECTIVE_ACTION_MAP[objective];
      }

      if (objective.includes('LEAD')) return 'lead';
      if (objective.includes('SALE') || objective.includes('PURCHASE')) return 'purchase';
      if (objective.includes('TRAFFIC')) return 'landing_page_view';
      return null;
    };

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
      
      const adsetFields = 'adset{id,name,optimization_goal,destination_type,attribution_spec,effective_status,promoted_object,custom_event_type,promoted_object{custom_event_type}}';
      const campaignFields = 'campaign{id,name,objective}';
      const creativeFields = 'creative{image_url,video_id}';
      const url = `https://graph.facebook.com/v21.0/${normalizedAccountId}/ads?access_token=${ACCESS_TOKEN}${filtering}&fields=id,name,status,${adsetFields},${campaignFields},promoted_object,${creativeFields}&limit=500`;
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
        adset_optimization_goal: ad.adset?.optimization_goal || null,
        adset_destination_type: ad.adset?.destination_type || null,
        adset_custom_event_type: ad.adset?.custom_event_type || ad.adset?.promoted_object?.custom_event_type || null,
        campaign_id: ad.campaign?.id || null,
        campaign_name: ad.campaign?.name || null,
        campaign_objective: ad.campaign?.objective || null,
        creative_id: ad.creative?.id || null,
        image_url: ad.creative?.image_url || null,
        video_id: ad.creative?.video_id || null,
        promoted_object_custom_event_type: ad.promoted_object?.custom_event_type || null
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
            
            // Calculate metrics from various sources
            let conversions = 0;
            let conversionValue = 0;
            let engagements = 0;
            let lpv = 0;
            let thruplays = 0;
            let results = 0;
            const resultActionType = determineResultAction(ad);
            
            if (resultActionType) {
              results = getActionValue(insights.actions, resultActionType);
            }
            
            if (!results) {
              results = parseResultsValue(insights.results);
            }
            
            // Extract conversions and engagements from actions
            if (insights.actions) {
              if (resultActionType) {
                conversions = getActionValue(insights.actions, resultActionType);
              } else {
                conversions =
                  getActionValue(insights.actions, 'lead') +
                  getActionValue(insights.actions, 'purchase') +
                  getActionValue(insights.actions, 'complete_registration') +
                  getActionValue(insights.actions, 'submit_application') +
                  getActionValue(insights.actions, 'contact');
              }

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
              results: results,
              cost_per_result: results > 0 ? spend / results : 0,
              conversions: conversions || results,
              conversion_rate: linkClicks > 0 ? ((results || conversions) / linkClicks) * 100 : 0,
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
