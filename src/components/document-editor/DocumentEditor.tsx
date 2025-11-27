import React, { useState, useEffect } from 'react';
import { DocumentCanvas } from './DocumentCanvas';
import { DocumentToolbar } from './DocumentToolbar';
import { DocumentSidebar } from './DocumentSidebar';
import { useDocumentCanvas, DocumentSettings } from '@/hooks/useDocumentCanvas';
import { useDocumentHistory } from '@/hooks/useDocumentHistory';
import { toast } from 'sonner';

interface DocumentEditorProps {
  documentId?: string;
  initialData?: string;
  onSave?: (data: string) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  documentId,
  initialData,
  onSave,
}) => {
  const [settings, setSettings] = useState<DocumentSettings>({
    width: 1920,
    height: 1080,
    background: '#ffffff',
    gridEnabled: false,
    snapEnabled: true,
    gridSize: 20,
  });

  const [canvas, setCanvas] = useState<ReturnType<typeof useDocumentCanvas> | null>(null);
  const [history, setHistory] = useState<ReturnType<typeof useDocumentHistory> | null>(null);

  // Load initial data
  useEffect(() => {
    if (initialData && canvas) {
      canvas.loadFromJSON(initialData);
    }
  }, [initialData, canvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          history?.undo();
        } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
          e.preventDefault();
          history?.redo();
        } else if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas?.selectedObject) {
          e.preventDefault();
          canvas.deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, history]);

  const handleSave = () => {
    if (!canvas) return;

    const json = canvas.exportToJSON();
    if (json && onSave) {
      onSave(json);
      toast.success('Documento salvo');
    }
  };

  const handleExport = () => {
    if (!canvas) return;

    const dataURL = canvas.exportToPNG();
    if (!dataURL) return;

    // Create download link
    const link = document.createElement('a');
    link.download = `documento-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    toast.success('Documento exportado');
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <DocumentToolbar
        canvas={canvas}
        history={history}
        onSave={handleSave}
        onExport={handleExport}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <DocumentCanvas
          settings={settings}
          onCanvasReady={setCanvas}
          onHistoryReady={setHistory}
        />
        
        <DocumentSidebar canvas={canvas} />
      </div>
    </div>
  );
};
