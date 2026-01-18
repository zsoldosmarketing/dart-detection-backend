import type { DartTarget } from './dartsEngine';

export interface ApiCalibrationData {
  center_x: number;
  center_y: number;
  radius: number;
  rotation_offset?: number;
}

export interface ApiDetectionResult {
  score: string;
  confidence: number;
  position: { x: number; y: number } | null;
}

export interface AutoCalibrationResult {
  success: boolean;
  center_x: number | null;
  center_y: number | null;
  radius: number | null;
  rotation_offset: number | null;
  confidence: number;
  method?: string;
  message: string;
}

export interface DartDetectionAdvanced {
  x: number;
  y: number;
  score: string;
  confidence: number;
  dart_id: number | null;
}

export interface MultiDartDetectionResult {
  darts: DartDetectionAdvanced[];
  total_confidence: number;
  method: string;
  message: string;
}

const DEFAULT_API_URL = import.meta.env.VITE_DART_DETECTION_API_URL || 'https://dart-detection-backend.onrender.com';

export function getApiUrl(): string {
  return DEFAULT_API_URL;
}

export function isApiConfigured(): boolean {
  return DEFAULT_API_URL.length > 0;
}

export async function checkApiHealth(): Promise<{ status: string; calibrated: boolean } | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function calibrateApi(data: ApiCalibrationData): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;

  try {
    const response = await fetch(`${apiUrl}/calibrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function autoCalibrate(
  imageBlob: Blob,
  useAdvanced: boolean = true
): Promise<AutoCalibrationResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'calibration.jpg');

    const url = `${apiUrl}/auto-calibrate?use_advanced=${useAdvanced}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function autoCalibrateWithRetry(
  imageBlob: Blob,
  maxRetries: number = 3
): Promise<AutoCalibrationResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const useAdvanced = attempt < 2;
    const result = await autoCalibrate(imageBlob, useAdvanced);

    if (result && result.success && result.confidence >= 0.5) {
      return result;
    }

    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    success: false,
    center_x: null,
    center_y: null,
    radius: null,
    rotation_offset: null,
    confidence: 0,
    method: 'failed',
    message: 'Nem talaltam tablat. Tippek: jobb megvilagitas, kozelebb a tablahoz, tiszta hatter.',
  };
}

export async function setReferenceImage(imageBlob: Blob): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;

  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'reference.jpg');

    const response = await fetch(`${apiUrl}/set-reference`, {
      method: 'POST',
      body: formData,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function detectDart(imageBlob: Blob): Promise<ApiDetectionResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'dart.jpg');

    const response = await fetch(`${apiUrl}/detect`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function detectDartWithPrevious(
  currentBlob: Blob,
  previousBlob: Blob
): Promise<ApiDetectionResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('current', currentBlob, 'current.jpg');
    formData.append('previous', previousBlob, 'previous.jpg');

    const response = await fetch(`${apiUrl}/detect-multiple`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function parseScoreToTarget(score: string): DartTarget {
  if (!score || score === 'MISS' || score === 'UNCALIBRATED') {
    return 'MISS';
  }

  if (score === 'D-BULL') {
    return 'BULL';
  }

  if (score === 'BULL') {
    return 'OB';
  }

  if (score.startsWith('T')) {
    const num = parseInt(score.slice(1), 10);
    if (num >= 1 && num <= 20) {
      return `T${num}` as DartTarget;
    }
  }

  if (score.startsWith('D')) {
    const num = parseInt(score.slice(1), 10);
    if (num >= 1 && num <= 20) {
      return `D${num}` as DartTarget;
    }
  }

  const num = parseInt(score, 10);
  if (!isNaN(num) && num >= 1 && num <= 20) {
    return `S${num}` as DartTarget;
  }

  return 'MISS';
}

export async function detectDartAdvanced(
  currentBlob: Blob,
  referenceBlob?: Blob,
  preprocess: boolean = true
): Promise<MultiDartDetectionResult | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('current', currentBlob, 'current.jpg');
    if (referenceBlob) {
      formData.append('reference', referenceBlob, 'reference.jpg');
    }

    const url = `${apiUrl}/detect-advanced?preprocess=${preprocess}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function preprocessImage(
  imageBlob: Blob,
  method: 'adaptive' | 'full' | 'enhance' | 'denoise' = 'adaptive'
): Promise<{ status: string; method: string; image_base64: string } | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');

    const url = `${apiUrl}/preprocess-image?method=${method}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function captureVideoFrame(video: HTMLVideoElement, quality: number = 0.95): Promise<Blob> {
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
  return captureVideoFrame(video, 0.98);
}
