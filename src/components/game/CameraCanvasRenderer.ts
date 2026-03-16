import type { BoardDetectResult } from '../../lib/dartDetectionApi';

interface ZoomRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DartHit {
  x: number;
  y: number;
}

interface DrawFrameParams {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  boardResult: BoardDetectResult | null;
  autoZoomEnabled: boolean;
  showSectorOverlay: boolean;
  isDetecting: boolean;
  lastDartHit: DartHit | null;
}

export function computeZoomRegion(
  vw: number,
  vh: number,
  boardResult: BoardDetectResult,
  autoZoomEnabled: boolean
): { srcX: number; srcY: number; srcW: number; srcH: number; zoomScale: number; zoomRegion: ZoomRegion | null } {
  let srcX = 0, srcY = 0, srcW = vw, srcH = vh;
  let zoomScale = 1;
  let zoomRegion: ZoomRegion | null = null;

  if (autoZoomEnabled && boardResult && boardResult.board_found && boardResult.ellipse) {
    const { cx, cy, a, b } = boardResult.ellipse;
    const maxRadius = Math.max(a, b);
    const padding = 1.05;
    const boardSize = maxRadius * 2 * padding;

    srcX = Math.max(0, cx - boardSize / 2);
    srcY = Math.max(0, cy - boardSize / 2);
    srcW = Math.min(boardSize, vw - srcX);
    srcH = Math.min(boardSize, vh - srcY);

    if (srcX + srcW > vw) srcW = vw - srcX;
    if (srcY + srcH > vh) srcH = vh - srcY;

    const aspect = vw / vh;
    if (srcW / srcH > aspect) {
      const newH = srcW / aspect;
      const diffH = newH - srcH;
      srcY = Math.max(0, srcY - diffH / 2);
      srcH = Math.min(newH, vh - srcY);
    } else {
      const newW = srcH * aspect;
      const diffW = newW - srcW;
      srcX = Math.max(0, srcX - diffW / 2);
      srcW = Math.min(newW, vw - srcX);
    }

    zoomScale = vw / srcW;
    zoomRegion = { x: srcX, y: srcY, w: srcW, h: srcH };
  }

  return { srcX, srcY, srcW, srcH, zoomScale, zoomRegion };
}

export function drawBoardEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angle: number,
  zoomScale: number
) {
  const pulsePhase = (Date.now() % 2000) / 2000;
  const pulseAlpha = 0.4 + Math.sin(pulsePhase * Math.PI * 2) * 0.3;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);

  ctx.shadowColor = 'rgba(0, 255, 255, 0.9)';
  ctx.shadowBlur = 30 / zoomScale;
  ctx.strokeStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
  ctx.lineWidth = 6 / zoomScale;
  ctx.beginPath();
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 20 / zoomScale;
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.8)';
  ctx.lineWidth = 3 / zoomScale;
  ctx.beginPath();
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 10 / zoomScale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5 / zoomScale;
  ctx.beginPath();
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const scanAngle = (Date.now() % 3000) / 3000 * Math.PI * 2;
  const scanX = Math.cos(scanAngle) * a;
  const scanY = Math.sin(scanAngle) * b;
  ctx.fillStyle = 'rgba(0, 255, 255, 1)';
  ctx.shadowColor = 'rgba(0, 255, 255, 1)';
  ctx.shadowBlur = 20 / zoomScale;
  ctx.beginPath();
  ctx.arc(scanX, scanY, 8 / zoomScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
  ctx.lineWidth = 1 / zoomScale;
  ctx.setLineDash([5 / zoomScale, 10 / zoomScale]);
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.63, b * 0.63, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.37, b * 0.37, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.08, b * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

export function drawBullCenter(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  zoomScale: number
) {
  ctx.fillStyle = 'rgba(0, 255, 255, 1)';
  ctx.shadowColor = 'rgba(0, 255, 255, 1)';
  ctx.shadowBlur = 15 / zoomScale;
  ctx.beginPath();
  ctx.arc(bx, by, 6 / zoomScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bx, by, 2 / zoomScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
  ctx.lineWidth = 1 / zoomScale;
  ctx.beginPath();
  ctx.moveTo(bx - 25 / zoomScale, by);
  ctx.lineTo(bx + 25 / zoomScale, by);
  ctx.moveTo(bx, by - 25 / zoomScale);
  ctx.lineTo(bx, by + 25 / zoomScale);
  ctx.stroke();
}

export function drawDartMarker(
  ctx: CanvasRenderingContext2D,
  dartHit: DartHit,
  zoomScale: number
) {
  ctx.fillStyle = 'rgba(255, 50, 50, 1)';
  ctx.shadowColor = 'rgba(255, 50, 50, 1)';
  ctx.shadowBlur = 20 / zoomScale;
  ctx.beginPath();
  ctx.arc(dartHit.x, dartHit.y, 10 / zoomScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2 / zoomScale;
  ctx.beginPath();
  ctx.arc(dartHit.x, dartHit.y, 10 / zoomScale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(dartHit.x, dartHit.y, 3 / zoomScale, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSectorLabels(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angle: number,
  zoomScale: number
) {
  const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const rotationOffset = -9;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);

  for (let i = 0; i < 20; i++) {
    const startAngle = ((i * 18 - 9 + rotationOffset) * Math.PI) / 180;
    const midAngle = ((i * 18 + rotationOffset) * Math.PI) / 180;

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 1 / zoomScale;
    ctx.beginPath();
    ctx.moveTo(a * 0.08 * Math.sin(startAngle), -b * 0.08 * Math.cos(startAngle));
    ctx.lineTo(a * Math.sin(startAngle), -b * Math.cos(startAngle));
    ctx.stroke();

    const labelDist = 0.85;
    const labelX = a * labelDist * Math.sin(midAngle);
    const labelY = -b * labelDist * Math.cos(midAngle);

    ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
    ctx.font = `bold ${14 / zoomScale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
    ctx.shadowBlur = 6 / zoomScale;
    ctx.fillText(String(SEGMENTS[i]), labelX, labelY);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
  ctx.lineWidth = 2 / zoomScale;
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.58, b * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.63, b * 0.63, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 0, a * 0.95, b * 0.95, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number
) {
  const cornerSize = 40;
  const cornerThickness = 3;
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
  ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = cornerThickness;

  ctx.beginPath();
  ctx.moveTo(10, 10 + cornerSize);
  ctx.lineTo(10, 10);
  ctx.lineTo(10 + cornerSize, 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(vw - 10 - cornerSize, 10);
  ctx.lineTo(vw - 10, 10);
  ctx.lineTo(vw - 10, 10 + cornerSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(vw - 10, vh - 10 - cornerSize);
  ctx.lineTo(vw - 10, vh - 10);
  ctx.lineTo(vw - 10 - cornerSize, vh - 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10 + cornerSize, vh - 10);
  ctx.lineTo(10, vh - 10);
  ctx.lineTo(10, vh - 10 - cornerSize);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

export function drawScanningAnimation(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  const scanY = (Date.now() % 2000) / 2000 * canvasHeight;
  const scanGradient = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
  scanGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
  scanGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
  scanGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = scanGradient;
  ctx.fillRect(0, scanY - 30, canvasWidth, 60);
}

export function drawFrame(params: DrawFrameParams): ZoomRegion | null {
  const { ctx, canvas, video, boardResult, autoZoomEnabled, showSectorOverlay, isDetecting, lastDartHit } = params;

  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = canvas.width;
  const ch = canvas.height;

  if (cw === 0 || ch === 0) return null;

  const { srcX, srcY, srcW, srcH, zoomScale, zoomRegion } = computeZoomRegion(
    vw, vh, boardResult!, autoZoomEnabled
  );

  ctx.clearRect(0, 0, cw, ch);

  const videoAspect = srcW / srcH;
  const canvasAspect = cw / ch;
  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (videoAspect > canvasAspect) {
    drawW = cw;
    drawH = cw / videoAspect;
    drawX = 0;
    drawY = (ch - drawH) / 2;
  } else {
    drawH = ch;
    drawW = ch * videoAspect;
    drawX = (cw - drawW) / 2;
    drawY = 0;
  }

  ctx.drawImage(video, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);

  const scaleToCanvas = drawW / srcW;

  if (boardResult && boardResult.board_found && boardResult.ellipse) {
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(scaleToCanvas, scaleToCanvas);
    ctx.translate(-srcX, -srcY);

    const { cx, cy, a, b, angle } = boardResult.ellipse;
    const effectiveZoom = zoomScale;

    drawBoardEllipse(ctx, cx, cy, a, b, angle, effectiveZoom);

    if (boardResult.bull_center) {
      const [bx, by] = boardResult.bull_center;
      drawBullCenter(ctx, bx, by, effectiveZoom);
    }

    if (lastDartHit) {
      drawDartMarker(ctx, lastDartHit, effectiveZoom);
    }

    if (showSectorOverlay) {
      drawSectorLabels(ctx, cx, cy, a, b, angle, effectiveZoom);
    }

    ctx.restore();

    drawCornerBrackets(ctx, cw, ch);
  }

  if (isDetecting) {
    drawScanningAnimation(ctx, cw, ch);
  }

  return zoomRegion;
}
