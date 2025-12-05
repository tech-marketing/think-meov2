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
    const FIGMA_CLIENT_ID = Deno.env.get('FIGMA_OAUTH_CLIENT_ID');
    const FIGMA_CLIENT_SECRET = Deno.env.get('FIGMA_OAUTH_CLIENT_SECRET');
    const FIGMA_REDIRECT_URI = Deno.env.get('FIGMA_OAUTH_REDIRECT_URI');
    const APP_URL = Deno.env.get('FIGMA_AUTH_SUCCESS_URL') || Deno.env.get('APP_URL');
    
    const supabaseUrl = 'https://oprscgxsfldzydbrbioz.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;

    if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET || !FIGMA_REDIRECT_URI) {
      throw new Error('Figma OAuth credentials not configured');
    }

    if (!supabaseServiceKey) {
      throw new Error('SERVICE_ROLE_KEY not configured');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Figma OAuth callback received:', { code: !!code, state: !!state, error });

    if (error) {
      console.error('Figma OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${APP_URL}?figma_error=${encodeURIComponent(error)}`,
        },
      });
    }

    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Extract user_id from state
    const userId = state ? decodeURIComponent(state) : null;
    if (!userId) {
      throw new Error('No user ID in state');
    }

    console.log('Exchanging code for token for user:', userId);

    // Exchange code for access token
    console.log('Exchanging code for token with Figma API...');
    const tokenResponse = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        redirect_uri: FIGMA_REDIRECT_URI,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      throw new Error('Failed to exchange code for token');
    }

    console.log('Token exchange successful, expires_in:', tokenData.expires_in);

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 7200; // Default 2 hours

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Store tokens in profiles table
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        figma_access_token: accessToken,
        figma_refresh_token: refreshToken,
        figma_token_expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw updateError;
    }

    console.log('Successfully connected Figma account for user:', userId);

    // Redirect back to app with success
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${APP_URL}?figma_connected=true`,
      },
    });
  } catch (error) {
    console.error('Figma OAuth callback error:', error);
    const APP_URL = Deno.env.get('FIGMA_AUTH_SUCCESS_URL') || Deno.env.get('APP_URL');
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${APP_URL}?figma_error=${encodeURIComponent(error.message)}`,
      },
    });
  }
});
