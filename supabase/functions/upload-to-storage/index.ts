import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as base64urlEncode } from "https://deno.land/std@0.177.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to create JWT for Google OAuth2
async function signJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT"
  }
  
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_write",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }

  const encodedHeader = base64urlEncode(JSON.stringify(header))
  const encodedPayload = base64urlEncode(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // Import private key
  const privateKey = serviceAccount.private_key
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  )

  // Sign the token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = base64urlEncode(signature as ArrayBuffer)
  return `${unsignedToken}.${encodedSignature}`
}

// Helper to convert PEM to binary
function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

// Get OAuth2 access token
async function getAccessToken(serviceAccount: any): Promise<string> {
  console.log('[GCS] Generating OAuth2 token...')
  
  const jwt = await signJWT(serviceAccount)
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[GCS] OAuth2 token error:', error)
    throw new Error(`Failed to get access token: ${error}`)
  }

  const data = await response.json()
  console.log('[GCS] OAuth2 token obtained successfully')
  return data.access_token
}

// Start resumable upload session
async function startResumableUpload(
  bucket: string,
  fullPath: string,
  contentType: string,
  size: number,
  token: string
): Promise<string> {
  console.log(`[GCS] Starting resumable upload for ${fullPath} (${size} bytes)`)
  
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable&name=${encodeURIComponent(fullPath)}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': size.toString(),
    },
    body: JSON.stringify({
      name: fullPath,
      metadata: {
        cacheControl: 'public, max-age=3600',
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[GCS] Failed to start resumable upload:', error)
    throw new Error(`Failed to start resumable upload: ${error}`)
  }

  const sessionUrl = response.headers.get('Location')
  if (!sessionUrl) {
    throw new Error('No session URL returned from GCS')
  }

  console.log('[GCS] Resumable upload session started')
  return sessionUrl
}

// Upload file to resumable session
async function uploadToSession(
  sessionUrl: string,
  fileData: Uint8Array,
  contentType: string
): Promise<any> {
  console.log(`[GCS] Uploading ${fileData.length} bytes to session...`)
  
  const response = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileData.length.toString(),
    },
    body: fileData as any
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[GCS] Upload to session failed:', error)
    throw new Error(`Failed to upload to session: ${error}`)
  }

  const result = await response.json()
  console.log('[GCS] Upload completed successfully')
  return result
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[GCS] Upload request received')
    
    const gcsServiceAccountKey = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY')!
    const gcsBucketName = Deno.env.get('GCS_BUCKET_NAME')!

    if (!gcsServiceAccountKey || !gcsBucketName) {
      throw new Error('Missing GCS configuration')
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const path = formData.get('path') as string

    if (!file) {
      throw new Error('No file provided')
    }

    console.log(`[GCS] Processing file: ${file.name} (${file.size} bytes) to path: ${path}`)

    // Parse GCS credentials
    const credentials = JSON.parse(gcsServiceAccountKey)

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = crypto.randomUUID()
    const fileExtension = file.name.split('.').pop() || 'bin'
    const fileName = `${timestamp}_${randomId}.${fileExtension}`
    const fullPath = `${path}/${fileName}`

    // Get OAuth2 token
    const accessToken = await getAccessToken(credentials)

    // Convert file to Uint8Array
    const fileArrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(fileArrayBuffer)

    // Start resumable upload and upload file
    const sessionUrl = await startResumableUpload(
      gcsBucketName,
      fullPath,
      file.type || 'application/octet-stream',
      fileData.length,
      accessToken
    )

    await uploadToSession(sessionUrl, fileData, file.type || 'application/octet-stream')

    // Make object public
    console.log('[GCS] Setting object ACL to public...')
    const aclUrl = `https://storage.googleapis.com/storage/v1/b/${gcsBucketName}/o/${encodeURIComponent(fullPath)}/acl`
    const aclResponse = await fetch(aclUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity: 'allUsers',
        role: 'READER'
      })
    })

    if (!aclResponse.ok) {
      console.warn('[GCS] Failed to set public ACL, object may not be publicly accessible')
    } else {
      console.log('[GCS] Object ACL set to public')
    }

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${gcsBucketName}/${fullPath}`

    console.log(`[GCS] Upload completed successfully. Public URL: ${publicUrl}`)

    return new Response(
      JSON.stringify({ 
        path: publicUrl,
        storage_path: fullPath
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('[GCS] Upload error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: `Upload failed: ${(error as Error)?.message || 'Unknown error'}` 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})
