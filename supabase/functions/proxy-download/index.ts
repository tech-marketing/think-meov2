import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      console.error('proxy-download: URL não fornecida');
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('proxy-download: Baixando arquivo de:', url);

    // Fetch the file from the original URL
    const response = await fetch(url);

    if (!response.ok) {
      console.error('proxy-download: Erro ao buscar arquivo:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Falha ao baixar arquivo: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the file content as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Get content type from original response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    console.log('proxy-download: Arquivo baixado com sucesso, tamanho:', arrayBuffer.byteLength, 'tipo:', contentType);

    // Return the file with appropriate headers
    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
      }
    });

  } catch (error) {
    console.error('proxy-download: Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
