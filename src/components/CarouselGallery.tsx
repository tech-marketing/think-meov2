import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarouselSlide {
  imageUrl: string;
  index: number;
}

interface CarouselGalleryProps {
  slides: CarouselSlide[];
  className?: string;
}

export const CarouselGallery = ({ slides, className }: CarouselGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!slides || slides.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Nenhuma imagem disponível</p>
        </CardContent>
      </Card>
    );
  }

  // Sort slides by index to ensure correct order
  const sortedSlides = [...slides].sort((a, b) => a.index - b.index);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : sortedSlides.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < sortedSlides.length - 1 ? prev + 1 : 0));
  };

  const currentSlide = sortedSlides[currentIndex];

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="font-semibold">Carrossel Gerado pela IA</h3>
        <p className="text-sm text-muted-foreground">
          {sortedSlides.length} {sortedSlides.length === 1 ? 'slide' : 'slides'} gerados
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Image Display */}
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-square max-w-2xl mx-auto">
          <img
            src={currentSlide.imageUrl}
            alt={`Slide ${currentIndex + 1}`}
            className="w-full h-full object-contain"
          />
          
          {/* Navigation Arrows */}
          {sortedSlides.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 shadow-lg"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 shadow-lg"
                onClick={handleNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Slide Indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-sm font-medium">
              {currentIndex + 1} / {sortedSlides.length}
            </span>
          </div>
        </div>

        {/* Thumbnail Navigation */}
        {sortedSlides.length > 1 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {sortedSlides.map((slide, index) => (
              <button
                key={slide.index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                  currentIndex === index
                    ? "border-primary scale-110"
                    : "border-border opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={slide.imageUrl}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
