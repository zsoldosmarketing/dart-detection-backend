export interface LocalCalibrationResult {
  success: boolean;
  center_x: number;
  center_y: number;
  radius: number;
  radius_x: number;
  radius_y: number;
  rotation_offset: number;
  confidence: number;
  method: string;
  message: string;
  ellipse: {
    center_x: number;
    center_y: number;
    axis_major: number;
    axis_minor: number;
    angle: number;
  } | null;
  is_angled: boolean;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, v * 100];
}

function isRedColor(h: number, s: number, v: number): boolean {
  return ((h <= 15 || h >= 345) && s >= 30 && v >= 20);
}

function isGreenColor(h: number, s: number, v: number): boolean {
  return (h >= 70 && h <= 160 && s >= 25 && v >= 15);
}

function isBlackColor(s: number, v: number): boolean {
  return (v <= 30 && s <= 50);
}

function isWhiteColor(s: number, v: number): boolean {
  return (v >= 70 && s <= 25);
}

export function detectBoardFromCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): LocalCalibrationResult {
  const width = canvas.width;
  const height = canvas.height;

  if (width === 0 || height === 0) {
    return createFailedResult('Ures kep');
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const boardMask = new Uint8Array(width * height);
  let boardPixelCount = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, v] = rgbToHsv(r, g, b);

      const isBoardColor = isRedColor(h, s, v) ||
                           isGreenColor(h, s, v) ||
                           isBlackColor(s, v) ||
                           isWhiteColor(s, v);

      if (isBoardColor) {
        boardMask[y * width + x] = 1;
        boardPixelCount++;
        sumX += x;
        sumY += y;
      }
    }
  }

  if (boardPixelCount < 1000) {
    return createCenterFallback(width, height, 'Nem talaltam eleg tabla pixelt');
  }

  let centerX = Math.round(sumX / boardPixelCount);
  let centerY = Math.round(sumY / boardPixelCount);

  const redGreenMask = new Uint8Array(width * height);
  let redGreenCount = 0;
  let rgSumX = 0;
  let rgSumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, v] = rgbToHsv(r, g, b);

      if (isRedColor(h, s, v) || isGreenColor(h, s, v)) {
        redGreenMask[y * width + x] = 1;
        redGreenCount++;
        rgSumX += x;
        rgSumY += y;
      }
    }
  }

  if (redGreenCount > 500) {
    centerX = Math.round(rgSumX / redGreenCount);
    centerY = Math.round(rgSumY / redGreenCount);
  }

  const distances: number[] = [];
  const angleDistances: Map<number, number[]> = new Map();

  for (let angle = 0; angle < 360; angle += 5) {
    angleDistances.set(angle, []);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (boardMask[y * width + x] === 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 20) {
          distances.push(dist);

          let angle = Math.atan2(dy, dx) * 180 / Math.PI;
          if (angle < 0) angle += 360;
          const angleKey = Math.round(angle / 5) * 5 % 360;

          const arr = angleDistances.get(angleKey);
          if (arr) arr.push(dist);
        }
      }
    }
  }

  if (distances.length < 100) {
    return createCenterFallback(width, height, 'Nem talaltam eleg pontot');
  }

  const sortedDistances = [...distances].sort((a, b) => b - a);
  const percentile95 = sortedDistances[Math.floor(sortedDistances.length * 0.05)];
  const percentile85 = sortedDistances[Math.floor(sortedDistances.length * 0.15)];
  const detectedRadius = (percentile95 + percentile85) / 2;

  const radiiByAngle: number[] = [];
  for (let angle = 0; angle < 360; angle += 5) {
    const dists = angleDistances.get(angle);
    if (dists && dists.length > 0) {
      const sorted = [...dists].sort((a, b) => b - a);
      const maxDist = sorted[Math.floor(sorted.length * 0.1)] || sorted[0];
      radiiByAngle.push(maxDist);
    }
  }

  let radiusX = detectedRadius;
  let radiusY = detectedRadius;
  let ellipseAngle = 0;

  if (radiiByAngle.length >= 36) {
    const horizontalRadii = [
      ...radiiByAngle.slice(0, 6),
      ...radiiByAngle.slice(66, 72)
    ];
    const verticalRadii = radiiByAngle.slice(15, 21).concat(radiiByAngle.slice(51, 57));

    if (horizontalRadii.length > 0 && verticalRadii.length > 0) {
      radiusX = horizontalRadii.reduce((a, b) => a + b, 0) / horizontalRadii.length;
      radiusY = verticalRadii.reduce((a, b) => a + b, 0) / verticalRadii.length;
    }
  }

  const BOARD_SCALE = 1.15;
  radiusX = Math.round(radiusX * BOARD_SCALE);
  radiusY = Math.round(radiusY * BOARD_SCALE);
  const avgRadius = Math.round((radiusX + radiusY) / 2);

  const isAngled = Math.abs(radiusX - radiusY) / Math.max(radiusX, radiusY) > 0.1;

  const confidence = calculateConfidence(boardPixelCount, width * height, radiiByAngle.length);

  return {
    success: true,
    center_x: centerX,
    center_y: centerY,
    radius: avgRadius,
    radius_x: radiusX,
    radius_y: radiusY,
    rotation_offset: -9,
    confidence,
    method: 'local_color_detection',
    message: `Tabla felismerve lokalis modszerrel (${Math.round(confidence * 100)}%)`,
    ellipse: {
      center_x: centerX,
      center_y: centerY,
      axis_major: radiusX * 2,
      axis_minor: radiusY * 2,
      angle: ellipseAngle,
    },
    is_angled: isAngled,
  };
}

function calculateConfidence(
  boardPixels: number,
  totalPixels: number,
  angleCount: number
): number {
  const coverageRatio = boardPixels / totalPixels;
  let confidence = 0.3;

  if (coverageRatio >= 0.1 && coverageRatio <= 0.8) {
    confidence += 0.2;
  }

  if (angleCount >= 60) {
    confidence += 0.3;
  } else if (angleCount >= 30) {
    confidence += 0.15;
  }

  confidence += Math.min(coverageRatio * 0.2, 0.2);

  return Math.min(confidence, 0.95);
}

function createFailedResult(message: string): LocalCalibrationResult {
  return {
    success: false,
    center_x: 0,
    center_y: 0,
    radius: 0,
    radius_x: 0,
    radius_y: 0,
    rotation_offset: 0,
    confidence: 0,
    method: 'failed',
    message,
    ellipse: null,
    is_angled: false,
  };
}

function createCenterFallback(width: number, height: number, reason: string): LocalCalibrationResult {
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const radius = Math.round(Math.min(width, height) / 3);

  return {
    success: true,
    center_x: centerX,
    center_y: centerY,
    radius,
    radius_x: radius,
    radius_y: radius,
    rotation_offset: -9,
    confidence: 0.35,
    method: 'center_fallback',
    message: `${reason} - kozepre igazitva`,
    ellipse: {
      center_x: centerX,
      center_y: centerY,
      axis_major: radius * 2,
      axis_minor: radius * 2,
      angle: 0,
    },
    is_angled: false,
  };
}

export async function detectBoardFromVideo(
  video: HTMLVideoElement
): Promise<LocalCalibrationResult> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return createFailedResult('Canvas context nem elerheto');
  }

  ctx.drawImage(video, 0, 0);

  return detectBoardFromCanvas(canvas, ctx);
}
