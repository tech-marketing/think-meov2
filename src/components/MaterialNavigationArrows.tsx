import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MaterialNavigationArrowsProps {
  currentIndex: number;
  totalMaterials: number;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const MaterialNavigationArrows = ({ 
  currentIndex, 
  totalMaterials, 
  onNavigate 
}: MaterialNavigationArrowsProps) => {
  if (totalMaterials <= 1) return null;

  const hasPrevious = currentIndex < totalMaterials - 1;
  const hasNext = currentIndex > 0;

  return (
    <>
      {/* Seta Esquerda */}
      {hasPrevious && (
        <div className="fixed left-24 top-1/2 -translate-y-1/2 z-50 hidden md:block">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('next')}
            className="h-14 w-14 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 hover:scale-110 shadow-lg"
          >
            <ChevronLeft className="h-8 w-8 text-primary" />
          </Button>
        </div>
      )}

      {/* Seta Direita */}
      {hasNext && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden md:block">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('prev')}
            className="h-14 w-14 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 hover:scale-110 shadow-lg"
          >
            <ChevronRight className="h-8 w-8 text-primary" />
          </Button>
        </div>
      )}

      {/* Navegação Mobile */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('next')}
          disabled={!hasPrevious}
          className="h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 disabled:opacity-30 shadow-lg"
        >
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('prev')}
          disabled={!hasNext}
          className="h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 disabled:opacity-30 shadow-lg"
        >
          <ChevronRight className="h-6 w-6 text-primary" />
        </Button>
      </div>
    </>
  );
};
