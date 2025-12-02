import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BriefingCanvasEditor } from './BriefingCanvasEditor';
import { CarouselGallery } from '@/components/CarouselGallery';
import { Pencil } from 'lucide-react';
import DOMPurify from 'dompurify';

import { VideoPlayerWithCaption } from '@/components/VideoPlayerWithCaption';

interface BriefingEditorLayoutProps {
  briefingId: string;
  projectId: string;
  visualizationContent: string;
  onVisualizationChange: (content: string) => void;
  onEditLayout?: () => void;
  showComments?: boolean;
  useCanvas?: boolean;
  wireframeData?: any;
  materialType?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
}

import { supabase } from "@/integrations/supabase/client";

// ...

export const BriefingEditorLayout = ({
  briefingId,
  projectId,
  visualizationContent,
  onVisualizationChange,
  onEditLayout,
  showComments = false,
  useCanvas = true,
  wireframeData,
  materialType,
  fileUrl,
  thumbnailUrl,
  caption
}: BriefingEditorLayoutProps) => {
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(null);
  const isVideoUrl = (url?: string | null) => !!url && url.match(/\.(mp4|mov|avi|webm)(\?.*)?$/i);

  // URL resolution logic
  useEffect(() => {
    const urlToResolve = fileUrl || thumbnailUrl;
    if (urlToResolve) {
      // If it's Google Cloud Storage URL, use directly
      if (urlToResolve.includes('storage.googleapis.com')) {
        setResolvedFileUrl(urlToResolve);
      } else if (urlToResolve.includes('supabase.co/storage')) {
        // Generate signed URL for Supabase storage
        const generateSignedUrl = async () => {
          try {
            const urlParts = urlToResolve.split('/storage/v1/object/public/materials/');
            if (urlParts.length < 2) {
              // Try another pattern or just use as is if it's already a public URL
              setResolvedFileUrl(urlToResolve);
              return;
            }
            const filePath = urlParts[1];
            const { data, error } = await supabase.storage
              .from('materials')
              .createSignedUrl(filePath, 3600);

            if (error) {
              console.error('Error generating signed URL:', error);
              setResolvedFileUrl(urlToResolve); // Fallback
              return;
            }
            setResolvedFileUrl(data.signedUrl);
          } catch (error) {
            console.error('Error processing file URL:', error);
            setResolvedFileUrl(urlToResolve);
          }
        };
        generateSignedUrl();
      } else {
        // Use file_url directly if it doesn't match known patterns
        setResolvedFileUrl(urlToResolve);
      }
    }
  }, [fileUrl, thumbnailUrl]);

  // Parse carousel images from file_url if it's a JSON array or a single image
  let parsedSlides = wireframeData?.slides || [];

  if ((!parsedSlides || parsedSlides.length === 0) && fileUrl) {
    try {
      const maybeArray = JSON.parse(fileUrl);
      if (Array.isArray(maybeArray)) {
        parsedSlides = maybeArray.map((url: string, index: number) => ({
          imageUrl: url,
          index
        }));
      }
    } catch {
      // not JSON, continue
    }

    if ((!parsedSlides || parsedSlides.length === 0) && !isVideoUrl(fileUrl)) {
      parsedSlides = [{ imageUrl: fileUrl, index: 0 }];
    }
  }

  const normalizedWireframeData = parsedSlides?.length
    ? { ...(wireframeData || {}), slides: parsedSlides, isCarousel: parsedSlides.length > 1 }
    : wireframeData;

  // Use resolvedFileUrl for rendering
  const urlToUse = resolvedFileUrl || fileUrl || thumbnailUrl;

  // Se é um carrossel com slides, renderizar a galeria de imagens
  if (materialType === 'carousel' && parsedSlides.length > 0) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background p-8 overflow-auto">
        <div className="max-w-4xl w-full">
          <CarouselGallery slides={parsedSlides} />
        </div>
      </div>
    );
  }

  // Se é um vídeo ou reels e tem URL, renderizar o player de vídeo
  if ((materialType === 'video' || materialType === 'reels' || isVideoUrl(urlToUse)) && urlToUse) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background p-8 overflow-auto">
        <div className="max-w-4xl w-full">
          <VideoPlayerWithCaption
            videoUrl={urlToUse}
            caption={caption || wireframeData?.legenda_section?.legenda_principal || wireframeData?.caption}
          />
        </div>
      </div>
    );
  }

  const singleSlide = normalizedWireframeData?.slides?.length === 1 && !normalizedWireframeData?.isCarousel;
  const singleImageUrl = normalizedWireframeData?.slides?.[0]?.imageUrl || urlToUse;

  // Fallback para canvas editor (materiais criados manualmente ou imagens únicas)
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {useCanvas ? (
        <BriefingCanvasEditor
          content={visualizationContent}
          onChange={onVisualizationChange}
          wireframeData={normalizedWireframeData}
          fileUrl={singleSlide ? singleImageUrl : undefined}
        />
      ) : (
        <div
          className="p-8 bg-white h-full overflow-auto"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(visualizationContent) }}
        />
      )}
    </div>
  );
};
