import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { MessageSquare, Calendar, User, ImageOff, LayoutGrid, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Tilt } from "./Tilt";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'carousel';
  status: MaterialStatus;
  comments: number;
  thumbnail?: string;
  file_url?: string;
  project?: string;
  company?: string;
  client?: string;
  dueDate?: string;
  is_running?: boolean;
  is_briefing?: boolean; // Added for briefings
}

interface MaterialsMasonryProps {
  materials: Material[];
  className?: string;
}

const MaterialCard = ({ material, onClick }: { material: Material; onClick: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(null);

  console.log('MaterialCard data:', { id: material.id, name: material.name, type: material.type, thumbnail: material.thumbnail, file_url: material.file_url });

  // URL resolution logic - same as MaterialViewer
  useEffect(() => {
    if (material.file_url) {
      // Check if it's a JSON array (carousel)
      try {
        if (material.file_url.startsWith('[') && material.file_url.endsWith(']')) {
          const parsedFiles = JSON.parse(material.file_url);
          if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
            // Use first file URL for resolved URL
            setResolvedFileUrl(parsedFiles[0]?.url || material.file_url);
            return;
          }
        }
      } catch (e) {
        // Not JSON, continue
      }

      // If it's Google Cloud Storage URL, use directly
      if (material.file_url.includes('storage.googleapis.com')) {
        setResolvedFileUrl(material.file_url);
      } else if (material.file_url.includes('supabase.co/storage')) {
        // Generate signed URL for Supabase storage
        const generateSignedUrl = async () => {
          try {
            const urlParts = material.file_url!.split('/storage/v1/object/public/materials/');
            if (urlParts.length < 2) {
              console.error('Invalid file URL:', material.file_url);
              return;
            }
            const filePath = urlParts[1];
            const { data, error } = await supabase.storage
              .from('materials')
              .createSignedUrl(filePath, 3600);

            if (error) {
              console.error('Error generating signed URL:', error);
              return;
            }
            setResolvedFileUrl(data.signedUrl);
          } catch (error) {
            console.error('Error processing file URL:', error);
          }
        };
        generateSignedUrl();
      } else {
        // Use file_url directly if it doesn't match known patterns
        setResolvedFileUrl(material.file_url);
      }
    } else if (material.thumbnail) {
      // Fallback to thumbnail
      setResolvedFileUrl(material.thumbnail);
    }
  }, [material.file_url, material.thumbnail]);


  useEffect(() => {
    if (material.type === 'carousel' && material.file_url) {
      // Tentar parsear se for JSON, ou usar como array se possível, ou fallback para único
      try {
        // Se file_url for uma string JSON de array
        if (material.file_url.startsWith('[') && material.file_url.endsWith(']')) {
          const parsed = JSON.parse(material.file_url);
          if (Array.isArray(parsed)) {
            // Mapear para extrair apenas as URLs, lidando com objetos ou strings
            const images = parsed.map((item: any) => {
              if (typeof item === 'string') return item;
              return item.url || item; // Tenta pegar .url, senão usa o item (fallback)
            }).filter(Boolean);

            setCarouselImages(images);
            return;
          }
        }
      } catch (e) {
        // ignore error
      }
      // Fallback: se não for array, usa a própria url e thumbnail se diferente
      const images = [material.thumbnail, material.file_url].filter(Boolean) as string[];
      // Remove duplicates
      setCarouselImages([...new Set(images)]);
    }
  }, [material]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isHovered && material.type === 'carousel' && carouselImages.length > 1) {
      interval = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % carouselImages.length);
      }, 1500); // Change every 1.5 second for better viewing
    } else {
      setCarouselIndex(0);
    }
    return () => clearInterval(interval);
  }, [isHovered, material.type, carouselImages.length]);

  const renderPreview = () => {
    // Processing State for Briefings being generated by workflow
    if (material.status === 'processing' && material.is_briefing) {
      const formatLabel = material.type === 'video' ? 'vídeo' :
        material.type === 'carousel' ? 'carrossel' :
          'imagem estática';

      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
          <div className="flex flex-col items-center space-y-4 max-w-sm">
            <Loader2 className="h-16 w-16 animate-spin text-purple-600" />
            <h3 className="text-lg font-semibold text-center text-gray-900">
              Gerando {formatLabel} com IA Google Veo 3.1
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Seu briefing está sendo gerado pela IA. Isso pode levar alguns segundos.
            </p>
            <Progress value={33} className="w-full" />
          </div>
        </div>
      );
    }

    const urlToUse = resolvedFileUrl || material.thumbnail || material.file_url;

    // Video Hover
    if (material.type === 'video' && isHovered && urlToUse) {
      return (
        <div className="absolute inset-0 bg-black">
          <video
            src={urlToUse}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      );
    }

    // Carousel Hover
    if (material.type === 'carousel' && isHovered && carouselImages.length > 0) {
      return (
        <div className="absolute inset-0">
          <img
            src={carouselImages[carouselIndex]}
            alt={`${material.name} - ${carouselIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          <div className="absolute bottom-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            {carouselIndex + 1}/{carouselImages.length}
          </div>
        </div>
      );
    }

    // Default Thumbnail / Image
    if (urlToUse) {
      const isVideo = material.type === 'video' || (urlToUse && /\.(mp4|mov|webm|avi)/i.test(urlToUse));
      // If it's a video and we don't have a separate thumbnail (or thumbnail is the video url), 
      // render a video element to show the first frame
      if (isVideo && (!material.thumbnail || material.thumbnail === material.file_url)) {
        return (
          <div className="relative w-full h-full bg-black">
            <video
              src={urlToUse}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
            {!isHovered && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
                </div>
              </div>
            )}
          </div>
        );
      }

      // Handle Carousel Default View (show first image)
      let displayImage = urlToUse;
      if (material.type === 'carousel' && carouselImages.length > 0) {
        displayImage = carouselImages[0];
      }

      return (
        <div className="relative w-full h-full">
          <img
            src={displayImage}
            alt={material.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Error loading image:', displayImage);
              e.currentTarget.style.display = 'none';
            }}
          />
          {material.type === 'video' && !isHovered && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
              </div>
            </div>
          )}
          {material.type === 'carousel' && !isHovered && (
            <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-md">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-blue-50 flex items-center justify-center">
        <ImageOff className="h-12 w-12 text-primary/40" />
      </div>
    );
  };

  return (
    <div
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className="cursor-pointer hover:shadow-xl transition-all duration-300 group overflow-hidden h-full border-transparent hover:border-primary/20"
        onClick={onClick}
      >
        <CardContent className="p-0 flex flex-col h-full">
          {/* Thumbnail / Preview Area */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {renderPreview()}
          </div>

          {/* Content */}
          <div className="p-4 space-y-2 flex-1 flex flex-col">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {material.name}
              </h4>
            </div>

            <div className="mt-auto space-y-2">
              {material.project && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {material.project}
                </p>
              )}

              {material.company && (
                <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
                  {material.company} • {new Date().getFullYear()}
                </p>
              )}

              <div className="pt-2 flex items-center justify-between">
                <StatusBadge status={material.status} isRunning={material.is_running} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const MaterialsMasonry = ({ materials, className }: MaterialsMasonryProps) => {
  const navigate = useNavigate();

  const handleMaterialClick = (materialId: string) => {
    navigate(`/material/${materialId}`);
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          onClick={() => handleMaterialClick(material.id)}
        />
      ))}
    </div>
  );
};