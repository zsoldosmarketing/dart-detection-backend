import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY") ?? "";
const ROBOFLOW_INFER_URL = "https://detect.roboflow.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const modelId = url.searchParams.get("model");
    const confidence = url.searchParams.get("confidence") ?? "35";
    const overlap = url.searchParams.get("overlap") ?? "30";

    if (!modelId) {
      return new Response(
        JSON.stringify({ error: "model parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ROBOFLOW_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Roboflow API key not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.arrayBuffer();

    const roboflowUrl = new URL(`${ROBOFLOW_INFER_URL}/${modelId}`);
    roboflowUrl.searchParams.set("api_key", ROBOFLOW_API_KEY);
    roboflowUrl.searchParams.set("confidence", confidence);
    roboflowUrl.searchParams.set("overlap", overlap);
    roboflowUrl.searchParams.set("format", "json");

    const upstream = await fetch(roboflowUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ error: "Roboflow upstream error", detail: errText }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
