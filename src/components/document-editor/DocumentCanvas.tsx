import React, { useEffect } from 'react';
import { useDocumentCanvas, DocumentSettings } from '@/hooks/useDocumentCanvas';
import { useDocumentHistory } from '@/hooks/useDocumentHistory';

interface DocumentCanvasProps {
  settings: DocumentSettings;
  onCanvasReady?: (canvas: ReturnType<typeof useDocumentCanvas>) => void;
  onHistoryReady?: (history: ReturnType<typeof useDocumentHistory>) => void;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  settings,
  onCanvasReady,
  onHistoryReady,
}) => {
  const canvas = useDocumentCanvas(settings);
  const history = useDocumentHistory(canvas.fabricCanvas);

  useEffect(() => {
    if (canvas.fabricCanvas && onCanvasReady) {
      onCanvasReady(canvas);
    }
  }, [canvas.fabricCanvas, onCanvasReady]);

  useEffect(() => {
    if (canvas.fabricCanvas && onHistoryReady) {
      onHistoryReady(history);
    }
  }, [canvas.fabricCanvas, onHistoryReady]);

  // Auto-save state on canvas changes
  useEffect(() => {
    if (!canvas.fabricCanvas) return;

    const handleObjectModified = () => {
      history.saveState();
    };

    const handleObjectAdded = () => {
      history.saveState();
    };

    const handleObjectRemoved = () => {
      history.saveState();
    };

    canvas.fabricCanvas.on('object:modified', handleObjectModified);
    canvas.fabricCanvas.on('object:added', handleObjectAdded);
    canvas.fabricCanvas.on('object:removed', handleObjectRemoved);

    // Save initial state
    history.saveState();

    return () => {
      canvas.fabricCanvas?.off('object:modified', handleObjectModified);
      canvas.fabricCanvas?.off('object:added', handleObjectAdded);
      canvas.fabricCanvas?.off('object:removed', handleObjectRemoved);
    };
  }, [canvas.fabricCanvas, history]);

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-auto p-8">
      <div 
        className="shadow-2xl border border-border bg-background"
        style={{
          transform: `scale(${canvas.zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <canvas ref={canvas.canvasRef} />
      </div>
    </div>
  );
};
