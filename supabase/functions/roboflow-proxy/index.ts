import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY") ?? "";
const DETECT_URL = "https://detect.roboflow.com";
const MODEL_ID = "darts-gffwp";
const MODEL_VERSION = "1";

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const RING_RATIOS = {
  doubleBull: 0.032,
  singleBull: 0.08,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1.0,
};

interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
  detection_id?: string;
}

interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image?: { width: number; height: number };
}

function classifyDartPosition(
  dartX: number,
  dartY: number,
  boardCx: number,
  boardCy: number,
  boardRadius: number
): { label: string; score: number } {
  const dx = dartX - boardCx;
  const dy = dartY - boardCy;
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

async function detectObjects(imageBase64: string, confidence: number = 40, overlap: number = 30): Promise<RoboflowResponse | null> {
  if (!ROBOFLOW_API_KEY) return null;

  const url = `${DETECT_URL}/${MODEL_ID}/${MODEL_VERSION}?api_key=${ROBOFLOW_API_KEY}&confidence=${confidence}&overlap=${overlap}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: imageBase64,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Roboflow detect error:", resp.status, errText);
    return null;
  }

  return await resp.json();
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
        JSON.stringify({
          status: "ok",
          roboflow_configured: true,
          model: `${MODEL_ID}/${MODEL_VERSION}`,
        }),
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

    const confidenceParam = parseInt(url.searchParams.get("confidence") ?? "40", 10);
    const data = await detectObjects(imageBase64, confidenceParam, 30);

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
            message: "Detection request failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Detection request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const predictions = data.predictions || [];
    const imgW = data.image?.width ?? 640;
    const imgH = data.image?.height ?? 480;

    if (action === "detect_board") {
      const boardPreds = predictions.filter(
        (p) => p.class.toLowerCase().includes("board") || p.class.toLowerCase().includes("dart")
      );

      const largePreds = predictions.filter(
        (p) => p.width > imgW * 0.15 && p.height > imgH * 0.15
      );

      const boardCandidates = boardPreds.length > 0 ? boardPreds : largePreds;

      if (boardCandidates.length === 0 && predictions.length > 0) {
        const allDarts = predictions;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of allDarts) {
          const left = p.x - p.width / 2;
          const top = p.y - p.height / 2;
          const right = p.x + p.width / 2;
          const bottom = p.y + p.height / 2;
          if (left < minX) minX = left;
          if (top < minY) minY = top;
          if (right > maxX) maxX = right;
          if (bottom > maxY) maxY = bottom;
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const boardR = Math.max(maxX - minX, maxY - minY) * 1.5;
        const a = boardR / 2;
        const b = boardR / 2;

        return new Response(
          JSON.stringify({
            board_found: true,
            confidence: 0.5,
            ellipse: { cx, cy, a, b, angle: 0 },
            homography: null,
            overlay_points: [[cx, cy - b], [cx + a, cy], [cx, cy + b], [cx - a, cy]],
            bull_center: [cx, cy],
            canonical_preview: null,
            message: "Board estimated from dart positions",
            image_width: imgW,
            image_height: imgH,
            raw_predictions: predictions.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (boardCandidates.length === 0) {
        return new Response(
          JSON.stringify({
            board_found: false,
            confidence: 0,
            ellipse: null,
            homography: null,
            overlay_points: null,
            bull_center: null,
            canonical_preview: null,
            message: `No board detected (${predictions.length} objects found: ${predictions.map(p => p.class).join(', ')})`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const board = boardCandidates.reduce((best, p) => {
        const area = p.width * p.height;
        const bestArea = best.width * best.height;
        return area > bestArea ? p : best;
      });

      const cx = board.x;
      const cy = board.y;
      const a = board.width / 2;
      const b = board.height / 2;

      return new Response(
        JSON.stringify({
          board_found: true,
          confidence: board.confidence,
          ellipse: { cx, cy, a, b, angle: 0 },
          homography: null,
          overlay_points: [[cx, cy - b], [cx + a, cy], [cx, cy + b], [cx - a, cy]],
          bull_center: [cx, cy],
          canonical_preview: null,
          message: `Board detected (${board.class}) with ${(board.confidence * 100).toFixed(0)}% confidence`,
          image_width: imgW,
          image_height: imgH,
          raw_predictions: predictions.length,
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

      const roboflowClass = predictions[0].class;
      const classLabel = roboflowClass.toUpperCase();

      let label = "";
      let score = 0;
      let useGeometry = false;

      if (classLabel.startsWith("T") && !isNaN(parseInt(classLabel.slice(1)))) {
        const num = parseInt(classLabel.slice(1));
        if (num >= 1 && num <= 20) {
          label = `T${num}`;
          score = num * 3;
        }
      } else if (classLabel.startsWith("D") && classLabel !== "D-BULL" && !isNaN(parseInt(classLabel.slice(1)))) {
        const num = parseInt(classLabel.slice(1));
        if (num >= 1 && num <= 20) {
          label = `D${num}`;
          score = num * 2;
        }
      } else if (classLabel === "BULL" || classLabel === "D-BULL" || classLabel === "DBULL" || classLabel === "DB" || classLabel === "DOUBLE BULL") {
        label = "D-BULL";
        score = 50;
      } else if (classLabel === "OB" || classLabel === "OUTER BULL" || classLabel === "SINGLE BULL" || classLabel === "SB") {
        label = "BULL";
        score = 25;
      } else if (classLabel === "MISS" || classLabel === "OUT" || classLabel === "OUTSIDE") {
        label = "MISS";
        score = 0;
      } else if (!isNaN(parseInt(classLabel))) {
        const num = parseInt(classLabel);
        if (num >= 1 && num <= 20) {
          label = `${num}`;
          score = num;
        } else if (num === 25) {
          label = "BULL";
          score = 25;
        } else if (num === 50) {
          label = "D-BULL";
          score = 50;
        }
      } else {
        useGeometry = true;
      }

      if (useGeometry || !label) {
        const best = predictions.reduce((b, p) => p.confidence > b.confidence ? p : b);
        const boardCx = imgW / 2;
        const boardCy = imgH / 2;
        const boardRadius = Math.min(imgW, imgH) * 0.45;
        const result = classifyDartPosition(best.x, best.y, boardCx, boardCy, boardRadius);
        label = result.label;
        score = result.score;
      }

      const best = predictions.reduce((b, p) => p.confidence > b.confidence ? p : b);
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
          message: `${roboflowClass} -> ${label} (${score}) with ${(best.confidence * 100).toFixed(0)}% confidence`,
          raw_class: roboflowClass,
          all_predictions: predictions.map(p => ({ class: p.class, confidence: p.confidence, x: p.x, y: p.y })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ predictions, image: data.image }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
