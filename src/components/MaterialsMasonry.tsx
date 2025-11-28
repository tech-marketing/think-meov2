import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { MessageSquare, Calendar, User, ImageOff, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Tilt } from "./Tilt";

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
}

interface MaterialsMasonryProps {
  materials: Material[];
  className?: string;
}

const MaterialCard = ({ material, onClick }: { material: Material; onClick: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);

  console.log('MaterialCard data:', { id: material.id, name: material.name, type: material.type, thumbnail: material.thumbnail, file_url: material.file_url });

  useEffect(() => {
    if (material.type === 'carousel' && material.file_url) {
      // Tentar parsear se for JSON, ou usar como array se possível, ou fallback para único
      try {
        // Se file_url for uma string JSON de array
        if (material.file_url.startsWith('[') && material.file_url.endsWith(']')) {
          const parsed = JSON.parse(material.file_url);
          if (Array.isArray(parsed)) {
            setCarouselImages(parsed);
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
      }, 1000); // Change every 1 second
    } else {
      setCarouselIndex(0);
    }
    return () => clearInterval(interval);
  }, [isHovered, material.type, carouselImages.length]);

  const renderPreview = () => {
    // Video Hover
    if (material.type === 'video' && isHovered && material.file_url) {
      return (
        <div className="absolute inset-0 bg-black">
          <video
            src={material.file_url}
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
    if (material.thumbnail || material.file_url) {
      const isVideo = material.type === 'video' || (material.file_url && /\.(mp4|mov|webm|avi)/i.test(material.file_url));

      // Check if file_url is a JSON array (carousel) and we need to extract the first image
      let displayUrl = material.thumbnail || material.file_url;
      if (!material.thumbnail && material.file_url && material.file_url.trim().startsWith('[') && material.file_url.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(material.file_url);
          if (Array.isArray(parsed) && parsed.length > 0) {
            displayUrl = parsed[0];
          }
        } catch (e) {
          // ignore
        }
      }

      // If it's a video and we don't have a separate thumbnail (or thumbnail is the video url), 
      // render a video element to show the first frame
      if (isVideo && (!material.thumbnail || material.thumbnail === material.file_url)) {
        return (
          <div className="relative w-full h-full bg-black">
            <video
              src={material.file_url}
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

      return (
        <div className="relative w-full h-full">
          <img
            src={displayUrl}
            alt={material.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('bg-blue-50', 'flex', 'items-center', 'justify-center');
              const icon = document.createElement('div');
              icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off h-12 w-12 text-primary/40"><path d="m2 2 20 20"/><path d="M8.33 4h7.34a2 2 0 0 1 2 2v6.67"/><path d="M15.66 15.66 13.46 13.46a2 2 0 0 0-2.7 0L6 18.22"/><path d="M22 22 2 2"/><path d="M4 8.33V18a2 2 0 0 0 2 2h9.67"/></svg>';
              e.currentTarget.parentElement?.appendChild(icon);
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
    <Tilt
      className="h-full"
      rotationFactor={10}
      springOptions={{ stiffness: 200, damping: 20 }}
    >
      <Card
        className="cursor-pointer hover:shadow-xl transition-all duration-300 group overflow-hidden h-full border-transparent hover:border-primary/20"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
    </Tilt>
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