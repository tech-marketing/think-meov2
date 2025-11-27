import React, { useState } from 'react';
import { TransitionPanel } from '@/components/ui/transition-panel';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useMeasure from 'react-use-measure';
import { cn } from '@/lib/utils';

interface AnalysisSectionWithSubtopicsProps {
  subtopics: Array<{
    title: string;
    content: string[];
  }>;
}

export const AnalysisSectionWithSubtopics: React.FC<AnalysisSectionWithSubtopicsProps> = ({
  subtopics
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [ref, bounds] = useMeasure();

  const handleSetActiveIndex = (newIndex: number) => {
    setDirection(newIndex > activeIndex ? 1 : -1);
    setActiveIndex(newIndex);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 400 : -400,
      opacity: 0,
      height: bounds.height > 0 ? bounds.height : "auto",
      position: "initial" as const,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      height: bounds.height > 0 ? bounds.height : "auto",
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 400 : -400,
      opacity: 0,
      position: "absolute" as const,
      top: 0,
      width: "100%",
    }),
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <TransitionPanel
        activeIndex={activeIndex}
        variants={variants}
        transition={{
          x: { type: "spring", stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        }}
        custom={direction}
      >
        {subtopics.map((subtopic, index) => (
          <div key={index} className="px-6 pt-6" ref={ref}>
            <h5 className="mb-3 font-semibold text-base text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              {subtopic.title}
            </h5>
            <ul className="space-y-2 ml-8">
              {subtopic.content.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </TransitionPanel>
      
      <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/30">
        <Button
          onClick={() => handleSetActiveIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          variant="outline"
          size="sm"
          className={cn(
            "gap-1",
            activeIndex === 0 && "invisible"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>
        
        <div className="flex items-center gap-1">
          {subtopics.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleSetActiveIndex(idx)}
              className={cn(
                "h-2 rounded-full transition-all",
                idx === activeIndex 
                  ? "w-8 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Ir para ${subtopics[idx].title}`}
            />
          ))}
        </div>

        <Button
          onClick={() => handleSetActiveIndex(activeIndex + 1)}
          disabled={activeIndex === subtopics.length - 1}
          variant="outline"
          size="sm"
          className={cn(
            "gap-1",
            activeIndex === subtopics.length - 1 && "invisible"
          )}
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
