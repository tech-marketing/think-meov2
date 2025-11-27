import React, { useEffect, useState } from 'react';
import { Play, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MaterialCarousel } from "./MaterialCarousel";

interface CreativeDisplayProps {
  imageUrl?: string;
  videoUrl?: string;
  creativeId?: string;
  adName: string;
  className?: string;
  showControls?: boolean;
  localMaterialId?: string | null;
}

export const CreativeDisplay: React.FC<CreativeDisplayProps> = ({
  imageUrl,
  videoUrl,
  creativeId,
  adName,
  className = "",
  showControls = false,
  localMaterialId
}) => {
  const [matchedMaterial, setMatchedMaterial] = useState<any>(null);

  useEffect(() => {
    if (localMaterialId) {
      // Material already linked via taxonomy, fetch it directly
      const fetchLinkedMaterial = async () => {
        try {
          const { data: material, error } = await supabase
            .from('materials')
            .select('*')
            .eq('id', localMaterialId)
            .single();

          if (!error && material) {
            setMatchedMaterial(material);
            console.log('Material correspondente encontrado via taxonomia:', material.name, 'para anúncio:', adName);
          } else {
            console.log('Material não encontrado pelo ID:', localMaterialId);
          }
        } catch (error) {
          console.error('Error fetching linked material:', error);
        }
      };
      
      fetchLinkedMaterial();
    } else {
      // Try to find a matching material by name/taxonomy when not linked yet
      const tryFindByName = async () => {
        try {
          const normalizedAdName = adName.toLowerCase().trim();
          const cleanAdName = normalizedAdName
            .replace(/\s*—\s*cópia.*$/i, '')
            .replace(/\s*-\s*copy.*$/i, '')
            .replace(/[|—-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          let { data: materials, error } = await supabase
            .from('materials')
            .select('*')
            .ilike('name', `%${cleanAdName}%`)
            .limit(1);

          if ((!materials || materials.length === 0)) {
            ({ data: materials, error } = await supabase
              .from('materials')
              .select('*')
              .ilike('name', `%${normalizedAdName}%`)
              .limit(1));
          }

          if (materials && materials.length > 0) {
            setMatchedMaterial(materials[0]);
            console.log('Material encontrado por nome/taxonomia:', materials[0].name, 'para anúncio:', adName);
          } else {
            console.log('Nenhum material encontrado por nome/taxonomia para:', adName);
          }
        } catch (err) {
          console.error('Erro buscando material por nome/taxonomia:', err);
        }
      };
      tryFindByName();
    }
  }, [adName, localMaterialId]);

  // Helpers to normalize and detect media types
  const parseUrl = (val?: string | null) => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const item = parsed[0];
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'url' in item) return item.url as string;
      }
      if (parsed && typeof parsed === 'object' && 'url' in parsed) return parsed.url as string;
    } catch {
      // Not JSON, return original
    }
    return val;
  };

  // Helper to parse all files from JSON (for carousel support)
  const parseAllFiles = (val?: string | null) => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 1) {
        return parsed.map((item, index) => {
          let url = '';
          let name = '';
          
          if (typeof item === 'string') {
            url = item;
            name = `Item ${index + 1}`;
          } else if (item && typeof item === 'object' && 'url' in item) {
            url = item.url as string;
            name = item.name || `Item ${index + 1}`;
          }
          
          // Determine type based on URL
          let type: 'image' | 'video' | 'pdf' | 'wireframe' = 'image';
          if (isVideoUrl(url)) type = 'video';
          else if (url.includes('.pdf')) type = 'pdf';
          else if (url.includes('wireframe')) type = 'wireframe';
          
          return {
            id: `file-${index}`,
            url,
            name,
            type
          };
        });
      }
    } catch {
      // Not JSON, return null
    }
    return null;
  };

  const isVideoUrl = (url?: string | null) => !!url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
  const isImageUrl = (url?: string | null) => !!url && /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);
  
  // Helper to ensure URL is absolute
  const makeAbsoluteUrl = (url?: string | null) => {
    if (!url) return null;
    // If it's already absolute or a data URL, return as is
    if (/^https?:|^data:|^blob:/i.test(url)) return url;
    // If it's a relative Supabase storage path, make it absolute
    if (url.startsWith('/storage/') || url.startsWith('storage/')) {
      const supabaseUrl = 'https://oprscgxsfldzydbrbioz.supabase.co';
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      return `${supabaseUrl}${cleanPath}`;
    }
    return url;
  };

  const isValidUrl = (url?: string | null) => {
    if (!url || typeof url !== 'string' || /undefined|null|^\[|^\{/.test(url)) return false;
    const absoluteUrl = makeAbsoluteUrl(url);
    return !!absoluteUrl && /^https?:|^data:|^blob:/i.test(absoluteUrl);
  };

  // Check if material has multiple files (carousel)
  const materialFiles = parseAllFiles(matchedMaterial?.file_url);
  
  // If we have multiple files and showControls is true (details view), render carousel
  // Otherwise, just show the first file for preview
  if (materialFiles && materialFiles.length > 1 && showControls) {
    return (
      <div className={`w-full h-full ${className}`}>
        <MaterialCarousel files={materialFiles} className="w-full h-full" />
      </div>
    );
  }

  // Prefer matched material assets when available
  const materialThumb = parseUrl(matchedMaterial?.thumbnail_url);
  const materialFile = parseUrl(matchedMaterial?.file_url);
  const inferredType = matchedMaterial?.type || (isVideoUrl(materialFile) ? 'video' : 'image');

  const displayVideoUrl = inferredType === 'video' 
    ? makeAbsoluteUrl(materialFile)
    : (isVideoUrl(videoUrl) ? makeAbsoluteUrl(videoUrl) : undefined);

  const displayImageUrl = makeAbsoluteUrl(materialThumb) 
    || (inferredType === 'image' && materialFile && !isVideoUrl(materialFile) ? makeAbsoluteUrl(materialFile) : undefined)
    || makeAbsoluteUrl(imageUrl);

  const hasValidImage = isValidUrl(displayImageUrl) && (isImageUrl(displayImageUrl) || /^data:/i.test(displayImageUrl!));
  const hasValidVideo = isValidUrl(displayVideoUrl);

  // Diagnostic logs para debug
  if (matchedMaterial) {
    console.log('🎯 CreativeDisplay Debug:', {
      adName,
      materialName: matchedMaterial.name,
      materialFileUrl: matchedMaterial.file_url,
      materialThumb: matchedMaterial.thumbnail_url,
      inferredType,
      displayImageUrl,
      displayVideoUrl,
      hasValidImage,
      hasValidVideo,
      localMaterialId
    });
  }

  // Renderizar vídeo
  if (hasValidVideo) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="text-center p-6">
          <Play className="w-16 h-16 text-primary mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">Vídeo Creative</p>
          <p className="text-sm text-muted-foreground mt-1">
            {matchedMaterial ? `Material: ${matchedMaterial.name}` : 
             creativeId ? `ID: ${creativeId}` : 'Meta Creative'}
          </p>
          {showControls && (
            <Button 
              asChild
              className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <a 
                href={displayVideoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Play className="w-4 h-4 mr-2" />
                Reproduzir Vídeo
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Renderizar imagem
  if (hasValidImage) {
    return (
      <img 
        src={displayImageUrl} 
        alt={adName}
        className={`w-full h-full object-contain ${className}`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'w-full h-full flex items-center justify-center';
            errorDiv.innerHTML = `
              <div class="text-center p-6">
                <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                  <svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <p class="text-lg font-medium text-foreground">Imagem indisponível</p>
                 <p class="text-sm text-muted-foreground mt-1">
                    ${matchedMaterial ? `Material: ${matchedMaterial.name}` : 
                      creativeId ? `ID: ${creativeId}` : 'Criativo não encontrado'}
                  </p>
                </div>
              </div>
            `;
            parent.replaceChildren(errorDiv);
          }
        }}
      />
    );
  }

  // Fallback quando não há criativo disponível
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <div className="text-center p-3 sm:p-4 md:p-6 max-w-full">
        <ImageIcon className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-muted-foreground mx-auto mb-2 sm:mb-3" />
        <p className="text-base sm:text-lg font-medium text-foreground line-clamp-1">Sem criativo disponível</p>
        <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1 break-words line-clamp-2 max-w-full px-2">
          {matchedMaterial ? `Material: ${matchedMaterial.name}` : 
           creativeId ? `ID: ${creativeId}` : 'Criativo não encontrado no Meta'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 sm:mt-2 opacity-70 line-clamp-3 px-2">
          O criativo pode estar sendo processado pelo Meta ou não ter sido encontrado
        </p>
      </div>
    </div>
  );
};