import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELS: Record<string, { url: string; filename: string }> = {
  'vosk-hu': {
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-hu-0.15.zip',
    filename: 'vosk-model-small-hu-0.15.zip'
  },
  'piper-hu': {
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hu/hu_HU/anna/medium/hu_HU-anna-medium.onnx',
    filename: 'hu_HU-anna-medium.onnx'
  },
  'piper-hu-config': {
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hu/hu_HU/anna/medium/hu_HU-anna-medium.onnx.json',
    filename: 'hu_HU-anna-medium.onnx.json'
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const modelType = url.searchParams.get('model');

    if (!modelType || !MODELS[modelType]) {
      return new Response(
        JSON.stringify({ error: 'Invalid model type. Valid: vosk-hu, piper-hu, piper-hu-config' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const model = MODELS[modelType];

    const { data: existingFile } = await supabase.storage
      .from('offline-models')
      .list('', { search: model.filename });

    if (existingFile && existingFile.length > 0) {
      const { data: publicUrl } = supabase.storage
        .from('offline-models')
        .getPublicUrl(model.filename);

      return new Response(
        JSON.stringify({
          status: 'exists',
          message: `Model ${modelType} already uploaded`,
          url: publicUrl.publicUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Downloading ${modelType} from ${model.url}...`);
    const response = await fetch(model.url, {
      headers: { 'User-Agent': 'DartsTraining/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    console.log(`Uploading ${model.filename} (${fileData.length} bytes) to storage...`);

    const contentType = modelType === 'piper-hu-config'
      ? 'application/json'
      : modelType === 'vosk-hu'
        ? 'application/zip'
        : 'application/octet-stream';

    const { error: uploadError } = await supabase.storage
      .from('offline-models')
      .upload(model.filename, fileData, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: publicUrl } = supabase.storage
      .from('offline-models')
      .getPublicUrl(model.filename);

    return new Response(
      JSON.stringify({
        status: 'uploaded',
        message: `Model ${modelType} uploaded successfully`,
        url: publicUrl.publicUrl,
        size: fileData.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
