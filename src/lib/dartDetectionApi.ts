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
}

const DEFAULT_API_URL = import.meta.env.VITE_DART_DETECTION_API_URL || 'https://dart-detection-backend.onrender.com';

export function getApiUrl(): string {
  const override = localStorage.getItem('dart_backend_url_override');
  if (override && override.includes('dart-detection-backend.onrender.com')) {
    return override;
  }
  return DEFAULT_API_URL;
}

export function isApiConfigured(): boolean {
  return DEFAULT_API_URL.length > 0;
}

export async function checkApiHealth(retries = 3): Promise<{ status: string; board_found: boolean; has_homography: boolean } | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.log(`[API] Health check ${attempt + 1}/${retries} failed:`, err instanceof Error ? err.message : 'timeout');
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  return null;
}

export async function detectBoard(imageBlob: Blob): Promise<BoardDetectResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'board.jpg');

    console.log('[API] Detecting board...');
    const response = await fetch(`${apiUrl}/board/detect`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error('[API] Board detection failed:', response.status);
      return null;
    }
    const result = await response.json();
    console.log('[API] Board detection result:', result);
    return result;
  } catch (err) {
    console.error('[API] Board detection error:', err instanceof Error ? err.message : 'timeout');
    return null;
  }
}

export async function detectBoardWithRetry(imageBlob: Blob, maxRetries = 2): Promise<BoardDetectResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await detectBoard(imageBlob);
    if (result && result.board_found && result.confidence >= 0.4) {
      return result;
    }
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

export async function scoreThrow(
  beforeBlob: Blob,
  afterBlob: Blob,
  homography?: number[][]
): Promise<ThrowScoreResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('before', beforeBlob, 'before.jpg');
    formData.append('after', afterBlob, 'after.jpg');
    if (homography) {
      formData.append('homography', JSON.stringify(homography));
    }

    console.log('[API] Scoring throw...');
    const response = await fetch(`${apiUrl}/throw/score`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error('[API] Throw scoring failed:', response.status);
      return null;
    }
    const result = await response.json();
    console.log('[API] Throw score result:', result);
    return result;
  } catch (err) {
    console.error('[API] Throw scoring error:', err instanceof Error ? err.message : 'timeout');
    return null;
  }
}

export async function setReferenceImage(imageBlob: Blob): Promise<{ status: string; canonical_preview?: string } | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'reference.jpg');

    const response = await fetch(`${apiUrl}/set-reference`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('[API] Set reference error:', err);
    return null;
  }
}

export async function resetSession(): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;

  try {
    const response = await fetch(`${apiUrl}/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
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
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/session/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
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
    rotation_offset: -9.0,
    confidence: result.confidence,
    method: 'homography',
    message: result.message,
    ellipse: result.ellipse,
    is_angled: Math.abs(a - b) / Math.max(a, b) > 0.1,
    homography: result.homography,
    overlay_points: result.overlay_points,
    canonical_preview: result.canonical_preview,
  };
}

export function parseScoreToTarget(label: string): DartTarget {
  if (!label || label === 'MISS') {
    return 'MISS';
  }

  if (label === 'D-BULL') {
    return 'BULL';
  }

  if (label === 'BULL') {
    return 'OB';
  }

  if (label.startsWith('T')) {
    const num = parseInt(label.slice(1), 10);
    if (num >= 1 && num <= 20) {
      return `T${num}` as DartTarget;
    }
  }

  if (label.startsWith('D')) {
    const num = parseInt(label.slice(1), 10);
    if (num >= 1 && num <= 20) {
      return `D${num}` as DartTarget;
    }
  }

  const num = parseInt(label, 10);
  if (!isNaN(num) && num >= 1 && num <= 20) {
    return `S${num}` as DartTarget;
  }

  return 'MISS';
}

export function captureVideoFrame(video: HTMLVideoElement, quality: number = 0.80): Promise<Blob> {
  return new Promise((resolve, reject) => {
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
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

export function captureHighQualityFrame(video: HTMLVideoElement): Promise<Blob> {
  return captureVideoFrame(video, 0.85);
}

export async function autoCalibrate(imageBlob: Blob): Promise<AutoCalibrationResult | null> {
  const result = await detectBoard(imageBlob);
  if (!result) return null;
  return boardDetectToCalibration(result);
}

export async function autoCalibrateWithRetry(imageBlob: Blob, maxRetries = 2): Promise<AutoCalibrationResult | null> {
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
      message: 'Tabla nem talalhato. Probald jobb megvilagitassal vagy kozelebb.',
    };
  }
  return boardDetectToCalibration(result);
}
