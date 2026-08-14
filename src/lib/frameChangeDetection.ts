export interface EllipseData {
  cx: number;
  cy: number;
  a: number;
  b: number;
  angle: number;
}

export interface FrameChangeData {
  changedPixelRatio: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
  meanDelta: number;
}

export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface FrameChangeOptions {
  threshold?: number;
  boardEllipse?: EllipseData | null;
}

function isInsideBoard(x: number, y: number, ellipse: EllipseData | null | undefined): boolean {
  if (!ellipse) return true;

  const angle = ellipse.angle * Math.PI / 180;
  const dx = x - ellipse.cx;
  const dy = y - ellipse.cy;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const normalizedDistance = (localX / (ellipse.a * 1.1)) ** 2 + (localY / (ellipse.b * 1.1)) ** 2;
  return normalizedDistance <= 1;
}

function emptyChange(): FrameChangeData {
  return {
    changedPixelRatio: 0,
    cx: 0,
    cy: 0,
    width: 0,
    height: 0,
    meanDelta: 0,
  };
}

export function analyzeFrameChange(
  before: PixelFrame,
  after: PixelFrame,
  options: FrameChangeOptions = {},
): FrameChangeData {
  if (before.width !== after.width || before.height !== after.height) {
    return emptyChange();
  }

  const threshold = options.threshold ?? 45;
  let changedPixels = 0;
  let consideredPixels = 0;
  let sumX = 0;
  let sumY = 0;
  let sumDelta = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < after.height; y++) {
    for (let x = 0; x < after.width; x++) {
      if (!isInsideBoard(x, y, options.boardEllipse)) continue;
      consideredPixels++;

      const index = (y * after.width + x) * 4;
      const delta = (
        Math.abs(after.data[index] - before.data[index]) +
        Math.abs(after.data[index + 1] - before.data[index + 1]) +
        Math.abs(after.data[index + 2] - before.data[index + 2])
      ) / 3;

      if (delta < threshold) continue;
      changedPixels++;
      sumX += x;
      sumY += y;
      sumDelta += delta;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (changedPixels === 0 || consideredPixels === 0) return emptyChange();

  return {
    changedPixelRatio: changedPixels / consideredPixels,
    cx: sumX / changedPixels,
    cy: sumY / changedPixels,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    meanDelta: sumDelta / changedPixels,
  };
}
