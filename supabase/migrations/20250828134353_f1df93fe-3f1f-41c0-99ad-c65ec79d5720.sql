-- Create RLS policies for avatar uploads (only if they don't exist)
DO $$
BEGIN
    -- Check and create avatar upload policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar" 
        ON storage.objects 
        FOR INSERT 
        WITH CHECK (
          bucket_id = 'avatars' 
          AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;

    -- Check and create avatar update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar" 
        ON storage.objects 
        FOR UPDATE 
        USING (
          bucket_id = 'avatars' 
          AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;

    -- Check and create avatar delete policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own avatar'
    ) THEN
        CREATE POLICY "Users can delete their own avatar" 
        ON storage.objects 
        FOR DELETE 
        USING (
          bucket_id = 'avatars' 
          AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;

    -- Check and create avatar select policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Avatar images are publicly accessible'
    ) THEN
        CREATE POLICY "Avatar images are publicly accessible" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'avatars');
    END IF;
END $$;