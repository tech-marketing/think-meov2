import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Type,
  Square,
  Circle,
  Triangle,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Save,
  Layout,
  Palette,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChromePicker } from 'react-color';
import { useDocumentCanvas } from '@/hooks/useDocumentCanvas';
import { useDocumentHistory } from '@/hooks/useDocumentHistory';

interface DocumentToolbarProps {
  canvas: ReturnType<typeof useDocumentCanvas> | null;
  history: ReturnType<typeof useDocumentHistory> | null;
  onSave?: () => void;
  onExport?: () => void;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  canvas,
  history,
  onSave,
  onExport,
}) => {
  const [shapeColor, setShapeColor] = useState('#6E50FF');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      canvas.addImage(url);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundChange = (color: string) => {
    setBackgroundColor(color);
    if (canvas?.fabricCanvas) {
      canvas.fabricCanvas.backgroundColor = color;
      canvas.fabricCanvas.renderAll();
    }
  };

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 p-2 overflow-x-auto">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => history?.undo()}
            disabled={!history?.canUndo}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => history?.redo()}
            disabled={!history?.canRedo}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.zoomOut()}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.resetZoom()}
            title="Resetar zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.zoomIn()}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
            {Math.round((canvas?.zoom || 1) * 100)}%
          </span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Add Elements */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.addText()}
            title="Adicionar texto"
          >
            <Type className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Escolher cor das formas">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <ChromePicker
                color={shapeColor}
                onChange={(color) => setShapeColor(color.hex)}
                disableAlpha
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.addShape('rectangle', shapeColor)}
            title="Adicionar retângulo"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.addShape('circle', shapeColor)}
            title="Adicionar círculo"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.addShape('triangle', shapeColor)}
            title="Adicionar triângulo"
          >
            <Triangle className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.getElementById('image-upload')?.click()}
            title="Adicionar imagem"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Background */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" title="Cor de fundo">
              <Layout className="h-4 w-4 mr-2" />
              Fundo
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <ChromePicker
              color={backgroundColor}
              onChange={(color) => handleBackgroundChange(color.hex)}
              disableAlpha
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canvas?.deleteSelected()}
            disabled={!canvas?.selectedObject}
            title="Deletar elemento (Del)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1" />

        {/* Save/Export */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            title="Salvar documento"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            title="Exportar PNG"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>
    </div>
  );
};
