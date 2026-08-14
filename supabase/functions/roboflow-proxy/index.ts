import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  estimateDartTip,
  isValidCalibration,
  scoreDartPosition,
  type BoardCalibration,
} from "./scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBOFLOW_API_KEY = Deno.env.get("ROBOFLOW_API_KEY") ?? "";
const DETECT_URL = "https://detect.roboflow.com";
const MODEL_ID = "darts-gffwp";
const MODEL_VERSION = "1";

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

interface CalibrationRequest {
  calibration: BoardCalibration | null;
  confidence: number;
}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCalibrationRequest(url: URL): CalibrationRequest {
  if (url.searchParams.get('calibration_valid') !== 'true') {
    return { calibration: null, confidence: 0 };
  }

  const cx = parseNumber(url.searchParams.get('board_cx'));
  const cy = parseNumber(url.searchParams.get('board_cy'));
  const radiusX = parseNumber(url.searchParams.get('board_radius_x'));
  const radiusY = parseNumber(url.searchParams.get('board_radius_y'));
  const angle = parseNumber(url.searchParams.get('board_angle'));
  const rotationOffset = parseNumber(url.searchParams.get('rotation_offset'));
  const confidence = parseNumber(url.searchParams.get('calibration_confidence')) ?? 0;

  const calibration: BoardCalibration | null = (
    cx === null || cy === null || radiusX === null || radiusY === null ||
    angle === null || rotationOffset === null
  )
    ? null
    : { cx, cy, radiusX, radiusY, angle, rotationOffset };

  return { calibration: isValidCalibration(calibration) ? calibration : null, confidence };
}

function isBoardPrediction(prediction: RoboflowPrediction): boolean {
  return prediction.class.toLowerCase().includes('board');
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
      const explicitBoardPredictions = predictions.filter(isBoardPrediction);
      const largePredictions = predictions.filter(
        (prediction) => prediction.width > imgW * 0.35 && prediction.height > imgH * 0.35
      );
      const boardCandidates = explicitBoardPredictions.length > 0
        ? explicitBoardPredictions
        : largePredictions;

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
            decision: "RETRY",
            tip_canonical: null,
            tip_original: null,
            debug: null,
            message: "No dart detected",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const best = predictions.reduce((currentBest, prediction) =>
        prediction.confidence > currentBest.confidence ? prediction : currentBest
      );
      const calibrationRequest = parseCalibrationRequest(url);
      const calibrationTrusted = Boolean(
        calibrationRequest.calibration && calibrationRequest.confidence >= 0.55
      );
      const tip = estimateDartTip(best, calibrationRequest.calibration);
      const roboflowClass = best.class;
      const classLabel = roboflowClass.toUpperCase();

      let label = "";
      let score = 0;
      let scoringMethod = "model_class";

      if (calibrationTrusted && calibrationRequest.calibration) {
        const geometry = scoreDartPosition(tip.x, tip.y, calibrationRequest.calibration);
        label = geometry.label;
        score = geometry.score;
        scoringMethod = "calibrated_ellipse_geometry";
      } else if (classLabel.startsWith("T") && !isNaN(parseInt(classLabel.slice(1)))) {
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
      }

      if (!label) {
        label = "MISS";
        score = 0;
        scoringMethod = "unclassified_without_calibration";
      }

      const decision = calibrationTrusted && best.confidence >= 0.70
        ? "AUTO"
        : best.confidence >= 0.35
          ? "ASSIST"
          : "RETRY";

      return new Response(
        JSON.stringify({
          label,
          score,
          confidence: best.confidence,
          decision,
          tip_canonical: [tip.x, tip.y],
          tip_original: [tip.x, tip.y],
          debug: null,
          message: `${roboflowClass} -> ${label} (${score}) via ${scoringMethod} with ${(best.confidence * 100).toFixed(0)}% confidence`,
          raw_class: roboflowClass,
          scoring_method: scoringMethod,
          calibration_trusted: calibrationTrusted,
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
