import React from 'react';
import { FabricObject } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface BriefingCanvasContextMenuProps {
  selectedObject: FabricObject | null;
  position: { x: number; y: number };
  onUpdate: (properties: Partial<FabricObject>) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onClose: () => void;
}

export const BriefingCanvasContextMenu: React.FC<BriefingCanvasContextMenuProps> = ({
  selectedObject,
  position,
  onUpdate,
  onBringToFront,
  onSendToBack,
  onClose
}) => {
  const [properties, setProperties] = React.useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    angle: 0,
    opacity: 1,
    fill: '#000000',
    stroke: '#000000',
    fontSize: 20
  });

  React.useEffect(() => {
    if (selectedObject) {
      setProperties({
        left: selectedObject.left || 0,
        top: selectedObject.top || 0,
        width: (selectedObject.width || 0) * (selectedObject.scaleX || 1),
        height: (selectedObject.height || 0) * (selectedObject.scaleY || 1),
        angle: selectedObject.angle || 0,
        opacity: selectedObject.opacity || 1,
        fill: selectedObject.fill as string || '#000000',
        stroke: selectedObject.stroke as string || '#000000',
        fontSize: (selectedObject as any).fontSize || 20
      });
    }
  }, [selectedObject]);

  if (!selectedObject) return null;

  const handlePropertyChange = (key: string, value: any) => {
    const updates: any = {};
    
    if (key === 'width' || key === 'height') {
      if (key === 'width') {
        updates.scaleX = value / (selectedObject.width || 1);
      } else {
        updates.scaleY = value / (selectedObject.height || 1);
      }
    } else {
      updates[key] = value;
    }
    
    setProperties(prev => ({
      ...prev,
      [key]: value
    }));
    
    onUpdate(updates);
  };

  const isTextbox = selectedObject.type === 'textbox' || selectedObject.type === 'text';
  const hasStroke = selectedObject.stroke !== undefined;

  // Calculate position to not cover element
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 20,
    top: position.y,
    zIndex: 1000,
    maxHeight: '80vh',
    overflowY: 'auto'
  };

  return (
    <>
      {/* Backdrop to close on click outside */}
      <div 
        className="fixed inset-0 z-[999]" 
        onClick={onClose}
      />
      
      {/* Context Menu Card */}
      <Card 
        className="w-80 animate-in fade-in duration-200 shadow-lg"
        style={cardStyle}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Propriedades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Position */}
          <div className="space-y-2">
            <Label className="text-xs">Posição</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input 
                  type="number" 
                  value={Math.round(properties.left)} 
                  onChange={(e) => handlePropertyChange('left', Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input 
                  type="number" 
                  value={Math.round(properties.top)} 
                  onChange={(e) => handlePropertyChange('top', Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label className="text-xs">Tamanho</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Largura</Label>
                <Input 
                  type="number" 
                  value={Math.round(properties.width)} 
                  onChange={(e) => handlePropertyChange('width', Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Altura</Label>
                <Input 
                  type="number" 
                  value={Math.round(properties.height)} 
                  onChange={(e) => handlePropertyChange('height', Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <Label className="text-xs">Rotação: {Math.round(properties.angle)}°</Label>
            <Slider
              value={[properties.angle]}
              onValueChange={([value]) => handlePropertyChange('angle', value)}
              min={0}
              max={360}
              step={1}
            />
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <Label className="text-xs">Opacidade: {Math.round(properties.opacity * 100)}%</Label>
            <Slider
              value={[properties.opacity * 100]}
              onValueChange={([value]) => handlePropertyChange('opacity', value / 100)}
              min={0}
              max={100}
              step={1}
            />
          </div>

          {/* Fill Color */}
          {selectedObject.fill && (
            <div className="space-y-2">
              <Label className="text-xs">Cor de Preenchimento</Label>
              <Input
                type="color"
                value={properties.fill}
                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                className="h-10"
              />
            </div>
          )}

          {/* Stroke Color */}
          {hasStroke && (
            <div className="space-y-2">
              <Label className="text-xs">Cor da Borda</Label>
              <Input
                type="color"
                value={properties.stroke}
                onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                className="h-10"
              />
            </div>
          )}

          {/* Font Size for Text */}
          {isTextbox && (
            <div className="space-y-2">
              <Label className="text-xs">Tamanho da Fonte</Label>
              <Input
                type="number"
                value={properties.fontSize}
                onChange={(e) => handlePropertyChange('fontSize', Number(e.target.value))}
                className="h-8"
              />
            </div>
          )}

          {/* Layer Controls */}
          <div className="space-y-2">
            <Label className="text-xs">Camadas</Label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onBringToFront}
                className="flex-1"
              >
                <ArrowUp className="h-4 w-4 mr-1" />
                Frente
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSendToBack}
                className="flex-1"
              >
                <ArrowDown className="h-4 w-4 mr-1" />
                Trás
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
