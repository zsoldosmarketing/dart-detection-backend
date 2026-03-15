import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY") ?? "";
const ROBOFLOW_INFER_URL = "https://detect.roboflow.com";

interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
}

interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image?: { width: number; height: number };
  time?: number;
}

function classifyDartboardRegion(
  pred: RoboflowPrediction,
  imageWidth: number,
  imageHeight: number
): {
  label: string;
  score: number;
  tipX: number;
  tipY: number;
} {
  const cx = pred.x;
  const cy = pred.y;

  const boardCenterX = imageWidth / 2;
  const boardCenterY = imageHeight / 2;
  const boardRadius = Math.min(imageWidth, imageHeight) * 0.45;

  const dx = cx - boardCenterX;
  const dy = cy - boardCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy) / boardRadius;

  const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  const RING_RATIOS = {
    doubleBull: 0.032,
    singleBull: 0.08,
    tripleInner: 0.582,
    tripleOuter: 0.629,
    doubleInner: 0.953,
    doubleOuter: 1.0,
  };

  let label: string;
  if (dist <= RING_RATIOS.doubleBull) {
    label = "D-BULL";
  } else if (dist <= RING_RATIOS.singleBull) {
    label = "BULL";
  } else if (dist > RING_RATIOS.doubleOuter) {
    label = "MISS";
  } else {
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    const sectorWidth = (2 * Math.PI) / 20;
    const sectorIndex = Math.floor((angle + sectorWidth / 2) / sectorWidth) % 20;
    const sector = SECTOR_ORDER[sectorIndex];

    if (dist >= RING_RATIOS.doubleInner) {
      label = `D${sector}`;
    } else if (dist >= RING_RATIOS.tripleInner && dist <= RING_RATIOS.tripleOuter) {
      label = `T${sector}`;
    } else {
      label = `${sector}`;
    }
  }

  return {
    label,
    score: Math.round(pred.confidence * label.startsWith("D") ? 2 : label.startsWith("T") ? 3 : 1),
    tipX: cx,
    tipY: cy,
  };
}

async function callRoboflow(
  modelId: string,
  imageData: ArrayBuffer,
  confidence: string,
  overlap: string
): Promise<RoboflowResponse | null> {
  if (!ROBOFLOW_API_KEY) return null;

  const roboflowUrl = new URL(`${ROBOFLOW_INFER_URL}/${modelId}`);
  roboflowUrl.searchParams.set("api_key", ROBOFLOW_API_KEY);
  roboflowUrl.searchParams.set("confidence", confidence);
  roboflowUrl.searchParams.set("overlap", overlap);
  roboflowUrl.searchParams.set("format", "json");

  const upstream = await fetch(roboflowUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: imageData,
  });

  if (!upstream.ok) return null;
  return await upstream.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "detect";
    const modelId = url.searchParams.get("model");
    const confidence = url.searchParams.get("confidence") ?? "35";
    const overlap = url.searchParams.get("overlap") ?? "30";

    if (!ROBOFLOW_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Roboflow API key not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "health") {
      return new Response(
        JSON.stringify({ status: "ok", roboflow_configured: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "detect_board") {
      const body = await req.arrayBuffer();

      const boardModelId = modelId ?? "dartboard-detection/1";
      const data = await callRoboflow(boardModelId, body, "40", overlap);

      if (!data || !data.predictions || data.predictions.length === 0) {
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

      const board = data.predictions.reduce((best: RoboflowPrediction, p: RoboflowPrediction) =>
        p.confidence > best.confidence ? p : best
      );

      const imgW = data.image?.width ?? 640;
      const imgH = data.image?.height ?? 480;

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
      const body = await req.arrayBuffer();

      const dartModelId = modelId ?? "dart-tip-detection/1";
      const data = await callRoboflow(dartModelId, body, confidence, overlap);

      if (!data || !data.predictions || data.predictions.length === 0) {
        return new Response(
          JSON.stringify({
            label: "MISS",
            score: 0,
            confidence: 0,
            decision: "ASSIST",
            tip_canonical: null,
            tip_original: null,
            debug: null,
            message: "No dart tip detected",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const imgW = data.image?.width ?? 640;
      const imgH = data.image?.height ?? 480;

      const best = data.predictions.reduce((b: RoboflowPrediction, p: RoboflowPrediction) =>
        p.confidence > b.confidence ? p : b
      );

      const regionData = classifyDartboardRegion(best, imgW, imgH);

      const decision = best.confidence >= 0.70 ? "AUTO" : "ASSIST";

      return new Response(
        JSON.stringify({
          label: regionData.label,
          score: regionData.score,
          confidence: best.confidence,
          decision,
          tip_canonical: [regionData.tipX, regionData.tipY],
          tip_original: [regionData.tipX, regionData.tipY],
          debug: null,
          message: `Dart detected at ${regionData.label} with ${(best.confidence * 100).toFixed(0)}% confidence`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!modelId) {
      return new Response(
        JSON.stringify({ error: "model parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.arrayBuffer();
    const data = await callRoboflow(modelId, body, confidence, overlap);

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Roboflow upstream error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
