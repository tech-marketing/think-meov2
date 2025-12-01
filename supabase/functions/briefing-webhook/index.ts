import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type?: string;
  status?: "success" | "processing" | "failed";
  media_urls?: string[] | string;
  creative_id?: string;
  bucket_id?: string;
  caption?: string;
  name?: string;
  project_id?: string;
  company_id?: string;
  created_by?: string;
  storyboard?: unknown;
  metadata?: Record<string, unknown>;
}

const mapType = (incomingType?: string) => {
  const normalized = (incomingType || "").toLowerCase();
  if (normalized === "static" || normalized === "estatic") return "wireframe";
  if (normalized === "carousel") return "carousel";
  if (normalized === "video") return "video";
  return "wireframe";
};

const mapStatus = (incomingStatus?: string) => {
  const normalized = (incomingStatus || "").toLowerCase();
  if (normalized === "success") return "pending";
  if (normalized === "failed") return "failed";
  return "processing";
};

const parseMediaUrls = (media?: string[] | string) => {
  if (!media) return [] as string[];
  if (Array.isArray(media)) return media.filter(Boolean);
  try {
    const parsed = JSON.parse(media);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string" && item.length > 0);
    }
  } catch {
    // not JSON, fall back to splitting
  }
  return media
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const materialType = mapType(payload.type);
    const materialStatus = mapStatus(payload.status);
    const mediaUrls = parseMediaUrls(payload.media_urls);
    const thumbnail = mediaUrls[0] || null;

    const systemUserId = Deno.env.get("SYSTEM_USER_ID") || null;
    const projectId = payload.project_id;
    const companyId = payload.company_id;
    const createdBy = payload.created_by || systemUserId;

    if (!projectId || !companyId || !createdBy) {
      return new Response(
        JSON.stringify({
          error:
            "project_id, company_id and created_by are required in the payload or environment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let wireframeData: Record<string, unknown> | null = null;
    let fileUrl: string | null = null;

    if (materialType === "carousel" && mediaUrls.length > 0) {
      wireframeData = {
        isCarousel: true,
        slides: mediaUrls.map((url, index) => ({ imageUrl: url, index })),
      };
      fileUrl = JSON.stringify(mediaUrls);
    } else if (materialType === "video") {
      fileUrl = mediaUrls[0] || null;
      if (payload.storyboard) {
        wireframeData = { storyboard: payload.storyboard, videoUrl: fileUrl };
      }
    } else {
      fileUrl = mediaUrls[0] || null;
    }

    const { data, error } = await supabase
      .from("materials")
      .insert({
        project_id: projectId,
        company_id: companyId,
        created_by: createdBy,
        name: payload.name || `Briefing IA (${materialType})`,
        type: materialType,
        status: materialStatus,
        caption: payload.caption || null,
        file_url: fileUrl,
        wireframe_data: wireframeData,
        thumbnail_url: thumbnail,
        is_briefing: true,
        briefing_approved_by_client: false,
        metadata: {
          ...payload.metadata,
          source: "make-webhook",
          creative_id: payload.creative_id,
          bucket_id: payload.bucket_id,
          webhook_status: payload.status,
          media_urls: mediaUrls,
          raw_payload: payload,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, material: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
