import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Storage } from "https://esm.sh/@google-cloud/storage@7.7.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const gcsServiceAccountKey = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY')!
    const gcsBucketName = Deno.env.get('GCS_BUCKET_NAME')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Parse GCS credentials
    const credentials = JSON.parse(gcsServiceAccountKey)
    const storage = new Storage({ credentials })
    const bucket = storage.bucket(gcsBucketName)

    console.log('Iniciando migração para GCS...')

    let migratedCount = 0
    const errors: Array<{ file: string; error: string }> = []

    // Migrar materials
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('id, file_url')
      .not('file_url', 'is', null)

    if (materialsError) {
      console.error('Erro ao buscar materials:', materialsError)
      throw materialsError
    }

    console.log(`Encontrados ${materials?.length || 0} materials para migrar`)

    for (const material of materials || []) {
      try {
        const fileUrls = Array.isArray(material.file_url) 
          ? material.file_url 
          : [material.file_url]

        const newUrls: string[] = []

        for (const fileUrl of fileUrls) {
          if (typeof fileUrl !== 'string' || !fileUrl.includes('supabase.co/storage')) {
            newUrls.push(fileUrl)
            continue
          }

          // Extract path from Supabase URL
          const urlParts = fileUrl.split('/storage/v1/object/public/')
          if (urlParts.length < 2) {
            newUrls.push(fileUrl)
            continue
          }

          const storagePath = urlParts[1]

          // Download from Supabase
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('materials')
            .download(storagePath.replace('materials/', ''))

          if (downloadError) {
            console.error(`Erro ao baixar ${storagePath}:`, downloadError)
            errors.push({ file: storagePath, error: downloadError.message })
            newUrls.push(fileUrl)
            continue
          }

          // Upload to GCS
          const arrayBuffer = await fileData.arrayBuffer()
          const buffer = new Uint8Array(arrayBuffer)
          
          const fileName = storagePath.split('/').pop() || 'file'
          const gcsPath = `materials/${fileName}`
          
          const file = bucket.file(gcsPath)
          await file.save(buffer, {
            contentType: fileData.type,
            public: true,
          })

          const publicUrl = `https://storage.googleapis.com/${gcsBucketName}/${gcsPath}`
          newUrls.push(publicUrl)
          
          console.log(`Migrado: ${storagePath} -> ${publicUrl}`)
          migratedCount++
        }

        // Update database with new URL(s)
        const { error: updateError } = await supabase
          .from('materials')
          .update({ 
            file_url: Array.isArray(material.file_url) ? newUrls : newUrls[0] 
          })
          .eq('id', material.id)

        if (updateError) {
          console.error(`Erro ao atualizar material ${material.id}:`, updateError)
          errors.push({ file: material.id, error: updateError.message })
        }

      } catch (error) {
        console.error(`Erro ao processar material ${material.id}:`, error)
        errors.push({ 
          file: material.id, 
          error: (error as Error)?.message || 'Unknown error' 
        })
      }
    }

    // Migrar avatars
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .not('avatar_url', 'is', null)

    if (profilesError) {
      console.error('Erro ao buscar profiles:', profilesError)
      throw profilesError
    }

    console.log(`Encontrados ${profiles?.length || 0} avatars para migrar`)

    for (const profile of profiles || []) {
      try {
        const avatarUrl = profile.avatar_url

        if (!avatarUrl || !avatarUrl.includes('supabase.co/storage')) {
          continue
        }

        // Extract path from Supabase URL
        const urlParts = avatarUrl.split('/storage/v1/object/public/')
        if (urlParts.length < 2) {
          continue
        }

        const storagePath = urlParts[1]

        // Download from Supabase
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('avatars')
          .download(storagePath.replace('avatars/', ''))

        if (downloadError) {
          console.error(`Erro ao baixar avatar ${storagePath}:`, downloadError)
          errors.push({ file: storagePath, error: downloadError.message })
          continue
        }

        // Upload to GCS
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)
        
        const fileName = storagePath.split('/').pop() || 'avatar'
        const gcsPath = `avatars/${fileName}`
        
        const file = bucket.file(gcsPath)
        await file.save(buffer, {
          contentType: fileData.type,
          public: true,
        })

        const publicUrl = `https://storage.googleapis.com/${gcsBucketName}/${gcsPath}`

        // Update database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', profile.id)

        if (updateError) {
          console.error(`Erro ao atualizar profile ${profile.id}:`, updateError)
          errors.push({ file: profile.id, error: updateError.message })
        } else {
          console.log(`Avatar migrado: ${storagePath} -> ${publicUrl}`)
          migratedCount++
        }

      } catch (error) {
        console.error(`Erro ao processar avatar ${profile.id}:`, error)
        errors.push({ 
          file: profile.id, 
          error: (error as Error)?.message || 'Unknown error' 
        })
      }
    }

    console.log(`Migração concluída. ${migratedCount} arquivos migrados, ${errors.length} erros`)

    return new Response(
      JSON.stringify({ 
        success: true,
        migratedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Erro na migração:', error)
    
    return new Response(
      JSON.stringify({ 
        error: `Erro na migração: ${(error as Error)?.message || 'Unknown error'}` 
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
