export interface BoardCalibration {
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
  angle: number;
  rotationOffset: number;
}

export interface DetectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometryScore {
  label: string;
  score: number;
  distanceRatio: number;
}

export interface FrameChangeRegion {
  changedPixelRatio: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
  meanDelta: number;
}

export interface DetectionWithConfidence extends DetectionBounds {
  confidence: number;
}

export type FrameChangeQuality = 'valid' | 'too_little_change' | 'too_much_change' | 'missing';

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const RING_RATIOS = {
  doubleBull: 0.032,
  singleBull: 0.08,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1.0,
};

function normalizeDegrees(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function isValidCalibration(calibration: BoardCalibration | null): calibration is BoardCalibration {
  if (!calibration) return false;
  return [
    calibration.cx,
    calibration.cy,
    calibration.radiusX,
    calibration.radiusY,
    calibration.angle,
    calibration.rotationOffset,
  ].every(Number.isFinite)
    && calibration.radiusX > 0
    && calibration.radiusY > 0;
}

export function getFrameChangeQuality(region: FrameChangeRegion | null): FrameChangeQuality {
  if (!region || !Number.isFinite(region.changedPixelRatio)) return 'missing';
  if (region.changedPixelRatio < 0.0005) return 'too_little_change';
  if (region.changedPixelRatio > 0.18) return 'too_much_change';
  return 'valid';
}

export function selectDetectionForFrameChange<T extends DetectionWithConfidence>(
  detections: T[],
  region: FrameChangeRegion | null,
): T | null {
  if (detections.length === 0) return null;
  if (getFrameChangeQuality(region) !== 'valid' || !region) {
    return detections.reduce((best, detection) =>
      detection.confidence > best.confidence ? detection : best,
    );
  }

  return detections.reduce((best, detection) => {
    const detectionScale = Math.max(detection.width, detection.height, 20);
    const regionScale = Math.max(region.width, region.height, 20);
    const scale = Math.max(detectionScale, regionScale);
    const distance = Math.hypot(detection.x - region.cx, detection.y - region.cy);
    const proximity = Math.max(0, 1 - distance / (scale * 2.5));
    const candidateScore = detection.confidence * 0.65 + proximity * 0.35;
    const bestDistance = Math.hypot(best.x - region.cx, best.y - region.cy);
    const bestProximity = Math.max(0, 1 - bestDistance / (Math.max(best.width, best.height, regionScale, 20) * 2.5));
    const bestScore = best.confidence * 0.65 + bestProximity * 0.35;
    return candidateScore > bestScore ? detection : best;
  });
}

export function estimateDartTip(
  detection: DetectionBounds,
  calibration: BoardCalibration | null,
): { x: number; y: number } {
  if (!isValidCalibration(calibration) || detection.width <= 0 || detection.height <= 0) {
    return { x: detection.x, y: detection.y };
  }

  const halfWidth = detection.width / 2;
  const halfHeight = detection.height / 2;
  const candidates = [
    { x: detection.x - halfWidth, y: detection.y - halfHeight },
    { x: detection.x + halfWidth, y: detection.y - halfHeight },
    { x: detection.x - halfWidth, y: detection.y + halfHeight },
    { x: detection.x + halfWidth, y: detection.y + halfHeight },
  ];

  return candidates.reduce((closest, candidate) => {
    const closestDistance = Math.hypot(closest.x - calibration.cx, closest.y - calibration.cy);
    const candidateDistance = Math.hypot(candidate.x - calibration.cx, candidate.y - calibration.cy);
    return candidateDistance < closestDistance ? candidate : closest;
  });
}

export function scoreDartPosition(
  tipX: number,
  tipY: number,
  calibration: BoardCalibration,
): GeometryScore {
  const dx = tipX - calibration.cx;
  const dy = tipY - calibration.cy;
  const ellipseAngle = calibration.angle * Math.PI / 180;
  const localX = dx * Math.cos(ellipseAngle) + dy * Math.sin(ellipseAngle);
  const localY = -dx * Math.sin(ellipseAngle) + dy * Math.cos(ellipseAngle);
  const normalizedX = localX / calibration.radiusX;
  const normalizedY = localY / calibration.radiusY;
  const distanceRatio = Math.hypot(normalizedX, normalizedY);

  if (distanceRatio > 1.03) {
    return { label: 'MISS', score: 0, distanceRatio };
  }
  if (distanceRatio <= RING_RATIOS.doubleBull) {
    return { label: 'D-BULL', score: 50, distanceRatio };
  }
  if (distanceRatio <= RING_RATIOS.singleBull) {
    return { label: 'BULL', score: 25, distanceRatio };
  }

  const boardAngle = Math.atan2(normalizedX, -normalizedY) * 180 / Math.PI;
  const adjustedAngle = normalizeDegrees(boardAngle + calibration.rotationOffset + 9);
  const segmentIndex = Math.floor(adjustedAngle / 18) % 20;
  const segment = SECTOR_ORDER[segmentIndex];

  if (distanceRatio >= RING_RATIOS.doubleInner) {
    return { label: `D${segment}`, score: segment * 2, distanceRatio };
  }
  if (distanceRatio >= RING_RATIOS.tripleInner && distanceRatio <= RING_RATIOS.tripleOuter) {
    return { label: `T${segment}`, score: segment * 3, distanceRatio };
  }
  return { label: `${segment}`, score: segment, distanceRatio };
}
