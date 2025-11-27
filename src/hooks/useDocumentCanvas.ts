import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, FabricObject, Rect, Circle, Triangle, Textbox, FabricImage } from 'fabric';
import { toast } from 'sonner';

export interface DocumentSettings {
  width: number;
  height: number;
  background: string;
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSize: number;
}

export const useDocumentCanvas = (settings: DocumentSettings) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: settings.width,
      height: settings.height,
      backgroundColor: settings.background,
      selection: true,
      preserveObjectStacking: true,
    });

    // Selection events
    canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });

    canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0] || null);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update canvas settings
  useEffect(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.setDimensions({
      width: settings.width,
      height: settings.height,
    });
    fabricCanvas.backgroundColor = settings.background;
    fabricCanvas.renderAll();
  }, [fabricCanvas, settings]);

  // Add text element
  const addText = (text: string = 'Digite aqui...') => {
    if (!fabricCanvas) return;

    const textbox = new Textbox(text, {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 20,
      fill: '#000000',
      fontFamily: 'Arial',
    });

    fabricCanvas.add(textbox);
    fabricCanvas.setActiveObject(textbox);
    fabricCanvas.renderAll();
    toast.success('Texto adicionado');
  };

  // Add shape element
  const addShape = (type: 'rectangle' | 'circle' | 'triangle', color: string = '#6E50FF') => {
    if (!fabricCanvas) return;

    let shape: FabricObject;

    switch (type) {
      case 'rectangle':
        shape = new Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: color,
        });
        break;
      case 'circle':
        shape = new Circle({
          left: 100,
          top: 100,
          radius: 50,
          fill: color,
        });
        break;
      case 'triangle':
        shape = new Triangle({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: color,
        });
        break;
    }

    fabricCanvas.add(shape);
    fabricCanvas.setActiveObject(shape);
    fabricCanvas.renderAll();
    toast.success('Forma adicionada');
  };

  // Add image element
  const addImage = (url: string) => {
    if (!fabricCanvas) return;

    FabricImage.fromURL(url, {
      crossOrigin: 'anonymous',
    }).then((img) => {
      img.scaleToWidth(200);
      img.set({
        left: 100,
        top: 100,
      });
      
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      toast.success('Imagem adicionada');
    }).catch(() => {
      toast.error('Erro ao carregar imagem');
    });
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    fabricCanvas.remove(selectedObject);
    fabricCanvas.renderAll();
    toast.success('Elemento removido');
  };

  // Clear canvas
  const clearCanvas = () => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = settings.background;
    fabricCanvas.renderAll();
    toast.success('Canvas limpo');
  };

  // Zoom controls
  const zoomIn = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(zoom * 1.2, 5);
    fabricCanvas.setZoom(newZoom);
    setZoom(newZoom);
  };

  const zoomOut = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.max(zoom / 1.2, 0.1);
    fabricCanvas.setZoom(newZoom);
    setZoom(newZoom);
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    setZoom(1);
  };

  // Export canvas
  const exportToPNG = () => {
    if (!fabricCanvas) return null;
    return fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
  };

  const exportToJSON = () => {
    if (!fabricCanvas) return null;
    return JSON.stringify(fabricCanvas.toJSON());
  };

  const loadFromJSON = (json: string) => {
    if (!fabricCanvas) return;
    
    fabricCanvas.loadFromJSON(json, () => {
      fabricCanvas.renderAll();
      toast.success('Documento carregado');
    });
  };

  // Update selected object properties
  const updateSelectedObject = (properties: Partial<FabricObject>) => {
    if (!fabricCanvas || !selectedObject) return;
    
    selectedObject.set(properties);
    fabricCanvas.renderAll();
  };

  // Bring to front / send to back
  const bringToFront = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.bringObjectToFront(selectedObject);
    fabricCanvas.renderAll();
  };

  const sendToBack = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.sendObjectToBack(selectedObject);
    fabricCanvas.renderAll();
  };

  return {
    canvasRef,
    fabricCanvas,
    selectedObject,
    zoom,
    addText,
    addShape,
    addImage,
    deleteSelected,
    clearCanvas,
    zoomIn,
    zoomOut,
    resetZoom,
    exportToPNG,
    exportToJSON,
    loadFromJSON,
    updateSelectedObject,
    bringToFront,
    sendToBack,
  };
};
