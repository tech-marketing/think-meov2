import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Edit3,
  Grid3X3,
  Save,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Lock,
  Unlock,
  Copy,
  Trash2,
  MoveUp,
  MoveDown,
  Eye,
  Layout,
  Clipboard,
  CopyPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useWireframeLayout, WireframeElement, WireframeLayout } from '@/hooks/useWireframeLayout';
import { WireframeLayoutManager } from './WireframeLayoutManager';
import { WireframeTemplateSelector } from './WireframeTemplateSelector';
import {
  ASPECT_RATIOS,
  applySmartSnapping,
  calculateSnapGuides,
  SnapGuide
} from '@/utils/wireframeUtils';
import { ResizeHandles } from './wireframe/ResizeHandles';
import { PropertiesPanel } from './wireframe/PropertiesPanel';
import personaIcon from "@/assets/persona-icon.png";

interface WireframeEditorProps {
  wireframe: any; // Original wireframe data
  creativeId?: string;
  aspectRatio?: string;
  className?: string;
  onSave?: (layout: WireframeLayout) => void;
}

export const WireframeEditor: React.FC<WireframeEditorProps> = ({
  wireframe,
  creativeId = 'default',
  aspectRatio = '1:1',
  className,
  onSave
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const editableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [clipboard, setClipboard] = useState<WireframeElement | null>(null);

  const handleTemplateSelect = (type: 'default' | 'advertorial' | 'news' | 'card') => {
    saveToHistory();

    let newLayout: WireframeLayout | null = null;

    switch (type) {
      case 'advertorial':
        newLayout = createAdvertorialTemplate();
        break;
      case 'news':
        newLayout = createNewsTemplate();
        break;
      case 'card':
        newLayout = createCardTemplate();
        break;
      default:
        return;
    }

    if (newLayout) {
      setLayout(newLayout);
      setShowTemplateSelector(false);
      toast({
        title: "Template aplicado!",
        description: `Layout ${type} foi carregado com sucesso.`
      });
    }
  };

  // Use the custom hook for layout management
  const {
    layout,
    setLayout,
    loading,
    saving,
    versions,
    saveLayout,
    loadVersions,
    restoreVersion,
    autoSave,
    createAdvertorialTemplate,
    createNewsTemplate,
    createCardTemplate
  } = useWireframeLayout({
    creativeId,
    aspectRatio: currentAspectRatio,
    initialWireframe: wireframe || null // Explicitly handle undefined
  });

  // Undo/Redo stack
  const [undoStack, setUndoStack] = useState<WireframeLayout[]>([]);
  const [redoStack, setRedoStack] = useState<WireframeLayout[]>([]);

  const saveToHistory = useCallback(() => {
    if (layout) {
      setUndoStack(prev => [...prev.slice(-19), { ...layout }]);
      setRedoStack([]);
    }
  }, [layout]);

  const undo = () => {
    if (undoStack.length === 0 || !layout) return;
    const previousLayout = undoStack[undoStack.length - 1];
    setRedoStack(prev => [layout, ...prev]);
    setUndoStack(prev => prev.slice(0, -1));
    setLayout(previousLayout);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextLayout = redoStack[0];
    if (layout) {
      setUndoStack(prev => [...prev, layout]);
    }
    setRedoStack(prev => prev.slice(1));
    setLayout(nextLayout);
  };

  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (!isEditMode) return;

    e.preventDefault();
    e.stopPropagation();

    if (!layout) return;
    const element = layout.elements.find(el => el.id === elementId);
    if (!element || element.locked) return;

    // If editing text, don't drag
    if (editingText === elementId) return;

    // Se já estava selecionado, permite arrastar
    if (selectedElement === elementId) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      saveToHistory();
    } else {
      // Primeiro clique: apenas seleciona
      setSelectedElement(elementId);
      // Stop editing if editing another element
      if (editingText && editingText !== elementId) {
        setEditingText(null);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!isEditMode) return;

    // Se clicar diretamente no canvas (não em um elemento), desseleciona e sai do modo de edição
    if (e.target === e.currentTarget) {
      if (editingText) {
        setEditingText(null);
      }
      setSelectedElement(null);
      setShowPropertiesPanel(false);
    }
  };

  // Handle text click to enter edit mode (Canva style)
  const handleTextClick = (e: React.MouseEvent, elementId: string) => {
    if (!isEditMode) return;

    e.stopPropagation();

    if (!layout) return;
    const element = layout.elements.find(el => el.id === elementId);
    if (!element || element.locked) return;

    // If element is already selected and we're not dragging, enter edit mode
    if (selectedElement === elementId && !isDragging) {
      setEditingText(elementId);

      // Focus the element after a short delay to ensure render
      setTimeout(() => {
        const editableEl = editableRefs.current.get(elementId);
        if (editableEl) {
          editableEl.focus();
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(editableEl);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  };

  // Handle blur when clicking outside of editable text
  const handleTextBlur = (elementId: string) => {
    if (!layout) return;
    const element = layout.elements.find(el => el.id === elementId);
    if (!element) return;

    const editableEl = editableRefs.current.get(elementId);
    if (!editableEl) return;

    const newText = editableEl.innerText;

    saveToHistory();

    if (element.role === 'title') {
      setLayout(prev => prev ? ({
        ...prev,
        content: { ...prev.content, title: newText }
      }) : prev);
    } else if (element.role === 'subtitle') {
      setLayout(prev => prev ? ({
        ...prev,
        content: { ...prev.content, subtitle: newText }
      }) : prev);
    } else if (element.role === 'news-title') {
      setLayout(prev => prev ? ({
        ...prev,
        content: { ...prev.content, newsTitle: newText }
      }) : prev);
    } else if (element.role === 'source-label') {
      setLayout(prev => prev ? ({
        ...prev,
        content: { ...prev.content, sourceLabel: newText }
      }) : prev);
    }

    setEditingText(null);
  };

  // Handle keyboard events during text editing
  const handleTextKeyDown = (e: React.KeyboardEvent, elementId: string) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const editableEl = editableRefs.current.get(elementId);
      if (editableEl) {
        editableEl.blur();
      }
      setEditingText(null);
    }
    // Allow Enter for line breaks, don't prevent default
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedElement || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    setLayout(prev => {
      if (!prev) return prev;
      return ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === selectedElement
            ? {
              ...el,
              left: Math.max(0, Math.min(100 - el.width, el.left + deltaX)),
              top: Math.max(0, Math.min(100 - el.height, el.top + deltaY))
            }
            : el
        )
      });
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, selectedElement, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleElement = (elementId: string, property: 'locked') => {
    saveToHistory();
    setLayout(prev => {
      if (!prev) return prev;
      return ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === elementId
            ? { ...el, [property]: !el[property] }
            : el
        )
      });
    });
  };

  const alignElements = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElement) return;

    saveToHistory();
    setLayout(prev => {
      if (!prev) return prev;
      return ({
        ...prev,
        elements: prev.elements.map(el => {
          if (el.id !== selectedElement) return el;

          switch (alignment) {
            case 'left':
              return { ...el, left: 0 };
            case 'center':
              return { ...el, left: (100 - el.width) / 2 };
            case 'right':
              return { ...el, left: 100 - el.width };
            case 'top':
              return { ...el, top: 0 };
            case 'middle':
              return { ...el, top: (100 - el.height) / 2 };
            case 'bottom':
              return { ...el, top: 100 - el.height };
            default:
              return el;
          }
        })
      });
    });
  };

  const changeZIndex = (elementId: string, direction: 'up' | 'down') => {
    saveToHistory();
    setLayout(prev => {
      if (!prev) return prev;
      return ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === elementId
            ? { ...el, zIndex: direction === 'up' ? el.zIndex + 1 : Math.max(1, el.zIndex - 1) }
            : el
        )
      });
    });
  };

  const toggleEditMode = async () => {
    if (isEditMode) {
      // Save when exiting edit mode
      if (layout) {
        // Validar que há pelo menos 1 elemento
        if (layout.elements.length === 0) {
          toast({
            title: "Erro ao salvar",
            description: "Deve haver pelo menos um elemento no wireframe.",
            variant: "destructive"
          });
          return;
        }

        try {
          await saveLayout(layout, true);

          // Salvar também no material se onSave foi fornecido
          if (onSave) {
            onSave(layout);
          }

          toast({
            title: "Layout salvo!",
            description: "As alterações foram salvas automaticamente."
          });
        } catch (error) {
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível salvar o layout.",
            variant: "destructive"
          });
        }
      }
    }
    setIsEditMode(!isEditMode);
    setSelectedElement(null);
  };

  const addTextElement = () => {
    if (!layout) return;

    saveToHistory();
    const newElement: WireframeElement = {
      id: `text_${Date.now()}`,
      role: 'text',
      left: 25,
      top: 45,
      width: 50,
      height: 8,
      zIndex: 4,
      locked: false
    };

    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: [...prev.elements, newElement]
      };
    });
  };

  const deleteElement = (elementId: string) => {
    if (!layout) return;

    // Verificar se é o último elemento
    if (layout.elements.length <= 1) {
      toast({
        title: "Não é possível excluir",
        description: "Deve haver pelo menos um elemento no wireframe.",
        variant: "destructive"
      });
      return;
    }

    saveToHistory();
    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: prev.elements.filter(el => el.id !== elementId)
      };
    });

    // Clear selection if deleted element was selected
    if (selectedElement === elementId) {
      setSelectedElement(null);
      setShowPropertiesPanel(false);
    }
  };

  // Copy element to clipboard
  const copyElement = () => {
    if (!selectedElement || !layout) return;

    const element = layout.elements.find(el => el.id === selectedElement);
    if (!element) return;

    setClipboard({ ...element });
    toast({
      title: "Elemento copiado",
      description: "Use Ctrl+V para colar ou clique com botão direito e selecione 'Colar'."
    });
  };

  // Paste element from clipboard
  const pasteElement = () => {
    if (!clipboard || !layout) return;

    saveToHistory();

    // Create new element with offset position and new ID
    const newElement: WireframeElement = {
      ...clipboard,
      id: `${clipboard.role}_${Date.now()}`,
      left: Math.min(clipboard.left + 5, 95),
      top: Math.min(clipboard.top + 5, 95),
    };

    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: [...prev.elements, newElement]
      };
    });

    setSelectedElement(newElement.id);
    toast({
      title: "Elemento colado",
      description: "Novo elemento adicionado ao wireframe."
    });
  };

  // Duplicate selected element
  const duplicateElement = () => {
    if (!selectedElement || !layout) return;

    const element = layout.elements.find(el => el.id === selectedElement);
    if (!element) return;

    saveToHistory();

    // Create duplicate with offset position
    const newElement: WireframeElement = {
      ...element,
      id: `${element.role}_${Date.now()}`,
      left: Math.min(element.left + 5, 95),
      top: Math.min(element.top + 5, 95),
    };

    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: [...prev.elements, newElement]
      };
    });

    setSelectedElement(newElement.id);
    toast({
      title: "Elemento duplicado",
      description: "Cópia do elemento adicionada ao wireframe."
    });
  };

  // Handle resize
  const handleResize = useCallback((direction: string, deltaX: number, deltaY: number) => {
    if (!selectedElement || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: prev.elements.map(el => {
          if (el.id !== selectedElement) return el;

          const deltaXPercent = (deltaX / rect.width) * 100;
          const deltaYPercent = (deltaY / rect.height) * 100;

          let newLeft = el.left;
          let newTop = el.top;
          let newWidth = el.width;
          let newHeight = el.height;

          // Handle different resize directions
          switch (direction) {
            case 'nw':
              newLeft = el.left + deltaXPercent;
              newTop = el.top + deltaYPercent;
              newWidth = el.width - deltaXPercent;
              newHeight = el.height - deltaYPercent;
              break;
            case 'ne':
              newTop = el.top + deltaYPercent;
              newWidth = el.width + deltaXPercent;
              newHeight = el.height - deltaYPercent;
              break;
            case 'sw':
              newLeft = el.left + deltaXPercent;
              newWidth = el.width - deltaXPercent;
              newHeight = el.height + deltaYPercent;
              break;
            case 'se':
              newWidth = el.width + deltaXPercent;
              newHeight = el.height + deltaYPercent;
              break;
            case 'n':
              newTop = el.top + deltaYPercent;
              newHeight = el.height - deltaYPercent;
              break;
            case 's':
              newHeight = el.height + deltaYPercent;
              break;
            case 'w':
              newLeft = el.left + deltaXPercent;
              newWidth = el.width - deltaXPercent;
              break;
            case 'e':
              newWidth = el.width + deltaXPercent;
              break;
          }

          // Ensure minimum size and bounds
          newWidth = Math.max(5, Math.min(100, newWidth));
          newHeight = Math.max(3, Math.min(100, newHeight));
          newLeft = Math.max(0, Math.min(100 - newWidth, newLeft));
          newTop = Math.max(0, Math.min(100 - newHeight, newTop));

          return {
            ...el,
            left: newLeft,
            top: newTop,
            width: newWidth,
            height: newHeight,
          };
        }),
      };
    });
  }, [selectedElement, setLayout]);

  const handleResizeStart = () => {
    setIsResizing(true);
    if (!selectedElement || !layout) return;
    const element = layout.elements.find(el => el.id === selectedElement);
    if (element) {
      setResizeStart({
        width: element.width,
        height: element.height,
        left: element.left,
        top: element.top,
      });
    }
    saveToHistory();
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  const updateElementProperties = (updates: Partial<WireframeElement>) => {
    if (!selectedElement) return;

    saveToHistory();
    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: prev.elements.map(el =>
          el.id === selectedElement ? { ...el, ...updates } : el
        ),
      };
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditMode || editingText) return;

      // Delete element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        e.preventDefault();
        deleteElement(selectedElement);
      }

      // Copy/Paste/Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedElement) {
        e.preventDefault();
        copyElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        pasteElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElement) {
        e.preventDefault();
        duplicateElement();
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Arrow keys for movement
      if (selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;

        setLayout(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            elements: prev.elements.map(el => {
              if (el.id !== selectedElement) return el;

              let newLeft = el.left;
              let newTop = el.top;

              switch (e.key) {
                case 'ArrowLeft':
                  newLeft = Math.max(0, el.left - step);
                  break;
                case 'ArrowRight':
                  newLeft = Math.min(100 - el.width, el.left + step);
                  break;
                case 'ArrowUp':
                  newTop = Math.max(0, el.top - step);
                  break;
                case 'ArrowDown':
                  newTop = Math.min(100 - el.height, el.top + step);
                  break;
              }

              return { ...el, left: newLeft, top: newTop };
            }),
          };
        });
      }

      // Escape to deselect
      if (e.key === 'Escape' && selectedElement) {
        setSelectedElement(null);
        setShowPropertiesPanel(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedElement, editingText, clipboard, undo, redo, deleteElement, copyElement, pasteElement, duplicateElement, setLayout]);

  const renderElement = (element: WireframeElement) => {
    const isSelected = selectedElement === element.id;
    const content = layout.content;

    const style = {
      position: 'absolute' as const,
      left: `${element.left}%`,
      top: `${element.top}%`,
      width: `${element.width}%`,
      height: `${element.height}%`,
      zIndex: element.zIndex,
      cursor: isEditMode && !element.locked ? 'move' : 'default'
    };

    const commonClasses = cn(
      "transition-all duration-200 relative",
      isEditMode && "border-2",
      isSelected && "border-primary border-solid shadow-lg ring-2 ring-primary/20",
      !isSelected && isEditMode && "border-gray-300 border-dashed hover:border-gray-400",
      element.locked && "opacity-60",
      // Dynamic cursor
      isSelected && isEditMode ? "cursor-move" : isEditMode && !element.locked ? "cursor-pointer" : ""
    );

    switch (element.role) {
      case 'logo':
        return (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "bg-gray-300 rounded flex items-center justify-center text-xs font-medium text-gray-600")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
          >
            LOGO
            {isSelected && isEditMode && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

      case 'title':
        const titleElement = (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-2 overflow-hidden")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => handleTextClick(e, element.id)}
          >
            <h1
              ref={(el) => el && editableRefs.current.set(element.id, el)}
              contentEditable={editingText === element.id}
              suppressContentEditableWarning
              onBlur={() => editingText === element.id && handleTextBlur(element.id)}
              onKeyDown={(e) => editingText === element.id && handleTextKeyDown(e, element.id)}
              className={cn(
                "text-sm font-bold text-gray-800 text-center leading-tight break-words whitespace-pre-wrap w-full",
                editingText === element.id && "outline-none ring-2 ring-primary/50 bg-white/50"
              )}
            >
              {content.title}
            </h1>
            {isSelected && isEditMode && !editingText && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

        return isEditMode ? (
          <ContextMenu key={element.id}>
            <ContextMenuTrigger asChild>
              {titleElement}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={copyElement}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={pasteElement} disabled={!clipboard}>
                <Clipboard className="mr-2 h-4 w-4" />
                Colar
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={duplicateElement}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicar
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => deleteElement(element.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : titleElement;

      case 'subtitle':
        const subtitleElement = (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-2")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => handleTextClick(e, element.id)}
          >
            <p
              ref={(el) => el && editableRefs.current.set(element.id, el)}
              contentEditable={editingText === element.id}
              suppressContentEditableWarning
              onBlur={() => editingText === element.id && handleTextBlur(element.id)}
              onKeyDown={(e) => editingText === element.id && handleTextKeyDown(e, element.id)}
              className={cn(
                "text-xs font-semibold text-gray-700 text-center leading-relaxed break-words whitespace-pre-wrap w-full overflow-visible",
                editingText === element.id && "outline-none ring-2 ring-primary/50 bg-white/50"
              )}
            >
              {content.subtitle}
            </p>
            {isSelected && isEditMode && !editingText && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

        return isEditMode ? (
          <ContextMenu key={element.id}>
            <ContextMenuTrigger asChild>
              {subtitleElement}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={copyElement}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={pasteElement} disabled={!clipboard}>
                <Clipboard className="mr-2 h-4 w-4" />
                Colar
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={duplicateElement}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicar
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => deleteElement(element.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : subtitleElement;

      case 'persona':
        const isHuman = element.personType === 'human';

        if (isHuman) {
          return (
            <div
              key={element.id}
              style={style}
              className={cn(commonClasses, "flex items-end justify-center")}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
            >
              <img
                src={personaIcon}
                alt="Persona"
                className="w-full h-full object-contain opacity-80"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
              />
              {isSelected && isEditMode && (
                <ResizeHandles
                  onResize={handleResize}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                />
              )}
            </div>
          );
        } else {
          return (
            <div
              key={element.id}
              style={style}
              className={cn(commonClasses, "flex items-center justify-center p-1")}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
            >
              <span className="px-2 py-1 text-xs font-medium text-black rounded-full bg-yellow-400 break-words text-center">
                {content.persona}
              </span>
              {isSelected && isEditMode && (
                <ResizeHandles
                  onResize={handleResize}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                />
              )}
            </div>
          );
        }

      case 'separator':
        return (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
          >
            <hr className="w-full border-gray-400" />
            {isSelected && isEditMode && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

      case 'cta':
        return (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-2")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
          >
            <button className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full hover:bg-blue-700 break-words text-center">
              {content.ctaLabel}
            </button>
            {isSelected && isEditMode && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

      case 'text':
        const textElement = (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-2 overflow-hidden")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => handleTextClick(e, element.id)}
          >
            <p
              ref={(el) => el && editableRefs.current.set(element.id, el)}
              contentEditable={editingText === element.id}
              suppressContentEditableWarning
              onBlur={() => editingText === element.id && handleTextBlur(element.id)}
              onKeyDown={(e) => editingText === element.id && handleTextKeyDown(e, element.id)}
              className={cn(
                "text-xs text-gray-800 text-center leading-tight break-words whitespace-pre-wrap w-full",
                editingText === element.id && "outline-none ring-2 ring-primary/50 bg-white/50"
              )}
            >
              Texto personalizado
            </p>
            {isSelected && isEditMode && !editingText && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

        return isEditMode ? (
          <ContextMenu key={element.id}>
            <ContextMenuTrigger asChild>
              {textElement}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={copyElement}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={pasteElement} disabled={!clipboard}>
                <Clipboard className="mr-2 h-4 w-4" />
                Colar
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={duplicateElement}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicar
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => deleteElement(element.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : textElement;

      case 'image':
        return (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center overflow-hidden bg-gray-100")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
          >
            {element.src ? (
              <img
                src={element.src}
                alt="Content"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <Layout className="h-8 w-8 mb-2" />
                <span className="text-xs">Imagem</span>
              </div>
            )}
            {isSelected && isEditMode && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

      case 'news-title':
        const newsTitleElement = (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-2 overflow-hidden")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => handleTextClick(e, element.id)}
          >
            <h1
              ref={(el) => el && editableRefs.current.set(element.id, el)}
              contentEditable={editingText === element.id}
              suppressContentEditableWarning
              onBlur={() => editingText === element.id && handleTextBlur(element.id)}
              onKeyDown={(e) => editingText === element.id && handleTextKeyDown(e, element.id)}
              className={cn(
                "text-lg font-bold text-gray-900 text-center leading-tight w-full whitespace-pre-wrap break-words",
                editingText === element.id && "outline-none ring-2 ring-primary/50 bg-white/50"
              )}
            >
              {content.newsTitle || 'Título da Notícia'}
            </h1>
            {isSelected && isEditMode && !editingText && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

        return isEditMode ? (
          <ContextMenu key={element.id}>
            <ContextMenuTrigger asChild>
              {newsTitleElement}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={copyElement}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={pasteElement} disabled={!clipboard}>
                <Clipboard className="mr-2 h-4 w-4" />
                Colar
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={duplicateElement}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicar
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => deleteElement(element.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : newsTitleElement;

      case 'source-label':
        const sourceLabelElement = (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-start p-2")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            onClick={(e) => handleTextClick(e, element.id)}
          >
            <p
              ref={(el) => el && editableRefs.current.set(element.id, el)}
              contentEditable={editingText === element.id}
              suppressContentEditableWarning
              onBlur={() => editingText === element.id && handleTextBlur(element.id)}
              onKeyDown={(e) => editingText === element.id && handleTextKeyDown(e, element.id)}
              className={cn(
                "text-xs text-gray-600 leading-relaxed w-full whitespace-pre-wrap break-words",
                editingText === element.id && "outline-none ring-2 ring-primary/50 bg-white/50"
              )}
            >
              {content.sourceLabel || 'Fonte: Portal de Notícias'}
            </p>
            {isSelected && isEditMode && !editingText && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

        return isEditMode ? (
          <ContextMenu key={element.id}>
            <ContextMenuTrigger asChild>
              {sourceLabelElement}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={copyElement}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={pasteElement} disabled={!clipboard}>
                <Clipboard className="mr-2 h-4 w-4" />
                Colar
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={duplicateElement}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicar
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => deleteElement(element.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : sourceLabelElement;

      case 'card-text':
        return (
          <div
            key={element.id}
            style={style}
            className={cn(commonClasses, "flex items-center justify-center p-4")}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
          >
            <p className="text-base font-bold text-gray-900 text-center leading-tight break-words w-full">
              {content.cardText || 'Texto do card com mensagem principal'}
            </p>
            {isSelected && isEditMode && (
              <ResizeHandles
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const containerDimensions = ASPECT_RATIOS[currentAspectRatio as keyof typeof ASPECT_RATIOS];

  if (loading || !layout) {
    return (
      <Card className={cn("relative", className)}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", className)}>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="p-4 border-b bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Toggle pressed={isEditMode} onPressedChange={toggleEditMode}>
                <Edit3 className="h-4 w-4" />
                <span className="ml-2">{isEditMode ? 'Fechar e Salvar' : 'Editar Layout'}</span>
              </Toggle>

              {isEditMode && (
                <>
                  <Toggle pressed={layout.meta.snapToGrid} onPressedChange={(pressed) =>
                    setLayout(prev => prev ? ({ ...prev, meta: { ...prev.meta, snapToGrid: pressed } }) : prev)
                  }>
                    <Grid3X3 className="h-4 w-4" />
                  </Toggle>

                  <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0}>
                    <Undo2 className="h-4 w-4" />
                  </Button>

                  <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0}>
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={currentAspectRatio} onValueChange={setCurrentAspectRatio}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Element Tools - Always visible in edit mode */}
          {isEditMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setShowTemplateSelector(true)}>
                  <Layout className="h-4 w-4 mr-2" />
                  Carregar Template
                </Button>

                <Button variant="outline" size="sm" onClick={addTextElement}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Adicionar Texto
                </Button>

                {selectedElement && (
                  <span className="text-sm font-medium text-muted-foreground">
                    Elemento selecionado: {selectedElement}
                  </span>
                )}
              </div>

              {/* Fixed alignment and manipulation tools */}
              <div className="flex items-center gap-2 flex-wrap border-t pt-3">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('left')}
                    disabled={!selectedElement}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('center')}
                    disabled={!selectedElement}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('right')}
                    disabled={!selectedElement}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('top')}
                    disabled={!selectedElement}
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('middle')}
                    disabled={!selectedElement}
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedElement && alignElements('bottom')}
                    disabled={!selectedElement}
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedElement && toggleElement(selectedElement, 'locked')}
                  disabled={!selectedElement}
                >
                  {selectedElement && layout?.elements.find(el => el.id === selectedElement)?.locked ?
                    <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />
                  }
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedElement && changeZIndex(selectedElement, 'up')}
                  disabled={!selectedElement}
                >
                  <MoveUp className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedElement && changeZIndex(selectedElement, 'down')}
                  disabled={!selectedElement}
                >
                  <MoveDown className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedElement && deleteElement(selectedElement)}
                  disabled={!selectedElement}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="p-6 bg-gray-50 flex items-center justify-center relative">
          <div
            ref={containerRef}
            className="bg-white border-2 border-dashed border-gray-300 relative"
            style={{
              width: containerDimensions.width,
              height: containerDimensions.height
            }}
            onClick={handleCanvasClick}
          >
            {/* Grid overlay */}
            {isEditMode && layout.meta.snapToGrid && (
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #000 1px, transparent 1px),
                    linear-gradient(to bottom, #000 1px, transparent 1px)
                  `,
                  backgroundSize: `${layout.meta.gridSize}px ${layout.meta.gridSize}px`
                }}
              />
            )}

            {/* Render elements */}
            {layout && layout.elements.map(element => renderElement(element))}

            {/* Selection indicator */}
            {isEditMode && selectedElement && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Guide lines could be rendered here */}
              </div>
            )}
          </div>

          {/* Properties Panel */}
          {showPropertiesPanel && selectedElement && (
            <PropertiesPanel
              element={layout?.elements.find(el => el.id === selectedElement) || null}
              onUpdate={updateElementProperties}
              onClose={() => setShowPropertiesPanel(false)}
            />
          )}
        </div>

        {/* Info panel */}
        <div className="p-4 border-t bg-muted/30 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {isEditMode ? 'Modo de edição ativo' : 'Modo de visualização'}
            </span>
            <span>
              Formato: {currentAspectRatio} | {containerDimensions.width}×{containerDimensions.height}px
            </span>
          </div>
        </div>
      </CardContent>

      {/* Template Selector Dialog */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Selecione um Template de Wireframe</DialogTitle>
          </DialogHeader>
          <WireframeTemplateSelector onSelectTemplate={handleTemplateSelect} />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WireframeEditor;