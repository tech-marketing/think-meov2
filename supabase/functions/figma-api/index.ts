import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = 'https://oprscgxsfldzydbrbioz.supabase.co';
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const THUMBNAIL_BATCH_SIZE = 50;

// Helper to refresh Figma token if expired
async function refreshFigmaToken(supabaseAdmin: any, userId: string, refreshToken: string): Promise<string | null> {
  const FIGMA_CLIENT_ID = Deno.env.get('FIGMA_OAUTH_CLIENT_ID');
  const FIGMA_CLIENT_SECRET = Deno.env.get('FIGMA_OAUTH_CLIENT_SECRET');

  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) {
    console.error('Missing Figma credentials for token refresh');
    return null;
  }

  try {
    console.log('Refreshing Figma token for user:', userId);
    
    const response = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        refresh_token: refreshToken.trim(),
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error('Token refresh failed:', data);
      return null;
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

    // Update tokens in database
    await supabaseAdmin
      .from('profiles')
      .update({
        figma_access_token: data.access_token,
        figma_refresh_token: data.refresh_token || refreshToken,
        figma_token_expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId);

    console.log('Token refreshed successfully');
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Get valid Figma token (refresh if needed)
async function getValidFigmaToken(supabaseAdmin: any, userId: string): Promise<{ token: string | null; error?: string }> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('figma_access_token, figma_refresh_token, figma_token_expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    return { token: null, error: 'Profile not found' };
  }

  if (!profile.figma_access_token) {
    return { token: null, error: 'Figma not connected' };
  }

  // Check if token expiration is unknown (requires reconnection)
  if (!profile.figma_token_expires_at) {
    console.log('Token expiration unknown, user needs to reconnect');
    return { token: null, error: 'Token inválido - reconecte sua conta do Figma' };
  }

  // Check if token is expired
  const expiresAt = new Date(profile.figma_token_expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt.getTime() - bufferTime < now.getTime()) {
    console.log('Token expired or expiring soon, refreshing...');
    if (profile.figma_refresh_token) {
      const newToken = await refreshFigmaToken(supabaseAdmin, userId, profile.figma_refresh_token);
      if (newToken) {
        return { token: newToken };
      }
    }
    return { token: null, error: 'Token expired and refresh failed' };
  }

  return { token: profile.figma_access_token };
}

// Make Figma API request
async function figmaRequest(token: string, endpoint: string): Promise<any> {
  const response = await fetch(`https://api.figma.com/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Check for scope/permission errors (403)
    if (response.status === 403 && (errorText.includes('scope') || errorText.includes('permission'))) {
      const scopeError = new Error('SCOPE_INSUFFICIENT');
      (scopeError as any).requiresReconnect = true;
      throw scopeError;
    }
    
    throw new Error(`Figma API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Extract frames from Figma document
function extractFrames(document: any): any[] {
  const frames: any[] = [];
  
  function traverse(node: any, pageName: string) {
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      frames.push({
        id: node.id,
        name: node.name,
        type: node.type,
        pageName,
        width: node.absoluteBoundingBox?.width,
        height: node.absoluteBoundingBox?.height,
      });
    }
    
    // Only traverse direct children of pages (not nested frames)
    if (node.type === 'CANVAS' && node.children) {
      node.children.forEach((child: any) => traverse(child, node.name));
    }
  }

  if (document.children) {
    document.children.forEach((page: any) => traverse(page, page.name));
  }

  return frames;
}

async function getCachedFile(
  supabaseAdmin: any,
  userId: string,
  fileKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from('figma_file_history')
    .select('file_name,file_url,thumbnail_url,frames_cache,cached_at')
    .eq('user_id', userId)
    .eq('file_key', fileKey)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cached file:', error);
    return null;
  }

  if (!data?.frames_cache || !data.cached_at) {
    return null;
  }

  const cachedAt = new Date(data.cached_at).getTime();
  if (Date.now() - cachedAt > HISTORY_CACHE_TTL_MS) {
    return null;
  }

  return {
    file: {
      key: fileKey,
      name: data.file_name,
      thumbnailUrl: data.thumbnail_url,
      url: data.file_url,
    },
    frames: data.frames_cache,
  };
}

async function upsertHistory(
  supabaseAdmin: any,
  params: {
    userId: string;
    fileKey: string;
    fileName: string;
    fileUrl: string;
    thumbnailUrl?: string | null;
    frames?: any[];
  },
) {
  try {
    const payload: Record<string, unknown> = {
      user_id: params.userId,
      file_key: params.fileKey,
      file_name: params.fileName,
      file_url: params.fileUrl,
      thumbnail_url: params.thumbnailUrl || null,
      last_used_at: new Date().toISOString(),
    };

    if (params.frames) {
      payload.frames_cache = params.frames;
      payload.cached_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('figma_file_history')
      .upsert(payload, {
        onConflict: 'user_id,file_key',
      });

    if (error) {
      console.error('Error saving to file history:', error);
    }
  } catch (error) {
    console.error('Error in file history upsert:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid user');
    }

    const body = await req.json();
    const { action, fileKey, nodeIds, frames: framesPayload } = body;

    console.log('Figma API action:', action, 'user:', user.id);

    // Handle disconnect separately (doesn't need valid Figma token)
    if (action === 'disconnect') {
      console.log('Disconnecting Figma for user:', user.id);
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          figma_access_token: null,
          figma_refresh_token: null,
          figma_token_expires_at: null,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error disconnecting Figma:', updateError);
        throw new Error('Falha ao desconectar conta do Figma');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Figma desconectado com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get-file-history separately (doesn't need Figma token)
    if (action === 'get-file-history') {
      const { data: history, error: historyError } = await supabaseAdmin
        .from('figma_file_history')
        .select('id,file_key,file_name,file_url,thumbnail_url,last_used_at')
        .eq('user_id', user.id)
        .order('last_used_at', { ascending: false })
        .limit(20);

      if (historyError) {
        console.error('Error fetching file history:', historyError);
        return new Response(
          JSON.stringify({ success: true, history: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, files: history || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid Figma token for other actions
    const { token: figmaToken, error: tokenError } = await getValidFigmaToken(supabaseAdmin, user.id);

    if (tokenError || !figmaToken) {
      return new Response(
        JSON.stringify({ error: tokenError || 'Figma not connected', requiresAuth: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'get-user': {
        const userData = await figmaRequest(figmaToken, '/me');
        return new Response(
          JSON.stringify({ success: true, user: userData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-file-from-url': {
        // Extract file key from Figma URL
        const { figmaUrl } = body;
        if (!figmaUrl) {
          throw new Error('figmaUrl is required');
        }

        // Match URLs like:
        // https://www.figma.com/design/AbCdEf123/Name
        // https://www.figma.com/file/AbCdEf123/Name
        // https://figma.com/design/AbCdEf123/Name
        const match = figmaUrl.match(/figma\.com\/(design|file)\/([a-zA-Z0-9]+)/);
        if (!match) {
          throw new Error('URL do Figma inválida. Cole uma URL como: https://www.figma.com/design/...');
        }

        const extractedFileKey = match[2];
        console.log('Extracted file key from URL:', extractedFileKey);

        const cached = await getCachedFile(supabaseAdmin, user.id, extractedFileKey);
        if (cached) {
          await upsertHistory(supabaseAdmin, {
            userId: user.id,
            fileKey: extractedFileKey,
            fileName: cached.file.name,
            fileUrl: cached.file.url,
            thumbnailUrl: cached.file.thumbnailUrl,
          });

          return new Response(
            JSON.stringify({
              success: true,
              file: {
                key: extractedFileKey,
                name: cached.file.name,
                thumbnailUrl: cached.file.thumbnailUrl,
              },
              frames: cached.frames,
              cached: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Get file info
        const fileData = await figmaRequest(figmaToken, `/files/${extractedFileKey}?depth=2`);
        const frames = extractFrames(fileData.document);

        // Fetch thumbnails for all frames in batches of 50
        if (frames.length > 0) {
          try {
            for (let i = 0; i < frames.length; i += THUMBNAIL_BATCH_SIZE) {
              const batch = frames.slice(i, i + THUMBNAIL_BATCH_SIZE);
              const nodeIds = batch.map((f: any) => f.id).join(',');

              const thumbnailsData = await figmaRequest(
                figmaToken,
                `/images/${extractedFileKey}?ids=${encodeURIComponent(nodeIds)}&format=png&scale=0.25`
              );

              if (thumbnailsData?.images) {
                batch.forEach((frame: any) => {
                  frame.thumbnailUrl = thumbnailsData.images[frame.id] || null;
                });
              }
            }
          } catch (thumbnailError) {
            console.error('Error fetching thumbnails:', thumbnailError);
          }
        }

        // Save to file history (UPSERT)
        await upsertHistory(supabaseAdmin, {
          userId: user.id,
          fileKey: extractedFileKey,
          fileName: fileData.name,
          fileUrl: figmaUrl,
          thumbnailUrl: fileData.thumbnailUrl || null,
          frames,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            file: {
              key: extractedFileKey,
              name: fileData.name,
              thumbnailUrl: fileData.thumbnailUrl
            },
            frames 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-file-frames': {
        if (!fileKey) {
          throw new Error('fileKey is required');
        }
        
        // Get file structure
        const fileData = await figmaRequest(figmaToken, `/files/${fileKey}?depth=2`);
        const frames = extractFrames(fileData.document);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            fileName: fileData.name,
            thumbnailUrl: fileData.thumbnailUrl,
            frames 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'export-frames': {
        const idsSource: string[] =
          Array.isArray(nodeIds) && nodeIds.length > 0
            ? nodeIds
            : Array.isArray(framesPayload)
              ? framesPayload.map((frame: any) => frame.id)
              : [];

        if (!fileKey || idsSource.length === 0) {
          throw new Error('fileKey and frames are required');
        }

        const nameById = new Map<string, string>();
        if (Array.isArray(framesPayload)) {
          framesPayload.forEach((frame: any) => {
            if (frame?.id) {
              nameById.set(frame.id, frame.name || frame.id);
            }
          });
        }

        // Export frames as PNG
        const ids = idsSource.join(',');
        const exportData = await figmaRequest(
          figmaToken, 
          `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`
        );

        if (!exportData.images) {
          throw new Error('Failed to export frames');
        }

        // Download images and upload to GCS
        const GCS_BUCKET = Deno.env.get('GCS_BUCKET_NAME');
        const GCS_KEY = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY');

        if (!GCS_BUCKET || !GCS_KEY) {
          throw new Error('GCS not configured');
        }

        const results: { nodeId: string; url: string; name: string }[] = [];
        const serviceAccount = JSON.parse(GCS_KEY);

        for (const [nodeId, imageUrl] of Object.entries(exportData.images)) {
          if (!imageUrl) continue;

          try {
            console.log('Downloading frame:', nodeId);
            
            // Download image from Figma
            const imageResponse = await fetch(imageUrl as string);
            if (!imageResponse.ok) {
              console.error('Failed to download image:', nodeId);
              continue;
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            const imageData = new Uint8Array(imageBuffer);

            // Generate unique filename
            const timestamp = Date.now();
            const safeNodeId = nodeId.replace(/[^a-zA-Z0-9-_]/g, '_');
            const fileName = `figma/${user.id}/${timestamp}_${safeNodeId}.png`;

            // Upload to GCS
            const accessToken = await getGCSAccessToken(serviceAccount);
            const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

            const uploadResponse = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'image/png',
              },
              body: imageData,
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.text();
              console.error('GCS upload failed:', error);
              continue;
            }

            // Make file public
            await fetch(
              `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(fileName)}/acl`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  entity: 'allUsers',
                  role: 'READER',
                }),
              }
            );

            const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
            results.push({ nodeId, url: publicUrl, name: nameById.get(nodeId) || safeNodeId });
            
            console.log('Uploaded frame:', nodeId, '→', publicUrl);
          } catch (err) {
            console.error('Error processing frame:', nodeId, err);
          }
        }

        return new Response(
          JSON.stringify({ success: true, frames: results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Figma API error:', error);
    
    // Handle scope insufficient error - requires reconnection
    if (error.message === 'SCOPE_INSUFFICIENT' || (error as any).requiresReconnect) {
      return new Response(
        JSON.stringify({ 
          error: 'Permissões insuficientes - reconecte sua conta do Figma', 
          requiresAuth: true 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions for GCS authentication
async function getGCSAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await signJWT(serviceAccount);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to get GCS access token');
  }
  
  return data.access_token;
}

async function signJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = serviceAccount.private_key;
  const pemContents = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${signatureInput}.${encodedSignature}`;
}
