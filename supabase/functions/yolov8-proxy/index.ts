import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const HF_API_KEY = Deno.env.get("HF_API_KEY") ?? "";
const CUSTOM_YOLO_URL = Deno.env.get("YOLO_ENDPOINT_URL") ?? "";

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const RING_RATIOS = {
  doubleBull: 0.032,
  singleBull: 0.080,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1.0,
};

interface HFBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface HFDetection {
  score: number;
  label: string;
  box: HFBox;
}

interface YOLODetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}

function classifyDartboardPosition(
  tipX: number,
  tipY: number,
  boardCx: number,
  boardCy: number,
  boardRadius: number
): { label: string; score: number } {
  const dx = tipX - boardCx;
  const dy = tipY - boardCy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const distRatio = dist / boardRadius;

  if (distRatio > 1.03) return { label: "MISS", score: 0 };

  if (distRatio <= RING_RATIOS.doubleBull) return { label: "D-BULL", score: 50 };
  if (distRatio <= RING_RATIOS.singleBull) return { label: "BULL", score: 25 };

  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;

  const sectorWidth = (2 * Math.PI) / 20;
  const sectorIndex = Math.floor(angle / sectorWidth) % 20;
  const sector = SECTOR_ORDER[sectorIndex];

  let label: string;
  let score: number;

  if (distRatio >= RING_RATIOS.doubleInner && distRatio <= RING_RATIOS.doubleOuter) {
    label = `D${sector}`;
    score = sector * 2;
  } else if (distRatio >= RING_RATIOS.tripleInner && distRatio <= RING_RATIOS.tripleOuter) {
    label = `T${sector}`;
    score = sector * 3;
  } else {
    label = `${sector}`;
    score = sector;
  }

  return { label, score };
}

async function callHuggingFace(
  imageData: Uint8Array,
  model: string
): Promise<HFDetection[] | null> {
  if (!HF_API_KEY) return null;
  try {
    const resp = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageData,
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    if (Array.isArray(result)) return result as HFDetection[];
    return null;
  } catch {
    return null;
  }
}

async function callCustomYOLO(
  imageData: Uint8Array,
  action: string
): Promise<YOLODetection[] | null> {
  if (!CUSTOM_YOLO_URL) return null;
  try {
    const resp = await fetch(`${CUSTOM_YOLO_URL}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: imageData,
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    if (Array.isArray(result?.predictions)) return result.predictions;
    return null;
  } catch {
    return null;
  }
}

function extractBoardFromHF(
  detections: HFDetection[]
): { cx: number; cy: number; a: number; b: number; confidence: number } | null {
  const boardKeywords = ["dartboard", "disk", "donut", "frisbee", "clock", "circle", "round"];

  let candidates = detections.filter((d) =>
    boardKeywords.some((k) => d.label.toLowerCase().includes(k))
  );

  if (!candidates.length) {
    candidates = [...detections].sort((a, b) => {
      const areaA = (a.box.xmax - a.box.xmin) * (a.box.ymax - a.box.ymin);
      const areaB = (b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin);
      return areaB - areaA;
    });
  }

  candidates = candidates.filter((d) => d.score > 0.15).sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;

  const best = candidates[0];
  const cx = (best.box.xmin + best.box.xmax) / 2;
  const cy = (best.box.ymin + best.box.ymax) / 2;
  const a = (best.box.xmax - best.box.xmin) / 2;
  const b = (best.box.ymax - best.box.ymin) / 2;
  return { cx, cy, a, b, confidence: best.score };
}

function extractDartTipFromHF(
  detections: HFDetection[],
  boardCx?: number,
  boardCy?: number,
  boardRadius?: number
): { cx: number; cy: number; confidence: number } | null {
  const dartKeywords = ["dart", "needle", "knife", "pen", "pencil", "stick", "baseball bat"];

  let candidates = detections.filter((d) =>
    dartKeywords.some((k) => d.label.toLowerCase().includes(k))
  );

  if (!candidates.length) {
    candidates = [...detections]
      .filter((d) => {
        const w = d.box.xmax - d.box.xmin;
        const h = d.box.ymax - d.box.ymin;
        const aspect = Math.max(w, h) / (Math.min(w, h) + 1);
        return d.score > 0.25 && aspect > 1.5 && (w * h) < 40000;
      })
      .sort((a, b) => {
        const areaA = (a.box.xmax - a.box.xmin) * (a.box.ymax - a.box.ymin);
        const areaB = (b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin);
        return areaA - areaB;
      });
  }

  candidates = candidates.sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;

  const best = candidates[0];
  const cx = (best.box.xmin + best.box.xmax) / 2;
  const cy = best.box.ymax;

  if (boardCx !== undefined && boardRadius !== undefined) {
    const dist = Math.sqrt((cx - boardCx) ** 2 + (cy - (boardCy ?? boardCx)) ** 2);
    if (dist > boardRadius * 1.2) return null;
  }

  return { cx, cy, confidence: best.score };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "detect";
    const confidenceThreshold = parseFloat(url.searchParams.get("confidence") ?? "35") / 100;

    if (action === "health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          provider: CUSTOM_YOLO_URL ? "custom_yolov8" : HF_API_KEY ? "huggingface_detr" : "none",
          yolo_configured: Boolean(CUSTOM_YOLO_URL),
          hf_configured: Boolean(HF_API_KEY),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bodyBuffer = await req.arrayBuffer();
    const imageData = new Uint8Array(bodyBuffer);

    if (action === "detect_board") {
      let boardResult: { cx: number; cy: number; a: number; b: number; confidence: number } | null = null;
      const imageWidth = 640;
      const imageHeight = 480;

      if (CUSTOM_YOLO_URL) {
        const detections = await callCustomYOLO(imageData, "detect_board");
        if (detections && detections.length > 0) {
          const best = detections.sort((a, b) => b.confidence - a.confidence)[0];
          boardResult = {
            cx: best.x, cy: best.y,
            a: best.width / 2, b: best.height / 2,
            confidence: best.confidence,
          };
        }
      } else if (HF_API_KEY) {
        const detections = await callHuggingFace(imageData, "facebook/detr-resnet-50");
        if (detections) {
          boardResult = extractBoardFromHF(detections);
        }
      }

      if (!boardResult) {
        return new Response(
          JSON.stringify({
            board_found: false,
            confidence: 0,
            ellipse: null,
            homography: null,
            overlay_points: null,
            bull_center: null,
            canonical_preview: null,
            message: HF_API_KEY || CUSTOM_YOLO_URL
              ? "Board not detected in image"
              : "No detection backend configured. Set HF_API_KEY or YOLO_ENDPOINT_URL, or use the Python backend.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { cx, cy, a, b } = boardResult;
      const numOverlayPts = 64;
      const overlayPoints: number[][] = [];
      for (let i = 0; i < numOverlayPts; i++) {
        const theta = (2 * Math.PI * i) / numOverlayPts;
        overlayPoints.push([cx + a * Math.cos(theta), cy + b * Math.sin(theta)]);
      }

      return new Response(
        JSON.stringify({
          board_found: true,
          confidence: boardResult.confidence,
          ellipse: { cx, cy, a, b, angle: 0 },
          homography: null,
          overlay_points: overlayPoints,
          bull_center: [cx, cy],
          canonical_preview: null,
          message: `Board detected (${(boardResult.confidence * 100).toFixed(0)}% confidence)`,
          image_width: imageWidth,
          image_height: imageHeight,
          is_angled: Math.abs(a - b) / Math.max(a, b) > 0.1,
          rotation_offset: -9.0,
          method: CUSTOM_YOLO_URL ? "yolov8" : "detr",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "score_throw") {
      let tipResult: { cx: number; cy: number; confidence: number } | null = null;
      const imageWidth = 640;
      const imageHeight = 480;
      const boardCx = imageWidth / 2;
      const boardCy = imageHeight / 2;
      const boardRadius = Math.min(imageWidth, imageHeight) * 0.45;

      if (CUSTOM_YOLO_URL) {
        const detections = await callCustomYOLO(imageData, "detect_dart");
        if (detections && detections.length > 0) {
          const best = detections.sort((a, b) => b.confidence - a.confidence)[0];
          tipResult = { cx: best.x, cy: best.y, confidence: best.confidence };
        }
      } else if (HF_API_KEY) {
        const detections = await callHuggingFace(imageData, "facebook/detr-resnet-50");
        if (detections) {
          tipResult = extractDartTipFromHF(detections, boardCx, boardCy, boardRadius);
        }
      }

      if (!tipResult || tipResult.confidence < confidenceThreshold) {
        return new Response(
          JSON.stringify({
            label: "MISS",
            score: 0,
            confidence: 0,
            decision: "RETRY",
            tip_canonical: null,
            tip_original: null,
            debug: null,
            message: "No dart detected",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { label, score } = classifyDartboardPosition(
        tipResult.cx, tipResult.cy,
        boardCx, boardCy, boardRadius
      );

      const decision = tipResult.confidence >= 0.72 ? "AUTO"
        : tipResult.confidence >= 0.45 ? "ASSIST"
        : "RETRY";

      return new Response(
        JSON.stringify({
          label,
          score,
          confidence: tipResult.confidence,
          decision,
          tip_canonical: [tipResult.cx, tipResult.cy],
          tip_original: [tipResult.cx, tipResult.cy],
          debug: null,
          message: `${label} (${score}pts) [${(tipResult.confidence * 100).toFixed(0)}%]`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: health, detect_board, score_throw" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
