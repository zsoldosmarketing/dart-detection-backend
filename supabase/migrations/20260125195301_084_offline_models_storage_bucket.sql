/*
  # Offline Speech Models Storage Bucket

  1. New Storage Bucket
    - `offline-models` - Public bucket for storing Vosk and Piper model files
    - Files are publicly accessible for download without authentication

  2. Security
    - Public read access for all users (models need to be downloadable)
    - Only service role can upload/delete files
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offline-models',
  'offline-models',
  true,
  104857600,
  ARRAY['application/zip', 'application/octet-stream', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for offline models"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'offline-models');

CREATE POLICY "Service role can upload offline models"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'offline-models');

CREATE POLICY "Service role can delete offline models"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'offline-models');
