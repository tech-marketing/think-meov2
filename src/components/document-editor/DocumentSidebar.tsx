import React, { useState, useEffect } from 'react';
import { FabricObject, Textbox } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ChromePicker } from 'react-color';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { useDocumentCanvas } from '@/hooks/useDocumentCanvas';

interface DocumentSidebarProps {
  canvas: ReturnType<typeof useDocumentCanvas> | null;
  onClose?: () => void;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  canvas,
  onClose,
}) => {
  const selectedObject = canvas?.selectedObject;
  const [properties, setProperties] = useState<any>({});

  useEffect(() => {
    if (!selectedObject) return;

    setProperties({
      left: Math.round(selectedObject.left || 0),
      top: Math.round(selectedObject.top || 0),
      width: Math.round(selectedObject.width || 0),
      height: Math.round(selectedObject.height || 0),
      angle: Math.round(selectedObject.angle || 0),
      opacity: selectedObject.opacity || 1,
      fill: selectedObject.fill || '#000000',
      fontSize: (selectedObject as any).fontSize || 20,
      fontFamily: (selectedObject as any).fontFamily || 'Arial',
      fontWeight: (selectedObject as any).fontWeight || 'normal',
      fontStyle: (selectedObject as any).fontStyle || 'normal',
      textAlign: (selectedObject as any).textAlign || 'left',
    });
  }, [selectedObject]);

  if (!selectedObject) {
    return (
      <div className="w-80 border-l border-border bg-background/95 backdrop-blur p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Selecione um elemento para editar suas propriedades</p>
        </div>
      </div>
    );
  }

  const updateProperty = (key: string, value: any) => {
    if (!canvas) return;
    
    const updates: any = { [key]: value };
    canvas.updateSelectedObject(updates);
    setProperties({ ...properties, [key]: value });
  };

  const isTextObject = selectedObject instanceof Textbox;

  return (
    <div className="w-80 border-l border-border bg-background/95 backdrop-blur flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Propriedades</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Position */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Posição
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="left" className="text-xs">X</Label>
                <Input
                  id="left"
                  type="number"
                  value={properties.left}
                  onChange={(e) => updateProperty('left', Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="top" className="text-xs">Y</Label>
                <Input
                  id="top"
                  type="number"
                  value={properties.top}
                  onChange={(e) => updateProperty('top', Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Tamanho
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="width" className="text-xs">Largura</Label>
                <Input
                  id="width"
                  type="number"
                  value={properties.width}
                  onChange={(e) => updateProperty('width', Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-xs">Altura</Label>
                <Input
                  id="height"
                  type="number"
                  value={properties.height}
                  onChange={(e) => updateProperty('height', Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-3">
            <Label htmlFor="angle" className="text-xs font-semibold uppercase text-muted-foreground">
              Rotação: {properties.angle}°
            </Label>
            <Slider
              id="angle"
              value={[properties.angle]}
              onValueChange={([value]) => updateProperty('angle', value)}
              min={0}
              max={360}
              step={1}
              className="w-full"
            />
          </div>

          {/* Opacity */}
          <div className="space-y-3">
            <Label htmlFor="opacity" className="text-xs font-semibold uppercase text-muted-foreground">
              Opacidade: {Math.round(properties.opacity * 100)}%
            </Label>
            <Slider
              id="opacity"
              value={[properties.opacity * 100]}
              onValueChange={([value]) => updateProperty('opacity', value / 100)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Color */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              {isTextObject ? 'Cor do Texto' : 'Cor de Preenchimento'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start h-10"
                >
                  <div
                    className="w-6 h-6 rounded border border-border mr-2"
                    style={{ backgroundColor: properties.fill }}
                  />
                  {properties.fill}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <ChromePicker
                  color={properties.fill}
                  onChange={(color) => updateProperty('fill', color.hex)}
                  disableAlpha
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Text Properties */}
          {isTextObject && (
            <>
              <Separator />
              
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Texto
                </Label>
                
                <div>
                  <Label htmlFor="fontSize" className="text-xs">Tamanho da Fonte</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    value={properties.fontSize}
                    onChange={(e) => updateProperty('fontSize', Number(e.target.value))}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="fontFamily" className="text-xs">Fonte</Label>
                  <Select
                    value={properties.fontFamily}
                    onValueChange={(value) => updateProperty('fontFamily', value)}
                  >
                    <SelectTrigger id="fontFamily" className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={properties.fontWeight === 'bold' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateProperty('fontWeight', properties.fontWeight === 'bold' ? 'normal' : 'bold')}
                    className="flex-1"
                  >
                    <strong>B</strong>
                  </Button>
                  <Button
                    variant={properties.fontStyle === 'italic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateProperty('fontStyle', properties.fontStyle === 'italic' ? 'normal' : 'italic')}
                    className="flex-1"
                  >
                    <em>I</em>
                  </Button>
                </div>

                <div>
                  <Label className="text-xs">Alinhamento</Label>
                  <Select
                    value={properties.textAlign}
                    onValueChange={(value) => updateProperty('textAlign', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                      <SelectItem value="justify">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Layer Controls */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Camadas
            </Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => canvas?.bringToFront()}
                className="flex-1"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Trazer para Frente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => canvas?.sendToBack()}
                className="flex-1"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Enviar para Trás
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
