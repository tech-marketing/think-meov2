import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, FabricObject, Rect, Circle, Triangle, Line, Textbox, FabricImage } from 'fabric';

export interface BriefingCanvasSettings {
  width: number;
  height: number;
  backgroundColor?: string;
}

export const useBriefingCanvas = (settings: BriefingCanvasSettings) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [zoom, setZoom] = useState(1);
  const historyStack = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: settings.width,
      height: settings.height,
      backgroundColor: settings.backgroundColor || '#ffffff',
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

    // Save initial state
    setTimeout(() => {
      const json = JSON.stringify(canvas.toJSON());
      historyStack.current = [json];
      historyIndex.current = 0;
    }, 100);

    return () => {
      canvas.dispose();
    };
  }, [settings.width, settings.height, settings.backgroundColor]);

  const saveState = () => {
    if (!fabricCanvas) return;
    const json = JSON.stringify(fabricCanvas.toJSON());
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1);
    historyStack.current.push(json);
    historyIndex.current++;
  };

  const undo = () => {
    if (!fabricCanvas || historyIndex.current <= 0) return;
    historyIndex.current--;
    const state = historyStack.current[historyIndex.current];
    fabricCanvas.loadFromJSON(JSON.parse(state)).then(() => {
      fabricCanvas.renderAll();
    });
  };

  const redo = () => {
    if (!fabricCanvas || historyIndex.current >= historyStack.current.length - 1) return;
    historyIndex.current++;
    const state = historyStack.current[historyIndex.current];
    fabricCanvas.loadFromJSON(JSON.parse(state)).then(() => {
      fabricCanvas.renderAll();
    });
  };

  const addText = (text: string = 'Texto') => {
    if (!fabricCanvas) {
      console.error('addText: Canvas não está pronto');
      return;
    }
    
    // Garantir que text é uma string válida
    const textContent = typeof text === 'string' ? text : 'Texto';
    
    console.log('addText: Adicionando texto ao canvas', textContent);
    
    const textbox = new Textbox(textContent, {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 20,
      fill: '#000000',
      editable: true,
    });
    
    fabricCanvas.add(textbox);
    fabricCanvas.setActiveObject(textbox);
    
    // Usar requestAnimationFrame para garantir que o canvas renderiza corretamente
    requestAnimationFrame(() => {
      fabricCanvas.renderAll();
      saveState();
    });
  };

  const addShape = (type: 'rectangle' | 'circle' | 'triangle' | 'line', color: string = '#000000') => {
    if (!fabricCanvas) return;
    let shape: FabricObject;

    switch (type) {
      case 'rectangle':
        shape = new Rect({
          left: 100,
          top: 100,
          fill: color,
          width: 100,
          height: 100,
        });
        break;
      case 'circle':
        shape = new Circle({
          left: 100,
          top: 100,
          fill: color,
          radius: 50,
        });
        break;
      case 'triangle':
        shape = new Triangle({
          left: 100,
          top: 100,
          fill: color,
          width: 100,
          height: 100,
        });
        break;
      case 'line':
        shape = new Line([50, 50, 200, 50], {
          stroke: color,
          strokeWidth: 3,
        });
        break;
    }

    fabricCanvas.add(shape);
    fabricCanvas.setActiveObject(shape);
    fabricCanvas.renderAll();
    saveState();
  };

  const addImage = async (url: string) => {
    if (!fabricCanvas) return;
    try {
      const img = await FabricImage.fromURL(url);
      img.scale(0.5);
      img.set({
        left: 100,
        top: 100,
      });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveState();
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const deleteSelected = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.remove(selectedObject);
    fabricCanvas.renderAll();
    saveState();
  };

  const clearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = settings.backgroundColor || '#ffffff';
    fabricCanvas.renderAll();
    saveState();
  };

  const zoomIn = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(zoom + 0.1, 3);
    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom);
    fabricCanvas.renderAll();
  };

  const zoomOut = () => {
    if (!fabricCanvas) return;
    const newZoom = Math.max(zoom - 0.1, 0.1);
    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom);
    fabricCanvas.renderAll();
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    setZoom(1);
    fabricCanvas.setZoom(1);
    fabricCanvas.renderAll();
  };

  const exportToJSON = (): string => {
    if (!fabricCanvas) return '{}';
    return JSON.stringify(fabricCanvas.toJSON());
  };

  const loadFromJSON = async (json: string) => {
    if (!fabricCanvas) return;
    try {
      await fabricCanvas.loadFromJSON(JSON.parse(json));
      fabricCanvas.renderAll();
      saveState();
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  };

  const exportToPNG = (): string => {
    if (!fabricCanvas) return '';
    return fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
  };

  const updateSelectedObject = (properties: Partial<FabricObject>) => {
    if (!fabricCanvas || !selectedObject) return;
    selectedObject.set(properties);
    fabricCanvas.renderAll();
    saveState();
  };

  const bringToFront = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    const obj = selectedObject;
    
    // Desselecionar para mostrar mudança visualmente
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    
    // Aplicar mudança de z-index
    fabricCanvas.bringObjectToFront(obj);
    fabricCanvas.renderAll();
    
    // NÃO reselecionar automaticamente - deixar usuário ver a mudança
    saveState();
  };

  const sendToBack = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    const obj = selectedObject;
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    
    fabricCanvas.sendObjectToBack(obj);
    fabricCanvas.renderAll();
    
    // NÃO reselecionar automaticamente
    saveState();
  };

  const bringForward = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    const obj = selectedObject;
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    
    fabricCanvas.bringObjectForward(obj);
    fabricCanvas.renderAll();
    
    // NÃO reselecionar automaticamente
    saveState();
  };

  const sendBackward = () => {
    if (!fabricCanvas || !selectedObject) return;
    
    const obj = selectedObject;
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    
    fabricCanvas.sendObjectBackwards(obj);
    fabricCanvas.renderAll();
    
    // NÃO reselecionar automaticamente
    saveState();
  };

  const toggleBold = () => {
    if (!fabricCanvas || !selectedObject || selectedObject.type !== 'textbox') return;
    
    const textbox = selectedObject as Textbox;
    const currentWeight = textbox.fontWeight || 'normal';
    textbox.set('fontWeight', currentWeight === 'bold' ? 'normal' : 'bold');
    
    fabricCanvas.renderAll();
    saveState();
  };

  const toggleItalic = () => {
    if (!fabricCanvas || !selectedObject || selectedObject.type !== 'textbox') return;
    
    const textbox = selectedObject as Textbox;
    const currentStyle = textbox.fontStyle || 'normal';
    textbox.set('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
    
    fabricCanvas.renderAll();
    saveState();
  };

  const toggleUnderline = () => {
    if (!fabricCanvas || !selectedObject || selectedObject.type !== 'textbox') return;
    
    const textbox = selectedObject as Textbox;
    const current = textbox.underline || false;
    textbox.set('underline', !current);
    
    fabricCanvas.renderAll();
    saveState();
  };

  const changeTextColor = (color: string) => {
    if (!fabricCanvas || !selectedObject || selectedObject.type !== 'textbox') return;
    selectedObject.set('fill', color);
    fabricCanvas.renderAll();
    saveState();
  };

  const changeShapeColor = (color: string) => {
    if (!fabricCanvas || !selectedObject) return;
    if (selectedObject.type === 'line') {
      selectedObject.set('stroke', color);
    } else {
      selectedObject.set('fill', color);
    }
    fabricCanvas.renderAll();
    saveState();
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
    exportToJSON,
    loadFromJSON,
    exportToPNG,
    updateSelectedObject,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    undo,
    redo,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    changeTextColor,
    changeShapeColor,
    canUndo: historyIndex.current > 0,
    canRedo: historyIndex.current < historyStack.current.length - 1,
  };
};
