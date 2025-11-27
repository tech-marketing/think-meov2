import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { materialId } = await req.json();
    
    if (!materialId) {
      throw new Error('materialId is required');
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Buscar material
    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!material) throw new Error('Material not found');
    
    const operationName = material.metadata?.veo_operation_name;
    if (!operationName) throw new Error('No operation name found');
    
    console.log('Checking status for operation:', operationName);
    
    // Verificar status no Veo
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY')!;
    const statusResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
      {
        headers: {
          'x-goog-api-key': geminiApiKey
        }
      }
    );
    
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Veo status check error:', statusResponse.status, errorText);
      throw new Error(`Failed to check video status: ${statusResponse.status}`);
    }
    
    const statusData = await statusResponse.json();
    console.log('Veo operation status:', JSON.stringify(statusData).substring(0, 500));
    
    // Se ainda não está pronto, retornar status
    if (!statusData.done) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'processing',
          message: 'Vídeo ainda está sendo gerado...'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Se houve erro na geração
    if (statusData.error) {
      await supabase
        .from('materials')
        .update({ 
          status: 'failed',
          metadata: {
            ...material.metadata,
            error: statusData.error
          }
        })
        .eq('id', materialId);
      
      throw new Error(`Video generation failed: ${JSON.stringify(statusData.error)}`);
    }
    
    // Vídeo pronto! Extrair URL
    const videoUri = statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error('No video URI in response');
    }
    
    console.log('Video ready! URI:', videoUri);
    
    // Download do vídeo
    const videoResponse = await fetch(videoUri, {
      headers: {
        'x-goog-api-key': geminiApiKey
      }
    });
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    
    console.log('Video downloaded, size:', videoBuffer.byteLength);
    
    // Upload para Supabase Storage
    const fileName = `video-${materialId}-${Date.now()}.mp4`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('materials')
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    console.log('Video uploaded to storage:', fileName);
    
    // Obter URL pública
    const { data: { publicUrl } } = supabase
      .storage
      .from('materials')
      .getPublicUrl(fileName);
    
    // Atualizar material
    const { error: updateError } = await supabase
      .from('materials')
      .update({
        file_url: publicUrl,
        status: 'pending',
        metadata: {
          ...material.metadata,
          video_completed_at: new Date().toISOString(),
          video_file_name: fileName
        }
      })
      .eq('id', materialId);
    
    if (updateError) throw updateError;
    
    console.log('Material updated with video URL');
    
    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        video_url: publicUrl,
        material_id: materialId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in check-video-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
