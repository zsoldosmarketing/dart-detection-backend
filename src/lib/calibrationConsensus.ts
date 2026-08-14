export interface BoardEllipse {
  cx: number;
  cy: number;
  a: number;
  b: number;
  angle: number;
}

export interface BoardCalibrationCandidate {
  source: string;
  confidence: number;
  ellipse: BoardEllipse;
}

export interface CalibrationConsensus {
  accepted: boolean;
  confidence: number;
  ellipse: BoardEllipse | null;
  acceptedSources: string[];
  reason: string;
}

const MAX_CENTER_DISTANCE_RATIO = 0.12;
const MAX_RADIUS_RATIO_DIFFERENCE = 0.18;
const MAX_ANGLE_DIFFERENCE = 15;

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeAngle(angle: number): number {
  const normalized = angle % 180;
  return normalized < 0 ? normalized + 180 : normalized;
}

function angularDistance(first: number, second: number): number {
  const difference = Math.abs(normalizeAngle(first) - normalizeAngle(second));
  return Math.min(difference, 180 - difference);
}

function isFiniteEllipse(ellipse: BoardEllipse): boolean {
  return [ellipse.cx, ellipse.cy, ellipse.a, ellipse.b, ellipse.angle].every(Number.isFinite)
    && ellipse.a > 0
    && ellipse.b > 0;
}

function weightedOrientation(candidates: BoardCalibrationCandidate[], totalWeight: number): number {
  let cosine = 0;
  let sine = 0;

  for (const candidate of candidates) {
    const weight = clampConfidence(candidate.confidence);
    const radians = normalizeAngle(candidate.ellipse.angle) * Math.PI / 180;
    cosine += Math.cos(radians * 2) * weight;
    sine += Math.sin(radians * 2) * weight;
  }

  const orientation = Math.atan2(sine / totalWeight, cosine / totalWeight) * 90 / Math.PI;
  return orientation < 0 ? orientation + 180 : orientation;
}

function areCompatible(first: BoardEllipse, second: BoardEllipse): boolean {
  const firstRadius = Math.max(first.a, first.b);
  const secondRadius = Math.max(second.a, second.b);
  const referenceRadius = Math.max(firstRadius, secondRadius);
  const centerDistance = Math.hypot(first.cx - second.cx, first.cy - second.cy);
  const radiusDifference = Math.abs(firstRadius - secondRadius) / referenceRadius;
  const aspectDifference = Math.abs((first.a / first.b) - (second.a / second.b));

  return centerDistance / referenceRadius <= MAX_CENTER_DISTANCE_RATIO
    && radiusDifference <= MAX_RADIUS_RATIO_DIFFERENCE
    && aspectDifference <= 0.12
    && angularDistance(first.angle, second.angle) <= MAX_ANGLE_DIFFERENCE;
}

export function buildCalibrationConsensus(
  candidates: BoardCalibrationCandidate[],
  minimumSources = 2,
): CalibrationConsensus {
  const valid = candidates.filter(candidate =>
    Number.isFinite(candidate.confidence)
    && candidate.confidence > 0
    && isFiniteEllipse(candidate.ellipse),
  );

  if (valid.length === 0) {
    return {
      accepted: false,
      confidence: 0,
      ellipse: null,
      acceptedSources: [],
      reason: 'Nincs értékelhető kalibrációs jelölt.',
    };
  }

  const clusters: BoardCalibrationCandidate[][] = [];
  for (const candidate of valid) {
    const cluster = clusters.find(existing =>
      existing.every(member => areCompatible(member.ellipse, candidate.ellipse)),
    );
    if (cluster) {
      cluster.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  const winningCluster = clusters.sort((first, second) => {
    const firstWeight = first.reduce((sum, candidate) => sum + clampConfidence(candidate.confidence), 0);
    const secondWeight = second.reduce((sum, candidate) => sum + clampConfidence(candidate.confidence), 0);
    return secondWeight - firstWeight;
  })[0];

  const totalWeight = winningCluster.reduce(
    (sum, candidate) => sum + clampConfidence(candidate.confidence),
    0,
  );
  const weighted = (value: (ellipse: BoardEllipse) => number): number =>
    winningCluster.reduce(
      (sum, candidate) => sum + value(candidate.ellipse) * clampConfidence(candidate.confidence),
      0,
    ) / totalWeight;

  const ellipse: BoardEllipse = {
    cx: weighted(candidate => candidate.cx),
    cy: weighted(candidate => candidate.cy),
    a: weighted(candidate => candidate.a),
    b: weighted(candidate => candidate.b),
    angle: weightedOrientation(winningCluster, totalWeight),
  };

  const averageConfidence = totalWeight / winningCluster.length;
  const sourceAgreement = Math.min(1, winningCluster.length / Math.max(minimumSources, 1));
  const confidence = clampConfidence(averageConfidence * (0.7 + sourceAgreement * 0.3));
  const accepted = winningCluster.length >= minimumSources && confidence >= 0.55;

  return {
    accepted,
    confidence,
    ellipse,
    acceptedSources: winningCluster.map(candidate => candidate.source),
    reason: accepted
      ? `${winningCluster.length} egymást megerősítő kalibrációs forrás.`
      : 'A kalibrációt még nem erősítette meg elegendő, egymással egyező forrás.',
  };
}

export function toBoardEllipse(
  ellipse: { cx: number; cy: number; a: number; b: number; angle: number },
): BoardEllipse {
  return { ...ellipse };
}

export function isCalibrationTrusted(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= 0.55;
}
