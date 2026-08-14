export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type CameraQualityIssue = 'too_dark' | 'too_bright' | 'low_contrast' | 'too_blurry';

export interface CameraQualityResult {
  usable: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
  issues: CameraQualityIssue[];
  message: string | null;
}

function luminance(data: Uint8ClampedArray, index: number): number {
  return data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
}

export function analyzeCameraQuality(frame: PixelFrame): CameraQualityResult {
  const { width, height, data } = frame;
  if (width < 8 || height < 8 || data.length < width * height * 4) {
    return {
      usable: false,
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      issues: ['low_contrast'],
      message: 'A kamerakép túl kicsi a pontos felismeréshez.',
    };
  }

  const stride = Math.max(1, Math.ceil(Math.max(width, height) / 320));
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  let laplacianSum = 0;
  let laplacianSquares = 0;
  let laplacianCount = 0;

  for (let y = stride; y < height - stride; y += stride) {
    for (let x = stride; x < width - stride; x += stride) {
      const centerIndex = (y * width + x) * 4;
      const value = luminance(data, centerIndex);
      sum += value;
      sumSquares += value * value;
      count++;

      const top = luminance(data, ((y - stride) * width + x) * 4);
      const bottom = luminance(data, ((y + stride) * width + x) * 4);
      const left = luminance(data, (y * width + x - stride) * 4);
      const right = luminance(data, (y * width + x + stride) * 4);
      const laplacian = top + bottom + left + right - 4 * value;
      laplacianSum += laplacian;
      laplacianSquares += laplacian * laplacian;
      laplacianCount++;
    }
  }

  const brightness = sum / Math.max(1, count);
  const variance = Math.max(0, sumSquares / Math.max(1, count) - brightness ** 2);
  const contrast = Math.sqrt(variance);
  const laplacianMean = laplacianSum / Math.max(1, laplacianCount);
  const sharpness = Math.max(0, laplacianSquares / Math.max(1, laplacianCount) - laplacianMean ** 2);
  const issues: CameraQualityIssue[] = [];

  if (brightness < 42) issues.push('too_dark');
  if (brightness > 220) issues.push('too_bright');
  if (contrast < 14) issues.push('low_contrast');
  if (sharpness < 24) issues.push('too_blurry');

  const message = issues.includes('too_dark')
    ? 'Túl sötét a kamerakép. Javíts a táblavilágításon a pontos felismeréshez.'
    : issues.includes('too_bright')
      ? 'Túl világos vagy kiégett a kamerakép. Csökkentsd a közvetlen fényt vagy az expozíciót.'
      : issues.includes('low_contrast')
        ? 'Alacsony a képkontraszt. Ellenőrizd a megvilágítást és a kamera fókuszát.'
        : issues.includes('too_blurry')
          ? 'Homályos a kamerakép. Állítsd élesre a kamerát, mielőtt automatikus pontozást használsz.'
          : null;

  return {
    usable: issues.length === 0,
    brightness,
    contrast,
    sharpness,
    issues,
    message,
  };
}
