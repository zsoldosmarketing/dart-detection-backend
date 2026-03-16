import type { DartTarget } from './dartsEngine';

export interface EllipseData {
  cx: number;
  cy: number;
  a: number;
  b: number;
  angle: number;
}

export interface BoardDetectResult {
  board_found: boolean;
  confidence: number;
  ellipse: EllipseData | null;
  homography: number[][] | null;
  overlay_points: number[][] | null;
  bull_center: number[] | null;
  canonical_preview: string | null;
  debug_contour: string | null;
  message: string;
  is_angled?: boolean;
  rotation_offset?: number;
  method?: string;
  image_width?: number;
  image_height?: number;
}

export interface ThrowScoreResult {
  label: string;
  score: number;
  confidence: number;
  decision: 'AUTO' | 'ASSIST' | 'RETRY';
  tip_canonical: number[] | null;
  tip_original: number[] | null;
  debug: {
    diff_preview?: string;
    mask_preview?: string;
    canonical_preview?: string;
    canonical_after?: string;
  } | null;
  message: string;
}

export interface AutoCalibrationResult {
  success: boolean;
  center_x: number | null;
  center_y: number | null;
  radius: number | null;
  radius_x?: number | null;
  radius_y?: number | null;
  rotation_offset: number | null;
  confidence: number;
  method?: string;
  message: string;
  ellipse?: EllipseData | null;
  is_angled?: boolean;
  suggested_zoom?: number;
  board_visible_percent?: number;
  homography?: number[][] | null;
  overlay_points?: number[][] | null;
  canonical_preview?: string | null;
  center?: { x: number; y: number } | null;
  radiusX?: number | null;
  radiusY?: number | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? '';

function getBackendMode(): 'backend' | 'edge' {
  return BACKEND_URL ? 'backend' : 'edge';
}

function getEdgeUrl(action: string, extra: Record<string, string> = {}): string {
  const url = new URL(`${SUPABASE_URL}/functions/v1/roboflow-proxy`);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function edgeHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

export function isApiConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getApiUrl(): string {
  if (BACKEND_URL) return BACKEND_URL;
  return `${SUPABASE_URL}/functions/v1/roboflow-proxy`;
}

export async function checkApiHealth(): Promise<{
  status: string;
  board_found: boolean;
  has_homography: boolean;
  yolo_enabled?: boolean;
} | null> {
  try {
    if (getBackendMode() === 'backend') {
      const resp = await fetch(`${BACKEND_URL}/health`, {
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          status: data.status ?? 'ok',
          board_found: data.board_found ?? false,
          has_homography: data.has_homography ?? false,
          yolo_enabled: data.yolo_enabled ?? false,
        };
      }
    } else {
      const resp = await fetch(getEdgeUrl('health'), {
        method: 'GET',
        headers: edgeHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          status: data.status ?? 'ok',
          board_found: false,
          has_homography: false,
          yolo_enabled: data.yolo_configured ?? data.hf_configured ?? false,
        };
      }
    }
  } catch (err) {
    console.log('[API] Health check failed:', err instanceof Error ? err.message : 'timeout');
  }
  return null;
}

export async function detectBoard(imageBlob: Blob): Promise<BoardDetectResult | null> {
  try {
    if (getBackendMode() === 'backend') {
      console.log('[API] Board detection via Python backend...');
      const form = new FormData();
      form.append('image', imageBlob, 'frame.jpg');
      const resp = await fetch(`${BACKEND_URL}/board/detect`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(25000),
      });
      if (!resp.ok) {
        console.error('[API] Backend board detection failed:', resp.status);
        return null;
      }
      const result = await resp.json();
      console.log('[API] Backend board result:', result.board_found, result.confidence?.toFixed(2));
      return result as BoardDetectResult;
    } else {
      console.log('[API] Board detection via edge function...');
      const arrayBuffer = await imageBlob.arrayBuffer();
      const resp = await fetch(getEdgeUrl('detect_board'), {
        method: 'POST',
        headers: edgeHeaders(),
        body: arrayBuffer,
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        console.error('[API] Edge board detection failed:', resp.status);
        return null;
      }
      const result = await resp.json();
      console.log('[API] Edge board result:', result.board_found, result.confidence?.toFixed(2));
      return result as BoardDetectResult;
    }
  } catch (err) {
    console.error('[API] Board detection error:', err instanceof Error ? err.message : 'timeout');
    return null;
  }
}

export async function detectBoardWithRetry(imageBlob: Blob, maxRetries = 3): Promise<BoardDetectResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await detectBoard(imageBlob);
    if (result && result.board_found && result.confidence >= 0.35) {
      return result;
    }
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return null;
}

export async function scoreThrow(
  beforeBlob: Blob,
  afterBlob: Blob,
  homography?: number[][]
): Promise<ThrowScoreResult | null> {
  try {
    if (getBackendMode() === 'backend') {
      console.log('[API] Scoring throw via Python backend...');
      const form = new FormData();
      form.append('before', beforeBlob, 'before.jpg');
      form.append('after', afterBlob, 'after.jpg');
      if (homography) {
        form.append('homography', JSON.stringify(homography));
      }
      const resp = await fetch(`${BACKEND_URL}/throw/score`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        console.error('[API] Backend throw scoring failed:', resp.status);
        return null;
      }
      const result = await resp.json();
      console.log('[API] Backend throw result:', result.label, result.confidence?.toFixed(2), result.decision);
      return result as ThrowScoreResult;
    } else {
      console.log('[API] Scoring throw via edge function...');
      const arrayBuffer = await afterBlob.arrayBuffer();
      const resp = await fetch(getEdgeUrl('score_throw', { confidence: '35' }), {
        method: 'POST',
        headers: edgeHeaders(),
        body: arrayBuffer,
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        console.error('[API] Edge throw scoring failed:', resp.status);
        return null;
      }
      const result = await resp.json();
      console.log('[API] Edge throw result:', result.label, result.confidence?.toFixed(2), result.decision);
      return result as ThrowScoreResult;
    }
  } catch (err) {
    console.error('[API] Throw scoring error:', err instanceof Error ? err.message : 'timeout');
    return null;
  }
}

export async function setReferenceImage(imageBlob: Blob): Promise<{ status: string; canonical_preview?: string } | null> {
  if (getBackendMode() !== 'backend') return { status: 'ok' };
  try {
    const form = new FormData();
    form.append('image', imageBlob, 'reference.jpg');
    const resp = await fetch(`${BACKEND_URL}/set-reference`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function resetSession(): Promise<boolean> {
  if (getBackendMode() !== 'backend') return true;
  try {
    const resp = await fetch(`${BACKEND_URL}/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getSessionStatus(): Promise<{
  board_found: boolean;
  has_homography: boolean;
  has_reference: boolean;
  ellipse: EllipseData | null;
} | null> {
  if (getBackendMode() !== 'backend') {
    return { board_found: false, has_homography: false, has_reference: false, ellipse: null };
  }
  try {
    const resp = await fetch(`${BACKEND_URL}/session/status`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export function boardDetectToCalibration(result: BoardDetectResult): AutoCalibrationResult {
  if (!result.board_found || !result.ellipse) {
    return {
      success: false,
      center_x: null,
      center_y: null,
      radius: null,
      rotation_offset: null,
      confidence: 0,
      message: result.message,
    };
  }

  const { cx, cy, a, b } = result.ellipse;
  const avgRadius = (a + b) / 2;

  return {
    success: true,
    center_x: cx,
    center_y: cy,
    radius: avgRadius,
    radius_x: a,
    radius_y: b,
    rotation_offset: result.rotation_offset ?? -9.0,
    confidence: result.confidence,
    method: result.method ?? 'detection',
    message: result.message,
    ellipse: result.ellipse,
    is_angled: result.is_angled ?? (Math.abs(a - b) / Math.max(a, b) > 0.1),
    homography: result.homography,
    overlay_points: result.overlay_points,
    canonical_preview: result.canonical_preview ?? null,
    center: { x: cx, y: cy },
    radiusX: a,
    radiusY: b,
  };
}

export function parseScoreToTarget(label: string): DartTarget {
  if (!label || label === 'MISS') return 'MISS';
  if (label === 'D-BULL') return 'BULL';
  if (label === 'BULL') return 'OB';

  if (label.startsWith('T')) {
    const num = parseInt(label.slice(1), 10);
    if (num >= 1 && num <= 20) return `T${num}` as DartTarget;
  }
  if (label.startsWith('D')) {
    const num = parseInt(label.slice(1), 10);
    if (num >= 1 && num <= 20) return `D${num}` as DartTarget;
  }
  const num = parseInt(label, 10);
  if (!isNaN(num) && num >= 1 && num <= 20) return `S${num}` as DartTarget;
  return 'MISS';
}

export function captureVideoFrame(video: HTMLVideoElement, quality: number = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      reject(new Error('Video not ready'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      'image/jpeg',
      quality
    );
  });
}

export function captureHighQualityFrame(video: HTMLVideoElement): Promise<Blob> {
  return captureVideoFrame(video, 0.90);
}

export async function autoCalibrate(imageBlob: Blob): Promise<AutoCalibrationResult | null> {
  const result = await detectBoard(imageBlob);
  if (!result) return null;
  return boardDetectToCalibration(result);
}

export async function autoCalibrateWithRetry(imageBlob: Blob, maxRetries = 3): Promise<AutoCalibrationResult | null> {
  const result = await detectBoardWithRetry(imageBlob, maxRetries);
  if (!result) {
    return {
      success: false,
      center_x: null,
      center_y: null,
      radius: null,
      rotation_offset: null,
      confidence: 0,
      method: 'failed',
      message: 'Board not found. Try better lighting or move the camera closer.',
    };
  }
  return boardDetectToCalibration(result);
}
