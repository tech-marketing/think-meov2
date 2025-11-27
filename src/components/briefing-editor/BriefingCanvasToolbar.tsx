import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Type,
  Square,
  Circle,
  Triangle,
  Minus,
  Image as ImageIcon,
  Trash2,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Bold,
  Italic,
  Underline,
  Palette,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';

interface BriefingCanvasToolbarProps {
  onAddText: () => void;
  onAddShape: (type: 'rectangle' | 'circle' | 'triangle' | 'line', color: string) => void;
  onAddImage: (file: File) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onChangeTextColor: (color: string) => void;
  onChangeShapeColor: (color: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  selectedObjectType: string | null;
}

export const BriefingCanvasToolbar: React.FC<BriefingCanvasToolbarProps> = ({
  onAddText,
  onAddShape,
  onAddImage,
  onDelete,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onChangeTextColor,
  onChangeShapeColor,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  canUndo,
  canRedo,
  hasSelection,
  selectedObjectType,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textColorInputRef = React.useRef<HTMLInputElement>(null);
  const shapeColorInputRef = React.useRef<HTMLInputElement>(null);
  
  const isTextSelected = selectedObjectType === 'textbox' || selectedObjectType === 'text';
  const isShapeSelected = hasSelection && !isTextSelected;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddImage(file);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 p-3 border-b bg-background shadow-sm">
        {/* History */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Add Text */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddText}
            >
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Texto</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Shapes - Simples, cor padrão preta */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAddShape('rectangle', '#000000')}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Retângulo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAddShape('circle', '#000000')}
            >
              <Circle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Círculo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAddShape('triangle', '#000000')}
            >
              <Triangle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Triângulo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onAddShape('line', '#000000')}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Linha</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Add Image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar Imagem</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={!hasSelection}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar (Delete)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Diminuir Zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onResetZoom}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resetar Zoom (100%)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Aumentar Zoom</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Text Formatting - sempre visíveis, desabilitados quando texto não está selecionado */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleBold}
              disabled={!isTextSelected}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Negrito</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleItalic}
              disabled={!isTextSelected}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Itálico</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleUnderline}
              disabled={!isTextSelected}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sublinhar</TooltipContent>
        </Tooltip>

            <input
              ref={textColorInputRef}
              type="color"
              onChange={(e) => onChangeTextColor(e.target.value)}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
            />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => textColorInputRef.current?.click()}
              disabled={!isTextSelected}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cor do Texto</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Shape Color - sempre visível, desabilitado quando forma não está selecionada */}
            <input
              ref={shapeColorInputRef}
              type="color"
              onChange={(e) => onChangeShapeColor(e.target.value)}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
            />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shapeColorInputRef.current?.click()}
              disabled={!isShapeSelected}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cor do Elemento</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Layer Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBringToFront}
              disabled={!hasSelection}
            >
              <ChevronsUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Trazer para Frente</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBringForward}
              disabled={!hasSelection}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Avançar Uma Camada</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSendBackward}
              disabled={!hasSelection}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recuar Uma Camada</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSendToBack}
              disabled={!hasSelection}
            >
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar para Trás</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
