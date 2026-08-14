import assert from 'node:assert/strict';

const moduleUrl = process.env.FRAME_CHANGE_MODULE;
if (!moduleUrl) {
  throw new Error('FRAME_CHANGE_MODULE must point to the compiled module.');
}

const { analyzeFrameChange } = await import(moduleUrl);

function frame(width, height, changedPixels = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (const { x, y, value = 255 } of changedPixels) {
    const index = (y * width + x) * 4;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  return { width, height, data };
}

const before = frame(10, 10);
const after = frame(10, 10, [
  { x: 6, y: 4 },
  { x: 7, y: 4 },
  { x: 6, y: 5 },
  { x: 7, y: 5 },
]);

const change = analyzeFrameChange(before, after, { threshold: 40 });
assert.equal(change.changedPixelRatio, 0.04);
assert.equal(change.cx, 6.5);
assert.equal(change.cy, 4.5);
assert.equal(change.width, 2);
assert.equal(change.height, 2);
assert.equal(change.meanDelta, 255);

const noChange = analyzeFrameChange(before, before);
assert.deepEqual(noChange, {
  changedPixelRatio: 0,
  cx: 0,
  cy: 0,
  width: 0,
  height: 0,
  meanDelta: 0,
});

const outsideBoard = analyzeFrameChange(before, after, {
  boardEllipse: { cx: 2, cy: 2, a: 1, b: 1, angle: 0 },
});
assert.equal(outsideBoard.changedPixelRatio, 0, 'Motion outside the calibrated board must be ignored.');

console.log('Frame change detection regression tests passed.');
