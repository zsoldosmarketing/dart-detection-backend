import assert from 'node:assert/strict';

const moduleUrl = process.env.CALIBRATION_CONSENSUS_MODULE;
if (!moduleUrl) {
  throw new Error('CALIBRATION_CONSENSUS_MODULE must point to the compiled module.');
}

const { buildCalibrationConsensus, isCalibrationTrusted } = await import(moduleUrl);

const board = (overrides = {}) => ({
  cx: 500,
  cy: 400,
  a: 300,
  b: 295,
  angle: 3,
  ...overrides,
});

const agreement = buildCalibrationConsensus([
  { source: 'remote_model', confidence: 0.9, ellipse: board() },
  { source: 'on_device_color', confidence: 0.7, ellipse: board({ cx: 504, cy: 397, a: 296, b: 292, angle: 5 }) },
]);
assert.equal(agreement.accepted, true, 'Two compatible sources must produce a trusted consensus.');
assert.equal(agreement.acceptedSources.length, 2);
assert.ok(Math.abs(agreement.ellipse.cx - 501.75) < 0.01, 'The ellipse center must be confidence-weighted.');
assert.equal(isCalibrationTrusted(agreement.confidence), true);

const singleSource = buildCalibrationConsensus([
  { source: 'remote_model', confidence: 0.96, ellipse: board() },
]);
assert.equal(singleSource.accepted, false, 'One source must not unlock automatic scoring.');
assert.equal(isCalibrationTrusted(singleSource.confidence), true, 'Source confidence remains descriptive, not sufficient for consensus.');

const disagreement = buildCalibrationConsensus([
  { source: 'remote_model', confidence: 0.9, ellipse: board() },
  { source: 'on_device_color', confidence: 0.9, ellipse: board({ cx: 680, cy: 600, a: 180, b: 170, angle: 45 }) },
]);
assert.equal(disagreement.accepted, false, 'Incompatible board estimates must not unlock automatic scoring.');
assert.equal(disagreement.acceptedSources.length, 1);

const orientationBoundary = buildCalibrationConsensus([
  { source: 'remote_model', confidence: 0.8, ellipse: board({ angle: 179 }) },
  { source: 'on_device_color', confidence: 0.8, ellipse: board({ angle: 1 }) },
]);
assert.equal(orientationBoundary.accepted, true);
assert.ok(
  orientationBoundary.ellipse.angle < 3 || orientationBoundary.ellipse.angle > 177,
  'Equivalent orientations around 0°/180° must not average to 90°.',
);

const invalid = buildCalibrationConsensus([
  { source: 'broken', confidence: 0.9, ellipse: board({ a: 0 }) },
]);
assert.equal(invalid.accepted, false, 'Invalid ellipses must be rejected.');
assert.equal(invalid.ellipse, null);

console.log('Calibration consensus regression tests passed.');
