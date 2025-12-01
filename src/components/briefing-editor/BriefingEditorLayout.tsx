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
  caption
}: BriefingEditorLayoutProps) => {
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(null);

  // URL resolution logic
  useEffect(() => {
    if (fileUrl) {
      // If it's Google Cloud Storage URL, use directly
      if (fileUrl.includes('storage.googleapis.com')) {
        setResolvedFileUrl(fileUrl);
      } else if (fileUrl.includes('supabase.co/storage')) {
        // Generate signed URL for Supabase storage
        const generateSignedUrl = async () => {
          try {
            const urlParts = fileUrl.split('/storage/v1/object/public/materials/');
            if (urlParts.length < 2) {
              // Try another pattern or just use as is if it's already a public URL
              setResolvedFileUrl(fileUrl);
              return;
            }
            const filePath = urlParts[1];
            const { data, error } = await supabase.storage
              .from('materials')
              .createSignedUrl(filePath, 3600);

            if (error) {
              console.error('Error generating signed URL:', error);
              setResolvedFileUrl(fileUrl); // Fallback
              return;
            }
            setResolvedFileUrl(data.signedUrl);
          } catch (error) {
            console.error('Error processing file URL:', error);
            setResolvedFileUrl(fileUrl);
          }
        };
        generateSignedUrl();
      } else {
        // Use file_url directly if it doesn't match known patterns
        setResolvedFileUrl(fileUrl);
      }
    }
  }, [fileUrl]);

  // Parse carousel images from file_url if it's a JSON array
  let carouselSlides = wireframeData?.slides || [];
  // ... (carousel parsing logic)

  // Use resolvedFileUrl for rendering
  const urlToUse = resolvedFileUrl || fileUrl;

  // Se é um carrossel com slides, renderizar a galeria de imagens
  if (materialType === 'carousel' && carouselSlides.length > 0) {
    // ...
  }

  // Se é um vídeo ou reels e tem URL, renderizar o player de vídeo
  if ((materialType === 'video' || materialType === 'reels' || urlToUse?.match(/\.(mp4|mov|avi|webm)(\?.*)?$/i)) && urlToUse) {
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

  // Se tem file_url e é uma imagem (ou tipo wireframe/static/image), renderizar a imagem
  // Isso cobre materiais gerados por workflow que podem ter type='wireframe' mas file_url com imagem
  if (urlToUse && (materialType === 'image' || materialType === 'wireframe' || materialType === 'static' || urlToUse?.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i))) {
    return (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-background p-8 overflow-auto">
        <div className="max-w-4xl w-full flex flex-col gap-4">
          <img
            src={urlToUse}
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

  // Fallback para canvas editor (materiais criados manualmente)
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
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

      {/* Debug Info - Temporary */}
      <div className="p-4 bg-gray-100 border-t text-xs font-mono overflow-auto max-h-40">
        <p className="font-bold">Debug Info:</p>
        <p>Material Type: {materialType}</p>
        <p>File URL: {fileUrl || 'None'}</p>
        <p>Resolved URL: {resolvedFileUrl || 'None'}</p>
        <p>Has Wireframe Data: {wireframeData ? 'Yes' : 'No'}</p>
        <p>Carousel Slides: {carouselSlides.length}</p>
        <p>Regex Match: {urlToUse?.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
};
