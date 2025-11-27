import React from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandlesProps {
  onResize: (direction: string, deltaX: number, deltaY: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  onResize,
  onResizeStart,
  onResizeEnd,
}) => {
  const handleMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    onResizeStart();
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onResize(direction, deltaX, deltaY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleClass = "absolute w-3 h-3 bg-primary border-2 border-white rounded-full hover:scale-125 transition-transform z-50";

  return (
    <>
      {/* Corner handles */}
      <div
        className={cn(handleClass, "-top-1.5 -left-1.5 cursor-nwse-resize")}
        onMouseDown={handleMouseDown('nw')}
      />
      <div
        className={cn(handleClass, "-top-1.5 -right-1.5 cursor-nesw-resize")}
        onMouseDown={handleMouseDown('ne')}
      />
      <div
        className={cn(handleClass, "-bottom-1.5 -left-1.5 cursor-nesw-resize")}
        onMouseDown={handleMouseDown('sw')}
      />
      <div
        className={cn(handleClass, "-bottom-1.5 -right-1.5 cursor-nwse-resize")}
        onMouseDown={handleMouseDown('se')}
      />

      {/* Edge handles */}
      <div
        className={cn(handleClass, "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize")}
        onMouseDown={handleMouseDown('n')}
      />
      <div
        className={cn(handleClass, "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize")}
        onMouseDown={handleMouseDown('s')}
      />
      <div
        className={cn(handleClass, "top-1/2 -translate-y-1/2 -left-1.5 cursor-ew-resize")}
        onMouseDown={handleMouseDown('w')}
      />
      <div
        className={cn(handleClass, "top-1/2 -translate-y-1/2 -right-1.5 cursor-ew-resize")}
        onMouseDown={handleMouseDown('e')}
      />
    </>
  );
};
