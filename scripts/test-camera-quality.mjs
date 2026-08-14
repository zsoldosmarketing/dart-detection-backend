import assert from 'node:assert/strict';

const moduleUrl = process.env.CAMERA_QUALITY_MODULE;
if (!moduleUrl) {
  throw new Error('CAMERA_QUALITY_MODULE must point to the compiled module.');
}

const { analyzeCameraQuality } = await import(moduleUrl);

function frame(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const [r, g, b] = pixel(x, y);
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

const dark = analyzeCameraQuality(frame(32, 32, () => [10, 10, 10]));
assert.equal(dark.usable, false);
assert.ok(dark.issues.includes('too_dark'));

const bright = analyzeCameraQuality(frame(32, 32, () => [250, 250, 250]));
assert.equal(bright.usable, false);
assert.ok(bright.issues.includes('too_bright'));

const flat = analyzeCameraQuality(frame(32, 32, () => [128, 128, 128]));
assert.equal(flat.usable, false);
assert.ok(flat.issues.includes('low_contrast'));

const sharpCheckerboard = analyzeCameraQuality(frame(64, 64, (x, y) => {
  const value = (x + y) % 2 === 0 ? 35 : 215;
  return [value, value, value];
}));
assert.equal(sharpCheckerboard.usable, true);
assert.ok(sharpCheckerboard.sharpness > 24);

console.log('Camera quality regression tests passed.');
