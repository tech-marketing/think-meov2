import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Play, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialFile {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
}

interface MaterialCarouselProps {
  files: MaterialFile[];
  className?: string;
}

export const MaterialCarousel = ({ files, className }: MaterialCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!files || files.length === 0) {
    return (
      <div className={cn("w-full h-96 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-muted", className)}>
        <div className="text-center space-y-4">
          <div className="text-5xl opacity-50">📁</div>
          <p className="text-muted-foreground">Nenhum arquivo disponível</p>
        </div>
      </div>
    );
  }

  const currentFile = files[currentIndex];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % files.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + files.length) % files.length);
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileContent = () => {
    switch (currentFile.type) {
      case 'image':
        return (
          <img 
            src={currentFile.url} 
            alt={currentFile.name}
            className="w-full h-full object-contain"
          />
        );
      case 'video':
        return (
          <video 
            src={currentFile.url} 
            controls 
            className="w-full h-full"
            preload="metadata"
          >
            Seu navegador não suporta vídeo.
          </video>
        );
      case 'pdf':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">{currentFile.name}</p>
              <p className="text-sm text-muted-foreground">Arquivo PDF</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => downloadFile(currentFile.url, currentFile.name)}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => window.open(currentFile.url, '_blank')}>
                Visualizar
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl">❓</div>
              <p className="font-medium text-muted-foreground">Formato não suportado</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Card>
        <CardContent className="p-0">
          <div className="relative w-full h-96 overflow-hidden rounded-lg">
            {/* Conteúdo do arquivo */}
            <div className="w-full h-full transition-all duration-300 ease-in-out">
              {renderFileContent()}
            </div>

            {/* Controles de navegação - apenas se houver mais de um arquivo */}
            {files.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                  onClick={prevSlide}
                  disabled={files.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                  onClick={nextSlide}
                  disabled={files.length <= 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Indicadores de posição */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {files.map((_, index) => (
                    <button
                      key={index}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-200",
                        index === currentIndex 
                          ? "bg-primary" 
                          : "bg-primary/30 hover:bg-primary/50"
                      )}
                      onClick={() => setCurrentIndex(index)}
                    />
                  ))}
                </div>

                {/* Contador */}
                <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  {currentIndex + 1} / {files.length}
                </div>
              </>
            )}

            {/* Nome do arquivo */}
            <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-lg max-w-[60%]">
              <p className="text-sm font-medium truncate">{currentFile.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};