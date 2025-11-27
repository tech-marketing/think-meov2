import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert PEM to binary for crypto operations
function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Sign JWT for Google OAuth2
async function signJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBinary = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBinary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${encodedSignature}`;
}

// Get access token from Google OAuth2
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await signJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Upload file directly to GCS
async function uploadToGCS(
  bucketName: string,
  filePath: string,
  fileData: Uint8Array,
  contentType: string,
  accessToken: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: fileData as any,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to GCS: ${error}`);
  }

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
  
  return {
    publicUrl,
    storagePath: filePath,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Receiving file upload request...');

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) {
      throw new Error('No file provided in FormData');
    }

    if (!path) {
      throw new Error('No path provided in FormData');
    }

    console.log('File details:', { 
      name: file.name, 
      type: file.type, 
      size: file.size,
      path 
    });

    // Get GCS credentials from environment
    const gcsServiceAccountKey = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY');
    const bucketName = Deno.env.get('GCS_BUCKET_NAME');

    if (!gcsServiceAccountKey || !bucketName) {
      throw new Error('GCS credentials not configured');
    }

    const serviceAccount = JSON.parse(gcsServiceAccountKey);

    // Get access token
    console.log('Getting GCS access token...');
    const accessToken = await getAccessToken(serviceAccount);

    // Read file data
    const fileData = new Uint8Array(await file.arrayBuffer());

    // Generate full path
    const fullPath = `${path}/${file.name}`;
    const contentType = file.type || 'application/octet-stream';

    console.log('Uploading to GCS:', { fullPath, contentType, size: fileData.length });

    // Upload to GCS
    const result = await uploadToGCS(
      bucketName,
      fullPath,
      fileData,
      contentType,
      accessToken
    );

    console.log('Upload successful:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in gcs-upload-file:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
