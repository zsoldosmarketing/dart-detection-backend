import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, FlipHorizontal, Crop, X, Check } from 'lucide-react';
import { Button } from './Button';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 400;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.scale(zoom, zoom);

    const aspectRatio = image.width / image.height;
    let drawWidth = size;
    let drawHeight = size;

    if (aspectRatio > 1) {
      drawHeight = size / aspectRatio;
    } else {
      drawWidth = size * aspectRatio;
    }

    ctx.drawImage(
      image,
      -drawWidth / 2 + position.x,
      -drawHeight / 2 + position.y,
      drawWidth,
      drawHeight
    );

    ctx.restore();

    if (cropMode) {
      const cropSize = 300;
      const cropX = (size - cropSize) / 2;
      const cropY = (size - cropSize) / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropX, cropY, cropSize, cropSize);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, size, cropY);
      ctx.fillRect(0, cropY, cropX, cropSize);
      ctx.fillRect(cropX + cropSize, cropY, size - cropX - cropSize, cropSize);
      ctx.fillRect(0, cropY + cropSize, size, size - cropY - cropSize);
    }
  }, [image, zoom, rotation, flipH, position, cropMode]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const size = cropMode ? 300 : 400;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = size;
    outputCanvas.height = size;

    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    if (cropMode) {
      const cropX = (canvas.width - 300) / 2;
      const cropY = (canvas.height - 300) / 2;
      ctx.drawImage(canvas, cropX, cropY, 300, 300, 0, 0, size, size);
    } else {
      ctx.drawImage(canvas, 0, 0);
    }

    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          onSave(blob);
        }
      },
      'image/webp',
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-dark-900 dark:text-white">Profilkep szerkesztese</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            className="border-2 border-dark-300 dark:border-dark-600 rounded-lg cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotation((rotation + 90) % 360)}
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlipH(!flipH)}
            >
              <FlipHorizontal className="w-4 h-4" />
            </Button>
            <Button
              variant={cropMode ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setCropMode(!cropMode)}
            >
              <Crop className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Megse
            </Button>
            <Button onClick={handleSave}>
              <Check className="w-4 h-4 mr-2" />
              Mentes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
