import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WireframeElement } from '@/hooks/useWireframeLayout';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertiesPanelProps {
  element: WireframeElement | null;
  onUpdate: (updates: Partial<WireframeElement>) => void;
  onClose: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  element,
  onUpdate,
  onClose,
}) => {
  if (!element) return null;

  return (
    <Card className="absolute right-4 top-4 w-72 shadow-lg z-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Propriedades</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="left" className="text-xs">Posição X (%)</Label>
            <Input
              id="left"
              type="number"
              value={Math.round(element.left * 10) / 10}
              onChange={(e) => onUpdate({ left: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs"
              step="0.1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="top" className="text-xs">Posição Y (%)</Label>
            <Input
              id="top"
              type="number"
              value={Math.round(element.top * 10) / 10}
              onChange={(e) => onUpdate({ top: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs"
              step="0.1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="width" className="text-xs">Largura (%)</Label>
            <Input
              id="width"
              type="number"
              value={Math.round(element.width * 10) / 10}
              onChange={(e) => onUpdate({ width: parseFloat(e.target.value) || 1 })}
              className="h-8 text-xs"
              step="0.1"
              min="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height" className="text-xs">Altura (%)</Label>
            <Input
              id="height"
              type="number"
              value={Math.round(element.height * 10) / 10}
              onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 1 })}
              className="h-8 text-xs"
              step="0.1"
              min="1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zIndex" className="text-xs">Camada (Z-Index)</Label>
          <Input
            id="zIndex"
            type="number"
            value={element.zIndex}
            onChange={(e) => onUpdate({ zIndex: parseInt(e.target.value) || 1 })}
            className="h-8 text-xs"
            min="1"
          />
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Tipo:</span>
            <span className="font-medium">{element.role}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>ID:</span>
            <span className="font-mono text-[10px]">{element.id}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
