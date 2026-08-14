import assert from 'node:assert/strict';

const moduleUrl = process.env.MANUAL_CALIBRATION_MODULE;
if (!moduleUrl) {
  throw new Error('MANUAL_CALIBRATION_MODULE must point to the compiled module.');
}

const { calibrateFromManualPoints } = await import(moduleUrl);

const calibration = calibrateFromManualPoints([
  { target: 'BULL', x: 400, y: 400 },
  { target: 'D20', x: 400, y: 200 },
  { target: 'D6', x: 600, y: 400 },
  { target: 'D3', x: 400, y: 600 },
  { target: 'D11', x: 200, y: 400 },
]);

assert.equal(calibration.success, true);
assert.equal(calibration.ellipse.cx, 400);
assert.equal(calibration.ellipse.cy, 400);
assert.equal(calibration.ellipse.a, 200);
assert.equal(calibration.ellipse.b, 200);
assert.equal(Math.round(calibration.ellipse.angle), 0);
assert.equal(Math.round(calibration.rotationOffset), 351);
assert.ok(calibration.confidence >= 0.9);

const rotated = calibrateFromManualPoints([
  { target: 'BULL', x: 300, y: 300 },
  { target: 'D20', x: 450, y: 150 },
  { target: 'D6', x: 450, y: 450 },
  { target: 'D3', x: 150, y: 450 },
  { target: 'D11', x: 150, y: 150 },
]);
assert.equal(rotated.success, true);
assert.ok(rotated.confidence >= 0.55);
assert.ok(Number.isFinite(rotated.rotationOffset));

const invalid = calibrateFromManualPoints([
  { target: 'BULL', x: 1, y: 1 },
  { target: 'D20', x: 2, y: 2 },
]);
assert.equal(invalid.success, false);

console.log('Manual board calibration regression tests passed.');
