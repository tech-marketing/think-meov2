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
  caption?: string;
}

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
  caption
}: BriefingEditorLayoutProps) => {
  // Parse carousel images from file_url if it's a JSON array
  let carouselSlides = wireframeData?.slides || [];
  if (materialType === 'carousel' && fileUrl && !carouselSlides.length) {
    try {
      if (fileUrl.startsWith('[') && fileUrl.endsWith(']')) {
        const parsedUrls = JSON.parse(fileUrl);
        if (Array.isArray(parsedUrls)) {
          carouselSlides = parsedUrls.map((item: any, index: number) => ({
            imageUrl: typeof item === 'string' ? item : item.url,
            index: index
          }));
        }
      }
    } catch (e) {
      console.error('Error parsing carousel file_url:', e);
    }
  }

  // Se é um carrossel com slides, renderizar a galeria de imagens
  if (materialType === 'carousel' && carouselSlides.length > 0) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background">
        <CarouselGallery
          slides={carouselSlides}
          className="max-w-4xl w-full"
        />
      </div>
    );
  }

  // Se é um vídeo ou reels e tem URL, renderizar o player de vídeo
  if ((materialType === 'video' || materialType === 'reels' || fileUrl?.endsWith('.mp4')) && fileUrl) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background p-8 overflow-auto">
        <div className="max-w-4xl w-full">
          <VideoPlayerWithCaption
            videoUrl={fileUrl}
            caption={caption || wireframeData?.legenda_section?.legenda_principal || wireframeData?.caption}
          />
        </div>
      </div>
    );
  }

  // Se é uma imagem estática e tem URL, renderizar a imagem
  if ((materialType === 'image' || fileUrl?.match(/\.(jpeg|jpg|gif|png)$/i)) && fileUrl) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background p-8 overflow-auto">
        <div className="max-w-4xl w-full flex flex-col gap-4">
          <img
            src={fileUrl}
            alt="Briefing gerado"
            className="w-full h-auto rounded-lg shadow-lg object-contain max-h-[calc(100vh-300px)]"
          />
          {(caption || wireframeData?.legenda_section?.legenda_principal || wireframeData?.caption) && (
            <div className="p-6 bg-card rounded-lg border shadow-sm">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                Legenda
              </h4>
              <p className="text-sm whitespace-pre-wrap">
                {caption || wireframeData?.legenda_section?.legenda_principal || wireframeData?.caption}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)]">
      {useCanvas ? (
        <BriefingCanvasEditor
          content={visualizationContent}
          onChange={onVisualizationChange}
          wireframeData={wireframeData}
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
