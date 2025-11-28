import { FileText, Image, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ThumbnailProps {
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
  thumbnail?: string;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Thumbnail = ({
  type,
  thumbnail,
  name,
  className,
  size = 'md'
}: ThumbnailProps) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-full h-full'
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-xl'
  };

  const getIcon = () => {
    switch (type) {
      case 'video':
        return <Video className={iconSizes[size]} />;
      case 'pdf':
        return <FileText className={iconSizes[size]} />;
      case 'wireframe':
      case 'carousel':
        return <Image className={iconSizes[size]} />;
      default:
        return <Image className={iconSizes[size]} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'video':
        return 'bg-purple-50 border-purple-200';
      case 'pdf':
        return 'bg-red-50 border-red-200';
      case 'wireframe':
      case 'carousel':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'video':
        return 'text-purple-600';
      case 'pdf':
        return 'text-red-600';
      case 'wireframe':
      case 'carousel':
        return 'text-blue-600';
      default:
        return 'text-blue-600';
    }
  };

  // Para carrossel, extrair a primeira imagem do JSON
  let displayThumbnail = thumbnail;
  if (thumbnail) {
    try {
      const parsedThumbnail = JSON.parse(thumbnail);
      if (Array.isArray(parsedThumbnail) && parsedThumbnail.length > 0) {
        displayThumbnail = parsedThumbnail[0].url || parsedThumbnail[0];
      }
    } catch {
      // Se não for JSON válido, usar a thumbnail original
    }
  }

  // Para wireframe sem thumbnail, sempre mostrar ícone
  // Para carousel, mostrar imagem se tiver thumbnail, senão ícone
  // Para PDF, sempre mostrar ícone
  if (type === 'pdf' || (type === 'wireframe' && !displayThumbnail) || (!displayThumbnail || imageError)) {
    return (
      <div className={cn(
        "rounded-lg border-2 flex items-center justify-center",
        sizeClasses[size],
        getBgColor(),
        getIconColor(),
        className
      )}>
        {getIcon()}
      </div>
    );
  }

  // Para imagens e vídeos com thumbnail
  if (type === 'image') {
    return (
      <div className={cn(
        "rounded-lg overflow-hidden bg-muted border-2 border-muted",
        sizeClasses[size],
        className
      )}>
        <img
          src={displayThumbnail}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className={cn(
        "rounded-lg overflow-hidden bg-muted border-2 border-muted relative",
        sizeClasses[size],
        className
      )}>
        <img
          src={displayThumbnail}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-3 h-3 border-l-4 border-white border-l-solid border-y-2 border-y-transparent ml-0.5"></div>
        </div>
      </div>
    );
  }

  // Carousel with image
  if (type === 'carousel' && displayThumbnail) {
    return (
      <div className={cn(
        "rounded-lg overflow-hidden bg-muted border-2 border-muted relative",
        sizeClasses[size],
        className
      )}>
        <img
          src={displayThumbnail}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
        <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
          Carrossel
        </div>
      </div>
    );
  }

  // Wireframe with image
  if (type === 'wireframe' && displayThumbnail) {
    return (
      <div className={cn(
        "rounded-lg overflow-hidden bg-muted border-2 border-muted",
        sizeClasses[size],
        className
      )}>
        <img
          src={displayThumbnail}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
      </div>
    );
  }

  // Fallback se nada mais funcionou
  return (
    <div className={cn(
      "rounded-lg border-2 flex items-center justify-center",
      sizeClasses[size],
      getBgColor(),
      getIconColor(),
      className
    )}>
      {getIcon()}
    </div>
  );
};