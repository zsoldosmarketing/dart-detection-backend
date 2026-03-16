import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY") ?? "";
const SERVERLESS_URL = "https://serverless.roboflow.com";
const WORKSPACE = "darts-jeuiy";
const WORKFLOW_ID = "custom-workflow";

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const RING_RATIOS = {
  doubleBull: 0.032,
  singleBull: 0.08,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1.0,
};

interface WorkflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
  detection_id?: string;
}

interface WorkflowResponse {
  outputs?: Array<{
    predictions?: {
      predictions?: WorkflowPrediction[];
      image?: { width: number; height: number };
    };
  }>;
  predictions?: WorkflowPrediction[];
  image?: { width: number; height: number };
}

function classifyDartPosition(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number
): { label: string; score: number } {
  const boardCenterX = imageWidth / 2;
  const boardCenterY = imageHeight / 2;
  const boardRadius = Math.min(imageWidth, imageHeight) * 0.45;

  const dx = x - boardCenterX;
  const dy = y - boardCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy) / boardRadius;

  if (dist <= RING_RATIOS.doubleBull) {
    return { label: "D-BULL", score: 50 };
  }
  if (dist <= RING_RATIOS.singleBull) {
    return { label: "BULL", score: 25 };
  }
  if (dist > RING_RATIOS.doubleOuter) {
    return { label: "MISS", score: 0 };
  }

  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += 2 * Math.PI;

  const sectorWidth = (2 * Math.PI) / 20;
  const sectorIndex = Math.floor((angle + sectorWidth / 2) / sectorWidth) % 20;
  const sector = SECTOR_ORDER[sectorIndex];

  if (dist >= RING_RATIOS.doubleInner) {
    return { label: `D${sector}`, score: sector * 2 };
  }
  if (dist >= RING_RATIOS.tripleInner && dist <= RING_RATIOS.tripleOuter) {
    return { label: `T${sector}`, score: sector * 3 };
  }
  return { label: `${sector}`, score: sector };
}

async function runWorkflow(imageBase64: string): Promise<WorkflowResponse | null> {
  if (!ROBOFLOW_API_KEY) return null;

  const url = `${SERVERLESS_URL}/${WORKSPACE}/workflows/${WORKFLOW_ID}`;

  const body = JSON.stringify({
    api_key: ROBOFLOW_API_KEY,
    inputs: {
      image: {
        type: "base64",
        value: imageBase64,
      },
    },
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Roboflow workflow error:", resp.status, errText);
    return null;
  }

  return await resp.json();
}

function extractPredictions(data: WorkflowResponse): { predictions: WorkflowPrediction[]; width: number; height: number } {
  if (data.outputs && data.outputs.length > 0) {
    const output = data.outputs[0];
    if (output.predictions?.predictions) {
      return {
        predictions: output.predictions.predictions,
        width: output.predictions.image?.width ?? 640,
        height: output.predictions.image?.height ?? 480,
      };
    }
  }
  if (data.predictions) {
    return {
      predictions: data.predictions,
      width: data.image?.width ?? 640,
      height: data.image?.height ?? 480,
    };
  }
  return { predictions: [], width: 640, height: 480 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!ROBOFLOW_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Roboflow API key not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "detect";

    if (action === "health") {
      return new Response(
        JSON.stringify({ status: "ok", roboflow_configured: true, workflow: `${WORKSPACE}/${WORKFLOW_ID}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bodyBuffer = await req.arrayBuffer();
    const bytes = new Uint8Array(bodyBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const imageBase64 = btoa(binary);

    const data = await runWorkflow(imageBase64);

    if (!data) {
      if (action === "detect_board") {
        return new Response(
          JSON.stringify({
            board_found: false,
            confidence: 0,
            ellipse: null,
            homography: null,
            overlay_points: null,
            bull_center: null,
            canonical_preview: null,
            message: "Workflow request failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Workflow request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { predictions, width: imgW, height: imgH } = extractPredictions(data);

    if (action === "detect_board") {
      if (predictions.length === 0) {
        return new Response(
          JSON.stringify({
            board_found: false,
            confidence: 0,
            ellipse: null,
            homography: null,
            overlay_points: null,
            bull_center: null,
            canonical_preview: null,
            message: "No dartboard detected",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const board = predictions.reduce((best, p) => p.confidence > best.confidence ? p : best);
      const cx = board.x;
      const cy = board.y;
      const a = board.width / 2;
      const b = board.height / 2;

      const overlayPoints = [
        [cx, cy - b],
        [cx + a, cy],
        [cx, cy + b],
        [cx - a, cy],
      ];

      return new Response(
        JSON.stringify({
          board_found: true,
          confidence: board.confidence,
          ellipse: { cx, cy, a, b, angle: 0 },
          homography: null,
          overlay_points: overlayPoints,
          bull_center: [cx, cy],
          canonical_preview: null,
          message: `Board detected with ${(board.confidence * 100).toFixed(0)}% confidence`,
          image_width: imgW,
          image_height: imgH,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "score_throw") {
      if (predictions.length === 0) {
        return new Response(
          JSON.stringify({
            label: "MISS",
            score: 0,
            confidence: 0,
            decision: "ASSIST",
            tip_canonical: null,
            tip_original: null,
            debug: null,
            message: "No dart detected",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const best = predictions.reduce((b, p) => p.confidence > b.confidence ? p : b);
      const { label, score } = classifyDartPosition(best.x, best.y, imgW, imgH);
      const decision = best.confidence >= 0.70 ? "AUTO" : "ASSIST";

      return new Response(
        JSON.stringify({
          label,
          score,
          confidence: best.confidence,
          decision,
          tip_canonical: [best.x, best.y],
          tip_original: [best.x, best.y],
          debug: null,
          message: `Dart at ${label} with ${(best.confidence * 100).toFixed(0)}% confidence`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
