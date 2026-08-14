import assert from 'node:assert/strict';

const moduleUrl = process.env.CALIBRATED_SCORING_MODULE;
if (!moduleUrl) {
  throw new Error('CALIBRATED_SCORING_MODULE must point to the compiled scoring module.');
}

const { estimateDartTip, isValidCalibration, scoreDartPosition } = await import(moduleUrl);

const calibration = {
  cx: 400,
  cy: 400,
  radiusX: 100,
  radiusY: 100,
  angle: 0,
  rotationOffset: -9,
};

assert.equal(isValidCalibration(calibration), true);
assert.equal(isValidCalibration({ ...calibration, radiusX: 0 }), false);

assert.deepEqual(scoreDartPosition(400, 400, calibration), {
  label: 'D-BULL',
  score: 50,
  distanceRatio: 0,
});
assert.equal(scoreDartPosition(400, 393, calibration).label, 'BULL');
assert.equal(scoreDartPosition(400, 340, calibration).label, 'T20');
assert.equal(scoreDartPosition(400, 304, calibration).label, 'D20');
assert.equal(scoreDartPosition(460, 400, calibration).label, 'T6');
assert.equal(scoreDartPosition(400, 290, calibration).label, 'MISS');

const angledCalibration = {
  cx: 400,
  cy: 400,
  radiusX: 200,
  radiusY: 100,
  angle: 90,
  rotationOffset: -9,
};
assert.equal(
  scoreDartPosition(460, 400, angledCalibration).label,
  'T20',
  'The scoring geometry must honour the detected ellipse orientation.',
);

const estimatedTip = estimateDartTip(
  { x: 400, y: 350, width: 10, height: 30 },
  calibration,
);
assert.equal(estimatedTip.y, 365, 'The estimated tip must be the dart-box point closest to the bull.');

console.log('Calibrated ellipse scoring regression tests passed.');
