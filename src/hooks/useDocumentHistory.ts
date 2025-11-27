import { useState, useCallback } from 'react';
import { Canvas as FabricCanvas } from 'fabric';

interface HistoryState {
  state: string;
  timestamp: number;
}

export const useDocumentHistory = (fabricCanvas: FabricCanvas | null) => {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const saveState = useCallback(() => {
    if (!fabricCanvas) return;

    const state = JSON.stringify(fabricCanvas.toJSON());
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push({
      state,
      timestamp: Date.now(),
    });

    // Keep only last 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [fabricCanvas, history, currentIndex]);

  const undo = useCallback(() => {
    if (!fabricCanvas || currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    const state = history[newIndex];

    fabricCanvas.loadFromJSON(state.state, () => {
      fabricCanvas.renderAll();
      setCurrentIndex(newIndex);
    });
  }, [fabricCanvas, history, currentIndex]);

  const redo = useCallback(() => {
    if (!fabricCanvas || currentIndex >= history.length - 1) return;

    const newIndex = currentIndex + 1;
    const state = history[newIndex];

    fabricCanvas.loadFromJSON(state.state, () => {
      fabricCanvas.renderAll();
      setCurrentIndex(newIndex);
    });
  }, [fabricCanvas, history, currentIndex]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};

