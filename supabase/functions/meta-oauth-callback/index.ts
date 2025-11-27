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
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const APP_URL = Deno.env.get('APP_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta App credentials not configured');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Meta OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${APP_URL}/meta-analysis?meta_error=${encodeURIComponent(error)}`,
        },
      });
    }

    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Extract user_id from state
    const userId = state;
    if (!userId) {
      throw new Error('No user ID in state');
    }

    // Exchange code for access token
    const redirectUri = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${META_APP_SECRET}&` +
      `code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      throw new Error('Failed to exchange code for token');
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5183944; // ~60 days default

    // Get Meta user info
    const userInfoUrl = `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok || !userInfo.id) {
      console.error('Failed to get user info:', userInfo);
      throw new Error('Failed to get Meta user info');
    }

    // Store token in database
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        meta_access_token: accessToken,
        meta_token_expires_at: expiresAt.toISOString(),
        meta_user_id: userInfo.id,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw updateError;
    }

    console.log('Successfully connected Meta account for user:', userId);

    // Redirect back to app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${APP_URL}/meta-analysis?meta_connected=true`,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const APP_URL = Deno.env.get('APP_URL');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${APP_URL}/meta-analysis?meta_error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
