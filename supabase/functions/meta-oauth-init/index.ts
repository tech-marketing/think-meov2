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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!META_APP_ID) {
      throw new Error('Meta App ID not configured');
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Construct OAuth URL
    const callbackUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback`;
    const scope = encodeURIComponent("ads_read,business_management,read_insights");
    const state = user.id; // Use user ID as state

    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${META_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `response_type=code`;

    return new Response(
      JSON.stringify({ success: true, oauth_url: oauthUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth init error:', error);
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
