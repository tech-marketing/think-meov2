import React from 'react';
import { Palette } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ColorPaletteProps {
  colors: string[];
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ colors }) => {
  if (colors.length === 0) return null;
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
        <Palette className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">Paleta de Cores:</span>
        <div className="flex gap-2 flex-wrap">
          {colors.map((color, idx) => (
            <Tooltip key={idx}>
              <TooltipTrigger>
                <div 
                  className="w-8 h-8 rounded-full border-2 border-background shadow-md transition-transform duration-200 hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{color.toUpperCase()}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
