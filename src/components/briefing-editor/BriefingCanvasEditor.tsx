import React, { useEffect, useState } from 'react';
import { useBriefingCanvas } from '@/hooks/useBriefingCanvas';
import { BriefingCanvasToolbar } from './BriefingCanvasToolbar';
import { BriefingCanvasContextMenu } from './BriefingCanvasContextMenu';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BriefingCanvasEditorProps {
  content: string;
  onChange: (content: string) => void;
  wireframeData?: {
    isCarousel?: boolean;
    slideCount?: number;
    slides?: Array<{ imageUrl: string; index: number }>;
  };
}
export const BriefingCanvasEditor: React.FC<BriefingCanvasEditorProps> = ({
  content,
  onChange,
  wireframeData
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const canvas = useBriefingCanvas({
    width: 700,
    height: 550,
    backgroundColor: '#ffffff'
  });

  // Load initial content
  useEffect(() => {
    if (content && canvas.fabricCanvas) {
      try {
        canvas.loadFromJSON(content);
      } catch (error) {
        console.error('Error loading canvas content:', error);
      }
    }
  }, [canvas.fabricCanvas]);

  // Auto-save on changes
  useEffect(() => {
    if (!canvas.fabricCanvas) return;
    const handleModified = () => {
      const json = canvas.exportToJSON();
      onChange(json);
    };
    canvas.fabricCanvas.on('object:modified', handleModified);
    canvas.fabricCanvas.on('object:added', handleModified);
    canvas.fabricCanvas.on('object:removed', handleModified);
    return () => {
      canvas.fabricCanvas?.off('object:modified', handleModified);
      canvas.fabricCanvas?.off('object:added', handleModified);
      canvas.fabricCanvas?.off('object:removed', handleModified);
    };
  }, [canvas.fabricCanvas, onChange]);

  // Context menu on right click
  useEffect(() => {
    if (!canvas.fabricCanvas) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      const activeObject = canvas.fabricCanvas?.getActiveObject();
      if (activeObject) {
        setContextMenu({
          x: e.clientX,
          y: e.clientY
        });
      }
    };

    // Verificar se o canvas está pronto antes de acessar o elemento
    try {
      const canvasElement = canvas.fabricCanvas.getElement();
      if (!canvasElement) return;
      
      canvasElement.addEventListener('contextmenu', handleContextMenu);

      return () => {
        canvasElement.removeEventListener('contextmenu', handleContextMenu);
      };
    } catch (error) {
      console.error('Error setting up context menu:', error);
    }
  }, [canvas.fabricCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        canvas.deleteSelected();
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        canvas.undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        canvas.redo();
      } else if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas]);
  const handleAddImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target?.result as string;
      canvas.addImage(url);
    };
    reader.readAsDataURL(file);
  };

  // Render carousel viewer if carousel data exists
  if (wireframeData?.isCarousel && wireframeData.slides && wireframeData.slides.length > 0) {
    const slides = wireframeData.slides;
    const totalSlides = slides.length;

    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <div className="relative max-w-4xl w-full">
            {/* Carousel Image */}
            <div className="bg-card rounded-lg shadow-lg overflow-hidden aspect-[9/16]">
              <img
                src={slides[currentSlide].imageUrl}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm text-muted-foreground">
                {currentSlide + 1} / {totalSlides}
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1))}
                disabled={currentSlide === totalSlides - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Thumbnail Navigation */}
            <div className="flex gap-2 mt-4 justify-center overflow-x-auto">
              {slides.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`flex-shrink-0 w-16 h-24 rounded border-2 overflow-hidden transition-all ${
                    currentSlide === index
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img
                    src={slide.imageUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default canvas editor
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar no topo */}
      <BriefingCanvasToolbar
        onAddText={() => canvas.addText()}
        onAddShape={canvas.addShape} 
        onAddImage={handleAddImage} 
        onDelete={canvas.deleteSelected} 
        onUndo={canvas.undo} 
        onRedo={canvas.redo} 
        onZoomIn={canvas.zoomIn} 
        onZoomOut={canvas.zoomOut} 
        onResetZoom={canvas.resetZoom} 
        onToggleBold={canvas.toggleBold}
        onToggleItalic={canvas.toggleItalic}
        onToggleUnderline={canvas.toggleUnderline}
        onChangeTextColor={canvas.changeTextColor}
        onChangeShapeColor={canvas.changeShapeColor}
        onBringToFront={canvas.bringToFront}
        onSendToBack={canvas.sendToBack}
        onBringForward={canvas.bringForward}
        onSendBackward={canvas.sendBackward}
        canUndo={canvas.canUndo} 
        canRedo={canvas.canRedo} 
        hasSelection={!!canvas.selectedObject}
        selectedObjectType={canvas.selectedObject?.type || null}
      />

      {/* Canvas centralizado sem painel lateral */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="shadow-lg bg-white rounded-sm">
          <canvas ref={canvas.canvasRef} />
        </div>
      </div>

      {/* Context Menu flutuante (só aparece no clique direito) */}
      {contextMenu && canvas.selectedObject && (
        <BriefingCanvasContextMenu
          selectedObject={canvas.selectedObject}
          position={contextMenu}
          onUpdate={canvas.updateSelectedObject}
          onBringToFront={canvas.bringToFront}
          onSendToBack={canvas.sendToBack}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};