export type ManualCalibrationTarget = 'BULL' | 'D20' | 'D6' | 'D3' | 'D11';

export interface ManualCalibrationPoint {
  target: ManualCalibrationTarget;
  x: number;
  y: number;
}

export interface ManualBoardCalibration {
  success: boolean;
  confidence: number;
  ellipse: { cx: number; cy: number; a: number; b: number; angle: number } | null;
  rotationOffset: number;
  message: string;
}

function normalizeDegrees(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getPoint(points: ManualCalibrationPoint[], target: ManualCalibrationTarget): ManualCalibrationPoint | null {
  return points.find(point => point.target === target) ?? null;
}

function vector(from: ManualCalibrationPoint, to: ManualCalibrationPoint): { x: number; y: number } {
  return { x: to.x - from.x, y: to.y - from.y };
}

function magnitude(value: { x: number; y: number }): number {
  return Math.hypot(value.x, value.y);
}

function invalid(message: string): ManualBoardCalibration {
  return { success: false, confidence: 0, ellipse: null, rotationOffset: 0, message };
}

export function calibrateFromManualPoints(points: ManualCalibrationPoint[]): ManualBoardCalibration {
  const uniqueTargets = new Set(points.map(point => point.target));
  if (uniqueTargets.size !== 5) {
    return invalid('Az összes referenciapont kijelölése szükséges.');
  }

  const bull = getPoint(points, 'BULL');
  const d20 = getPoint(points, 'D20');
  const d6 = getPoint(points, 'D6');
  const d3 = getPoint(points, 'D3');
  const d11 = getPoint(points, 'D11');
  if (!bull || !d20 || !d6 || !d3 || !d11) return invalid('Hiányzik egy kötelező referenciapont.');

  const top = vector(bull, d20);
  const right = vector(bull, d6);
  const bottom = vector(bull, d3);
  const left = vector(bull, d11);
  const topRadius = magnitude(top);
  const rightRadius = magnitude(right);
  const bottomRadius = magnitude(bottom);
  const leftRadius = magnitude(left);

  if ([topRadius, rightRadius, bottomRadius, leftRadius].some(radius => radius < 20)) {
    return invalid('A kiválasztott referenciapontok túl közel vannak egymáshoz.');
  }

  const horizontalRadius = (rightRadius + leftRadius) / 2;
  const verticalRadius = (topRadius + bottomRadius) / 2;
  const angle = Math.atan2(right.y, right.x) * 180 / Math.PI;
  const radians = angle * Math.PI / 180;
  const normalizedTopX = (top.x * Math.cos(radians) + top.y * Math.sin(radians)) / horizontalRadius;
  const normalizedTopY = (-top.x * Math.sin(radians) + top.y * Math.cos(radians)) / verticalRadius;
  const topAngle = Math.atan2(normalizedTopX, -normalizedTopY) * 180 / Math.PI;
  const rotationOffset = normalizeDegrees(-topAngle - 9);

  const horizontalBalance = Math.abs(rightRadius - leftRadius) / Math.max(rightRadius, leftRadius);
  const verticalBalance = Math.abs(topRadius - bottomRadius) / Math.max(topRadius, bottomRadius);
  const perpendicularity = Math.abs((top.x * right.x + top.y * right.y) / (topRadius * rightRadius));
  const confidence = Math.max(0.55, Math.min(0.95, 0.95 - horizontalBalance * 0.2 - verticalBalance * 0.2 - perpendicularity * 0.25));

  return {
    success: true,
    confidence,
    ellipse: {
      cx: bull.x,
      cy: bull.y,
      a: horizontalRadius,
      b: verticalRadius,
      angle,
    },
    rotationOffset,
    message: 'Kézi kalibráció elkészült öt referenciapontból.',
  };
}

export const MANUAL_CALIBRATION_TARGETS: Array<{ target: ManualCalibrationTarget; label: string; instruction: string }> = [
  { target: 'BULL', label: 'Bull', instruction: 'Kattints pontosan a bull közepére.' },
  { target: 'D20', label: 'Dupla 20', instruction: 'Kattints a dupla 20 közepére.' },
  { target: 'D6', label: 'Dupla 6', instruction: 'Kattints a dupla 6 közepére.' },
  { target: 'D3', label: 'Dupla 3', instruction: 'Kattints a dupla 3 közepére.' },
  { target: 'D11', label: 'Dupla 11', instruction: 'Kattints a dupla 11 közepére.' },
];
