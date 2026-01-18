import type { DartTarget } from './dartsEngine';

export interface CalibrationPoint {
  boardX: number;
  boardY: number;
  screenX: number;
  screenY: number;
  target: DartTarget;
}

export interface CalibrationData {
  points: CalibrationPoint[];
  boardCenter: { x: number; y: number };
  boardRadius: number;
  homographyMatrix: number[][] | null;
  timestamp: number;
}

export interface DetectionResult {
  target: DartTarget;
  confidence: number;
  tipPosition: { x: number; y: number };
  boardPosition: { x: number; y: number };
  detectionTimeMs: number;
}

export interface DetectionConfig {
  burstCount: number;
  burstDelayMs: number;
  minConfidence: number;
  colorSensitivity: number;
  brightnessThreshold: number;
  minBlobSize: number;
  maxBlobSize: number;
  debugMode: boolean;
}

const DEFAULT_CONFIG: DetectionConfig = {
  burstCount: 3,
  burstDelayMs: 50,
  minConfidence: 0.6,
  colorSensitivity: 30,
  brightnessThreshold: 25,
  minBlobSize: 50,
  maxBlobSize: 5000,
  debugMode: false,
};

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const RING_RATIOS = {
  doubleBull: 0.032,
  singleBull: 0.08,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1.0,
};

export class VisionDetectionEngine {
  private config: DetectionConfig;
  private calibration: CalibrationData | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private previousFrame: ImageData | null = null;
  private debugCanvas: HTMLCanvasElement | null = null;
  private debugCtx: CanvasRenderingContext2D | null = null;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to create canvas context');
    this.ctx = ctx;
  }

  setConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DetectionConfig {
    return { ...this.config };
  }

  setDebugCanvas(canvas: HTMLCanvasElement | null): void {
    this.debugCanvas = canvas;
    if (canvas) {
      this.debugCtx = canvas.getContext('2d', { willReadFrequently: true });
    } else {
      this.debugCtx = null;
    }
  }

  setCalibration(calibration: CalibrationData): void {
    this.calibration = calibration;
    if (calibration.points.length >= 4) {
      this.calibration.homographyMatrix = this.computeHomography(calibration.points);
    }
  }

  getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  clearCalibration(): void {
    this.calibration = null;
  }

  isCalibrated(): boolean {
    return this.calibration !== null && this.calibration.points.length >= 4;
  }

  captureFrame(video: HTMLVideoElement): ImageData {
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.ctx.drawImage(video, 0, 0);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  async captureBurst(video: HTMLVideoElement): Promise<ImageData[]> {
    const frames: ImageData[] = [];
    for (let i = 0; i < this.config.burstCount; i++) {
      frames.push(this.captureFrame(video));
      if (i < this.config.burstCount - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.burstDelayMs));
      }
    }
    return frames;
  }

  setBaselineFrame(frame: ImageData): void {
    this.previousFrame = frame;
  }

  detectDart(currentFrame: ImageData): DetectionResult | null {
    const startTime = performance.now();

    if (!this.previousFrame || !this.calibration) {
      return null;
    }

    const diffPixels = this.computeFrameDiff(this.previousFrame, currentFrame);

    if (this.debugCtx && this.debugCanvas) {
      this.debugCanvas.width = currentFrame.width;
      this.debugCanvas.height = currentFrame.height;
      const debugData = new ImageData(diffPixels, currentFrame.width, currentFrame.height);
      this.debugCtx.putImageData(debugData, 0, 0);
    }

    const blobs = this.findBlobs(diffPixels, currentFrame.width, currentFrame.height);

    if (blobs.length === 0) {
      return null;
    }

    const dartBlob = this.selectBestBlob(blobs);
    if (!dartBlob) {
      return null;
    }

    const tipPosition = this.estimateTipPosition(dartBlob, currentFrame);
    const boardPosition = this.screenToBoard(tipPosition);

    if (!boardPosition) {
      return null;
    }

    const target = this.positionToTarget(boardPosition);
    const confidence = this.calculateConfidence(dartBlob, tipPosition);

    const detectionTimeMs = performance.now() - startTime;

    if (this.debugCtx && this.debugCanvas) {
      this.debugCtx.strokeStyle = 'lime';
      this.debugCtx.lineWidth = 2;
      this.debugCtx.beginPath();
      this.debugCtx.arc(tipPosition.x, tipPosition.y, 10, 0, Math.PI * 2);
      this.debugCtx.stroke();

      this.debugCtx.fillStyle = 'lime';
      this.debugCtx.font = '14px monospace';
      this.debugCtx.fillText(`${target} (${(confidence * 100).toFixed(0)}%)`, tipPosition.x + 15, tipPosition.y);
    }

    return {
      target,
      confidence,
      tipPosition,
      boardPosition,
      detectionTimeMs,
    };
  }

  async detectWithBurst(video: HTMLVideoElement): Promise<DetectionResult | null> {
    if (!this.previousFrame) {
      this.setBaselineFrame(this.captureFrame(video));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const frames = await this.captureBurst(video);
    const results: DetectionResult[] = [];

    for (const frame of frames) {
      const result = this.detectDart(frame);
      if (result && result.confidence >= this.config.minConfidence) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      return null;
    }

    const targetCounts = new Map<DartTarget, DetectionResult[]>();
    for (const result of results) {
      const existing = targetCounts.get(result.target) || [];
      existing.push(result);
      targetCounts.set(result.target, existing);
    }

    let bestTarget: DartTarget | null = null;
    let bestCount = 0;
    let bestResults: DetectionResult[] = [];

    for (const [target, targetResults] of targetCounts) {
      if (targetResults.length > bestCount) {
        bestCount = targetResults.length;
        bestTarget = target;
        bestResults = targetResults;
      }
    }

    if (!bestTarget || bestResults.length === 0) {
      return null;
    }

    const avgConfidence = bestResults.reduce((sum, r) => sum + r.confidence, 0) / bestResults.length;
    const consistencyBonus = (bestCount / frames.length) * 0.2;

    const avgTipX = bestResults.reduce((sum, r) => sum + r.tipPosition.x, 0) / bestResults.length;
    const avgTipY = bestResults.reduce((sum, r) => sum + r.tipPosition.y, 0) / bestResults.length;
    const avgBoardX = bestResults.reduce((sum, r) => sum + r.boardPosition.x, 0) / bestResults.length;
    const avgBoardY = bestResults.reduce((sum, r) => sum + r.boardPosition.y, 0) / bestResults.length;
    const avgTime = bestResults.reduce((sum, r) => sum + r.detectionTimeMs, 0) / bestResults.length;

    return {
      target: bestTarget,
      confidence: Math.min(avgConfidence + consistencyBonus, 1.0),
      tipPosition: { x: avgTipX, y: avgTipY },
      boardPosition: { x: avgBoardX, y: avgBoardY },
      detectionTimeMs: avgTime,
    };
  }

  private computeFrameDiff(prev: ImageData, curr: ImageData): Uint8ClampedArray {
    const result = new Uint8ClampedArray(curr.data.length);
    const threshold = this.config.brightnessThreshold;
    const colorSens = this.config.colorSensitivity;

    for (let i = 0; i < curr.data.length; i += 4) {
      const dr = Math.abs(curr.data[i] - prev.data[i]);
      const dg = Math.abs(curr.data[i + 1] - prev.data[i + 1]);
      const db = Math.abs(curr.data[i + 2] - prev.data[i + 2]);

      const brightness = (dr + dg + db) / 3;
      const colorDiff = Math.max(dr, dg, db) - Math.min(dr, dg, db);

      if (brightness > threshold || colorDiff > colorSens) {
        result[i] = curr.data[i];
        result[i + 1] = curr.data[i + 1];
        result[i + 2] = curr.data[i + 2];
        result[i + 3] = 255;
      } else {
        result[i] = 0;
        result[i + 1] = 0;
        result[i + 2] = 0;
        result[i + 3] = 0;
      }
    }

    return result;
  }

  private findBlobs(pixels: Uint8ClampedArray, width: number, height: number): Blob[] {
    const visited = new Set<number>();
    const blobs: Blob[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (pixels[idx + 3] === 0 || visited.has(idx / 4)) continue;

        const blob = this.floodFill(pixels, width, height, x, y, visited);
        if (blob.pixels.length >= this.config.minBlobSize &&
            blob.pixels.length <= this.config.maxBlobSize) {
          blobs.push(blob);
        }
      }
    }

    return blobs;
  }

  private floodFill(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>
  ): Blob {
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const blobPixels: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let totalR = 0, totalG = 0, totalB = 0;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const pixelIdx = y * width + x;
      const idx = pixelIdx * 4;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(pixelIdx)) continue;
      if (pixels[idx + 3] === 0) continue;

      visited.add(pixelIdx);

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      blobPixels.push({ x, y, r, g, b });
      totalR += r;
      totalG += g;
      totalB += b;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    const count = blobPixels.length || 1;
    return {
      pixels: blobPixels,
      bounds: { minX, maxX, minY, maxY },
      centroid: {
        x: blobPixels.reduce((sum, p) => sum + p.x, 0) / count,
        y: blobPixels.reduce((sum, p) => sum + p.y, 0) / count,
      },
      avgColor: {
        r: totalR / count,
        g: totalG / count,
        b: totalB / count,
      },
      area: count,
    };
  }

  private selectBestBlob(blobs: Blob[]): Blob | null {
    if (blobs.length === 0) return null;

    const calibration = this.calibration;
    if (!calibration) return blobs[0];

    const boardCenter = calibration.boardCenter;

    let bestBlob: Blob | null = null;
    let bestScore = -Infinity;

    for (const blob of blobs) {
      const distToCenter = Math.sqrt(
        Math.pow(blob.centroid.x - boardCenter.x, 2) +
        Math.pow(blob.centroid.y - boardCenter.y, 2)
      );

      const maxDist = calibration.boardRadius * 1.2;
      if (distToCenter > maxDist) continue;

      const colorScore = this.calculateColorScore(blob.avgColor);
      const aspectRatio = (blob.bounds.maxX - blob.bounds.minX) /
                          Math.max(1, blob.bounds.maxY - blob.bounds.minY);
      const elongationScore = aspectRatio > 1.5 && aspectRatio < 8 ? 1 : 0.5;
      const sizeScore = Math.min(blob.area / 500, 1);
      const proximityScore = 1 - (distToCenter / maxDist);

      const totalScore = colorScore * 0.3 + elongationScore * 0.2 + sizeScore * 0.2 + proximityScore * 0.3;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestBlob = blob;
      }
    }

    return bestBlob;
  }

  private calculateColorScore(color: { r: number; g: number; b: number }): number {
    const saturation = (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / 255;
    const brightness = (color.r + color.g + color.b) / 3 / 255;

    if (saturation > 0.3) return 1.0;
    if (brightness > 0.7 || brightness < 0.3) return 0.7;
    return 0.5;
  }

  private estimateTipPosition(blob: Blob, frame: ImageData): { x: number; y: number } {
    if (!this.calibration) {
      return blob.centroid;
    }

    const boardCenter = this.calibration.boardCenter;

    const dx = blob.centroid.x - boardCenter.x;
    const dy = blob.centroid.y - boardCenter.y;
    const angle = Math.atan2(dy, dx);

    let nearestPoint = blob.centroid;
    let nearestDist = Infinity;

    for (const pixel of blob.pixels) {
      const dist = Math.sqrt(
        Math.pow(pixel.x - boardCenter.x, 2) +
        Math.pow(pixel.y - boardCenter.y, 2)
      );

      const pixelAngle = Math.atan2(pixel.y - boardCenter.y, pixel.x - boardCenter.x);
      const angleDiff = Math.abs(this.normalizeAngle(pixelAngle - angle));

      if (angleDiff < Math.PI / 4) {
        const adjustedDist = dist - (angleDiff / (Math.PI / 4)) * 50;
        if (adjustedDist < nearestDist) {
          nearestDist = adjustedDist;
          nearestPoint = { x: pixel.x, y: pixel.y };
        }
      }
    }

    return nearestPoint;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  private screenToBoard(screenPos: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.calibration) return null;

    const { boardCenter, boardRadius } = this.calibration;

    const relX = (screenPos.x - boardCenter.x) / boardRadius;
    const relY = (screenPos.y - boardCenter.y) / boardRadius;

    return { x: relX, y: relY };
  }

  private positionToTarget(boardPos: { x: number; y: number }): DartTarget {
    const { x, y } = boardPos;
    const distance = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);

    if (distance <= RING_RATIOS.doubleBull) {
      return 'BULL';
    }

    if (distance <= RING_RATIOS.singleBull) {
      return 'OB';
    }

    if (distance > RING_RATIOS.doubleOuter) {
      return 'MISS';
    }

    let sectorAngle = angle + Math.PI / 2;
    if (sectorAngle < 0) sectorAngle += 2 * Math.PI;

    const sectorWidth = (2 * Math.PI) / 20;
    const sectorIndex = Math.floor((sectorAngle + sectorWidth / 2) / sectorWidth) % 20;
    const sector = SECTOR_ORDER[sectorIndex];

    if (distance >= RING_RATIOS.doubleInner) {
      return `D${sector}` as DartTarget;
    }

    if (distance >= RING_RATIOS.tripleInner && distance <= RING_RATIOS.tripleOuter) {
      return `T${sector}` as DartTarget;
    }

    return `S${sector}` as DartTarget;
  }

  private calculateConfidence(blob: Blob, tipPosition: { x: number; y: number }): number {
    let confidence = 0.5;

    const sizeConfidence = Math.min(blob.area / 300, 1) * 0.2;
    confidence += sizeConfidence;

    const colorScore = this.calculateColorScore(blob.avgColor);
    confidence += colorScore * 0.2;

    if (this.calibration) {
      const { boardCenter, boardRadius } = this.calibration;
      const distToCenter = Math.sqrt(
        Math.pow(tipPosition.x - boardCenter.x, 2) +
        Math.pow(tipPosition.y - boardCenter.y, 2)
      );
      if (distToCenter <= boardRadius) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  private computeHomography(points: CalibrationPoint[]): number[][] | null {
    if (points.length < 4) return null;

    const center = this.calibration?.boardCenter;
    if (!center) return null;

    return [
      [1, 0, center.x],
      [0, 1, center.y],
      [0, 0, 1],
    ];
  }

  static computeCalibrationFromPoints(points: CalibrationPoint[]): Partial<CalibrationData> {
    if (points.length < 3) {
      return { points, boardCenter: { x: 0, y: 0 }, boardRadius: 0 };
    }

    const bullPoints = points.filter(p => p.target === 'BULL' || p.target === 'OB');
    const doublePoints = points.filter(p => p.target.startsWith('D'));

    let centerX: number, centerY: number;

    if (bullPoints.length > 0) {
      centerX = bullPoints.reduce((sum, p) => sum + p.screenX, 0) / bullPoints.length;
      centerY = bullPoints.reduce((sum, p) => sum + p.screenY, 0) / bullPoints.length;
    } else {
      centerX = points.reduce((sum, p) => sum + p.screenX, 0) / points.length;
      centerY = points.reduce((sum, p) => sum + p.screenY, 0) / points.length;
    }

    let radius = 200;
    if (doublePoints.length > 0) {
      const avgDoubleDist = doublePoints.reduce((sum, p) => {
        return sum + Math.sqrt(
          Math.pow(p.screenX - centerX, 2) +
          Math.pow(p.screenY - centerY, 2)
        );
      }, 0) / doublePoints.length;
      radius = avgDoubleDist;
    } else if (points.length >= 2) {
      const maxDist = points.reduce((max, p) => {
        const dist = Math.sqrt(
          Math.pow(p.screenX - centerX, 2) +
          Math.pow(p.screenY - centerY, 2)
        );
        return Math.max(max, dist);
      }, 0);
      radius = maxDist;
    }

    return {
      points,
      boardCenter: { x: centerX, y: centerY },
      boardRadius: radius,
      timestamp: Date.now(),
    };
  }
}

interface Blob {
  pixels: Array<{ x: number; y: number; r: number; g: number; b: number }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  centroid: { x: number; y: number };
  avgColor: { r: number; g: number; b: number };
  area: number;
}

export const CALIBRATION_TARGETS: Array<{ target: DartTarget; label: string; description: string }> = [
  { target: 'BULL', label: 'Bull (Kozep)', description: 'Kattints a tabla kozepere (Bull)' },
  { target: 'D20', label: 'Dupla 20', description: 'Kattints a dupla 20-ra (felso)' },
  { target: 'D6', label: 'Dupla 6', description: 'Kattints a dupla 6-ra (jobb)' },
  { target: 'D3', label: 'Dupla 3', description: 'Kattints a dupla 3-ra (also)' },
  { target: 'D11', label: 'Dupla 11', description: 'Kattints a dupla 11-re (bal)' },
];

export function formatTarget(target: DartTarget): string {
  if (target === 'BULL') return 'Bull (50)';
  if (target === 'OB') return 'Outer Bull (25)';
  if (target === 'MISS') return 'Miss';
  if (target.startsWith('D')) return `Double ${target.slice(1)}`;
  if (target.startsWith('T')) return `Triple ${target.slice(1)}`;
  return target.slice(1);
}
