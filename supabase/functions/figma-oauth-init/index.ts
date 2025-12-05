import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const FIGMA_REDIRECT_URI = Deno.env.get('FIGMA_OAUTH_REDIRECT_URI');

    if (!FIGMA_CLIENT_ID || !FIGMA_REDIRECT_URI) {
      console.error('Missing Figma OAuth configuration');
      throw new Error('Figma OAuth not configured');
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Decode JWT to get user ID (token is already validated by Supabase Edge Runtime)
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payloadBase64 = parts[1];
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    
    const userId = payload.sub;
    if (!userId) {
      throw new Error('No user ID found in JWT');
    }

    console.log('Generating Figma OAuth URL for user:', userId);

    // Figma OAuth URL with state containing user_id
    const state = encodeURIComponent(userId);
    const scope = 'file_content:read,current_user:read';
    
    const oauthUrl = `https://www.figma.com/oauth?` +
      `client_id=${FIGMA_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(FIGMA_REDIRECT_URI)}&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `response_type=code`;

    console.log('OAuth URL generated successfully');

    return new Response(
      JSON.stringify({ success: true, oauth_url: oauthUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Figma OAuth init error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
