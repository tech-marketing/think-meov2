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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current token info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('meta_access_token, meta_token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.meta_access_token) {
      throw new Error('No Meta token found');
    }

    // Check if token is still valid (within 7 days of expiry)
    const expiresAt = new Date(profile.meta_token_expires_at);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (expiresAt > sevenDaysFromNow) {
      return new Response(
        JSON.stringify({ success: true, message: 'Token is still valid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange short-lived token for long-lived token
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');

    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta App credentials not configured');
    }

    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&` +
      `fb_exchange_token=${profile.meta_access_token}`;

    const exchangeResponse = await fetch(exchangeUrl);
    const exchangeData = await exchangeResponse.json();

    if (!exchangeResponse.ok || !exchangeData.access_token) {
      console.error('Token refresh failed:', exchangeData);
      throw new Error('Failed to refresh token');
    }

    const newAccessToken = exchangeData.access_token;
    const expiresIn = exchangeData.expires_in || 5183944; // ~60 days default
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Update token in database
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        meta_access_token: newAccessToken,
        meta_token_expires_at: newExpiresAt.toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    console.log('Successfully refreshed Meta token for user:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Token refreshed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
