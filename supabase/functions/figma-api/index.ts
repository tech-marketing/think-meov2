import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = "https://oprscgxsfldzydbrbioz.supabase.co";

// Helper to refresh Figma token if expired
async function refreshFigmaToken(supabaseAdmin: any, userId: string, refreshToken: string): Promise<string | null> {
  const FIGMA_CLIENT_ID = Deno.env.get("FIGMA_OAUTH_CLIENT_ID");
  const FIGMA_CLIENT_SECRET = Deno.env.get("FIGMA_OAUTH_CLIENT_SECRET");

  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) {
    console.error("Missing Figma credentials for token refresh");
    return null;
  }

  try {
    console.log("Refreshing Figma token for user:", userId);

    const response = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        refresh_token: refreshToken.trim(),
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("Token refresh failed:", data);
      return null;
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

    // Update tokens in database
    await supabaseAdmin
      .from("profiles")
      .update({
        figma_access_token: data.access_token,
        figma_refresh_token: data.refresh_token || refreshToken,
        figma_token_expires_at: expiresAt.toISOString(),
      })
      .eq("user_id", userId);

    console.log("Token refreshed successfully");
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// Get valid Figma token (refresh if needed)
async function getValidFigmaToken(
  supabaseAdmin: any,
  userId: string,
): Promise<{ token: string | null; error?: string }> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("figma_access_token, figma_refresh_token, figma_token_expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return { token: null, error: "Profile not found" };
  }

  if (!profile.figma_access_token) {
    return { token: null, error: "Figma not connected" };
  }

  // Check if token expiration is unknown (requires reconnection)
  if (!profile.figma_token_expires_at) {
    console.log("Token expiration unknown, user needs to reconnect");
    return { token: null, error: "Token inválido - reconecte sua conta do Figma" };
  }

  // Check if token is expired
  const expiresAt = new Date(profile.figma_token_expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt.getTime() - bufferTime < now.getTime()) {
    console.log("Token expired or expiring soon, refreshing...");
    if (profile.figma_refresh_token) {
      const newToken = await refreshFigmaToken(supabaseAdmin, userId, profile.figma_refresh_token);
      if (newToken) {
        return { token: newToken };
      }
    }
    return { token: null, error: "Token expired and refresh failed" };
  }

  return { token: profile.figma_access_token };
}

// Make Figma API request
async function figmaRequest(token: string, endpoint: string): Promise<any> {
  const response = await fetch(`https://api.figma.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Check for scope/permission errors (403)
    if (response.status === 403 && (errorText.includes("scope") || errorText.includes("permission"))) {
      const scopeError = new Error("SCOPE_INSUFFICIENT");
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
    if (node.type === "FRAME" || node.type === "COMPONENT") {
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
    if (node.type === "CANVAS" && node.children) {
      node.children.forEach((child: any) => traverse(child, node.name));
    }
  }

  if (document.children) {
    document.children.forEach((page: any) => traverse(page, page.name));
  }

  return frames;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid user");
    }

    const body = await req.json();
    const { action, fileKey, nodeIds } = body;

    console.log("Figma API action:", action, "user:", user.id);

    // Handle disconnect separately (doesn't need valid Figma token)
    if (action === "disconnect") {
      console.log("Disconnecting Figma for user:", user.id);

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          figma_access_token: null,
          figma_refresh_token: null,
          figma_token_expires_at: null,
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error disconnecting Figma:", updateError);
        throw new Error("Falha ao desconectar conta do Figma");
      }

      return new Response(JSON.stringify({ success: true, message: "Figma desconectado com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle get-file-history separately (doesn't need Figma token)
    if (action === "get-file-history") {
      const { data: history, error: historyError } = await supabaseAdmin
        .from("figma_file_history")
        .select("*")
        .eq("user_id", user.id)
        .order("last_used_at", { ascending: false })
        .limit(10);

      if (historyError) {
        console.error("Error fetching file history:", historyError);
        return new Response(JSON.stringify({ success: true, history: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, history: history || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get valid Figma token for other actions
    const { token: figmaToken, error: tokenError } = await getValidFigmaToken(supabaseAdmin, user.id);

    if (tokenError || !figmaToken) {
      return new Response(JSON.stringify({ error: tokenError || "Figma not connected", requiresAuth: true }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "get-user": {
        const userData = await figmaRequest(figmaToken, "/me");
        return new Response(JSON.stringify({ success: true, user: userData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-file-from-url": {
        // Extract file key from Figma URL
        const { figmaUrl } = body;
        if (!figmaUrl) {
          throw new Error("figmaUrl is required");
        }

        // Match URLs like:
        // https://www.figma.com/design/AbCdEf123/Name
        // https://www.figma.com/file/AbCdEf123/Name
        // https://figma.com/design/AbCdEf123/Name
        const match = figmaUrl.match(/figma\.com\/(design|file)\/([a-zA-Z0-9]+)/);
        if (!match) {
          throw new Error("URL do Figma inválida. Cole uma URL como: https://www.figma.com/design/...");
        }

        const extractedFileKey = match[2];
        console.log("Extracted file key from URL:", extractedFileKey);

        // Get file info
        const fileData = await figmaRequest(figmaToken, `/files/${extractedFileKey}?depth=2`);
        const frames = extractFrames(fileData.document);

        // Fetch thumbnails for frames (max 50 to avoid API limits)
        if (frames.length > 0) {
          const framesToFetch = frames.slice(0, 10000000050);
          const nodeIds = framesToFetch.map((f: any) => f.id).join(",");

          try {
            console.log("Fetching thumbnails for", framesToFetch.length, "frames");
            const thumbnailsData = await figmaRequest(
              figmaToken,
              `/images/${extractedFileKey}?ids=${encodeURIComponent(nodeIds)}&format=png&scale=0.25`,
            );

            // Add thumbnailUrl to each frame
            if (thumbnailsData?.images) {
              frames.forEach((frame: any) => {
                frame.thumbnailUrl = thumbnailsData.images[frame.id] || null;
              });
            }
          } catch (thumbnailError) {
            console.error("Error fetching thumbnails:", thumbnailError);
            // Continue without thumbnails
          }
        }

        // Save to file history (UPSERT)
        try {
          const { error: upsertError } = await supabaseAdmin.from("figma_file_history").upsert(
            {
              user_id: user.id,
              file_key: extractedFileKey,
              file_name: fileData.name,
              file_url: figmaUrl,
              thumbnail_url: fileData.thumbnailUrl || null,
              last_used_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,file_key",
            },
          );

          if (upsertError) {
            console.error("Error saving to file history:", upsertError);
          } else {
            console.log("File saved to history:", fileData.name);
          }
        } catch (historyErr) {
          console.error("Error in file history upsert:", historyErr);
        }

        return new Response(
          JSON.stringify({
            success: true,
            file: {
              key: extractedFileKey,
              name: fileData.name,
              thumbnailUrl: fileData.thumbnailUrl,
            },
            frames,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "get-file-frames": {
        if (!fileKey) {
          throw new Error("fileKey is required");
        }

        // Get file structure
        const fileData = await figmaRequest(figmaToken, `/files/${fileKey}?depth=2`);
        const frames = extractFrames(fileData.document);

        return new Response(
          JSON.stringify({
            success: true,
            fileName: fileData.name,
            thumbnailUrl: fileData.thumbnailUrl,
            frames,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "export-frames": {
        if (!fileKey || !nodeIds || nodeIds.length === 0) {
          throw new Error("fileKey and nodeIds are required");
        }

        // Export frames as PNG
        const ids = nodeIds.join(",");
        const exportData = await figmaRequest(
          figmaToken,
          `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
        );

        if (!exportData.images) {
          throw new Error("Failed to export frames");
        }

        // Download images and upload to GCS
        const GCS_BUCKET = Deno.env.get("GCS_BUCKET_NAME");
        const GCS_KEY = Deno.env.get("GCS_SERVICE_ACCOUNT_KEY");

        if (!GCS_BUCKET || !GCS_KEY) {
          throw new Error("GCS not configured");
        }

        const results: { nodeId: string; url: string; name: string }[] = [];
        const serviceAccount = JSON.parse(GCS_KEY);

        for (const [nodeId, imageUrl] of Object.entries(exportData.images)) {
          if (!imageUrl) continue;

          try {
            console.log("Downloading frame:", nodeId);

            // Download image from Figma
            const imageResponse = await fetch(imageUrl as string);
            if (!imageResponse.ok) {
              console.error("Failed to download image:", nodeId);
              continue;
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            const imageData = new Uint8Array(imageBuffer);

            // Generate unique filename
            const timestamp = Date.now();
            const safeNodeId = nodeId.replace(/[^a-zA-Z0-9-_]/g, "_");
            const fileName = `figma/${user.id}/${timestamp}_${safeNodeId}.png`;

            // Upload to GCS
            const accessToken = await getGCSAccessToken(serviceAccount);
            const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

            const uploadResponse = await fetch(uploadUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "image/png",
              },
              body: imageData,
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.text();
              console.error("GCS upload failed:", error);
              continue;
            }

            // Make file public
            await fetch(
              `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(fileName)}/acl`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  entity: "allUsers",
                  role: "READER",
                }),
              },
            );

            const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
            results.push({ nodeId, url: publicUrl, name: safeNodeId });

            console.log("Uploaded frame:", nodeId, "→", publicUrl);
          } catch (err) {
            console.error("Error processing frame:", nodeId, err);
          }
        }

        return new Response(JSON.stringify({ success: true, frames: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Figma API error:", error);

    // Handle scope insufficient error - requires reconnection
    if (error.message === "SCOPE_INSUFFICIENT" || (error as any).requiresReconnect) {
      return new Response(
        JSON.stringify({
          error: "Permissões insuficientes - reconecte sua conta do Figma",
          requiresAuth: true,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper functions for GCS authentication
async function getGCSAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await signJWT(serviceAccount);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Failed to get GCS access token");
  }

  return data.access_token;
}

async function signJWT(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = serviceAccount.private_key;
  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signatureInput));

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signatureInput}.${encodedSignature}`;
}
