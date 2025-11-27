import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImageFile: File) => void;
  aspectRatio?: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 1, // Square by default for avatars
}) => {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Calculate initial crop to be centered and maintain aspect ratio
    const cropSize = Math.min(width, height) * 0.8;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;
    
    setCrop({
      unit: 'px',
      width: cropSize,
      height: cropSize,
      x,
      y,
    });
  }, []);

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, crop: PixelCrop): Promise<File> => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      canvas.width = crop.width;
      canvas.height = crop.height;

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            throw new Error('Canvas is empty');
          }
          const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          resolve(file);
        }, 'image/jpeg', 1);
      });
    },
    []
  );

  const handleCropComplete = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    try {
      const croppedImageFile = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(croppedImageFile);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  }, [completedCrop, getCroppedImg, onCropComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recortar Imagem</DialogTitle>
        </DialogHeader>
        
        <div className="flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspectRatio}
            className="max-h-96"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageSrc}
              onLoad={onImageLoad}
              className="max-h-96 object-contain"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCropComplete}>
            Recortar e Usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};