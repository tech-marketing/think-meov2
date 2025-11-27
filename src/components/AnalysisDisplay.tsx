import React, { useMemo, useState } from 'react';
import { parseAnalysisText } from '@/utils/analysisParser';
import { ColorPalette } from '@/components/analysis/ColorPalette';
import { TransitionPanel } from '@/components/ui/transition-panel';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import useMeasure from 'react-use-measure';
import { 
  Palette, 
  Type, 
  TrendingUp, 
  Lightbulb, 
  Target, 
  Brain, 
  Users, 
  FileText 
} from 'lucide-react';

interface AnalysisDisplayProps {
  analysis: string;
  compact?: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  Palette: <Palette className="w-6 h-6" />,
  Type: <Type className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  Lightbulb: <Lightbulb className="w-6 h-6" />,
  Target: <Target className="w-6 h-6" />,
  Brain: <Brain className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  FileText: <FileText className="w-6 h-6" />
};

const TYPE_COLORS: Record<string, string> = {
  visual: 'text-blue-500',
  copy: 'text-purple-500',
  performance: 'text-orange-500',
  insights: 'text-green-500',
  recommendations: 'text-amber-500',
  general: 'text-primary'
};

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({
  analysis,
  compact = false
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [ref, bounds] = useMeasure();

  const parsed = useMemo(() => {
    const result = parseAnalysisText(analysis);

    // Detectar estrutura do PRIMEIRO PROMPT (Performance)
    if (analysis.includes('**Diagnóstico:**') || analysis.includes('**Elementos críticos:**')) {
      return {
        ...result,
        type: 'performance'
      };
    }

    // Detectar estrutura do SEGUNDO PROMPT (Market Trends)
    if (analysis.includes('**Padrão dominante:**') || analysis.includes('**Diferenciais menos explorados:**')) {
      return {
        ...result,
        type: 'market_trends'
      };
    }
    return result;
  }, [analysis]);

  const getBadgeText = () => {
    if (parsed.type === 'performance') return 'Análise aprofundada do anúncio';
    if (parsed.type === 'market_trends') return 'Análise de tendências de mercado';
    return 'AI Insights';
  };

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

  // Todas as seções são navegáveis agora
  const navigableSections = parsed.sections;

  // Criar slides: Colors (se houver) + Seções
  const slides: React.ReactNode[] = [];

  // Slide 1: Paleta de Cores (se houver)
  if (parsed.colors.length > 0) {
    slides.push(
      <div className="p-6 min-h-[280px] flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Palette className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Paleta de Cores</h3>
        </div>
        <ColorPalette colors={parsed.colors} />
      </div>
    );
  }

  // Slides: Cada Seção de Análise (com quebra automática a cada 500 caracteres)
  navigableSections.forEach((section, idx) => {
    const iconComponent = ICONS[section.icon] || ICONS.FileText;
    const colorClass = TYPE_COLORS[section.type];

    // Função para calcular o tamanho do conteúdo em caracteres
    const calculateContentSize = (items: string[]) => {
      return items.reduce((total, item) => total + item.length, 0);
    };

    // Se tem subtópicos
    if (section.subtopics && section.subtopics.length > 0) {
      let currentSlideContent: typeof section.subtopics = [];
      let currentSize = 0;
      let partNumber = 1;

      section.subtopics.forEach((subtopic, subIdx) => {
        const subtopicSize = subtopic.title.length + calculateContentSize(subtopic.content);
        
        // Se adicionar este subtópico ultrapassa 500 caracteres, criar um novo slide
        if (currentSize + subtopicSize > 500 && currentSlideContent.length > 0) {
          // Criar slide com o conteúdo atual
          slides.push(
            <div className="p-6 min-h-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("p-1.5 rounded-lg", `${colorClass.replace('text-', 'bg-')}/10`)}>
                  <div className={colorClass}>
                    {iconComponent}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {section.title} {partNumber > 1 ? `(Parte ${partNumber})` : ''}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dimensão {idx + 1} de {navigableSections.length}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {currentSlideContent.map((subtopic, subIdx) => (
                  <div key={subIdx} className="rounded-lg border border-border bg-card/50 p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2">
                      {subtopic.title}
                    </h4>
                    <ul className="space-y-1.5">
                      {subtopic.content.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
          
          // Resetar para o próximo slide
          currentSlideContent = [subtopic];
          currentSize = subtopicSize;
          partNumber++;
        } else {
          // Adicionar ao slide atual
          currentSlideContent.push(subtopic);
          currentSize += subtopicSize;
        }
      });

      // Adicionar o último slide se houver conteúdo restante
      if (currentSlideContent.length > 0) {
        slides.push(
          <div className="p-6 min-h-[280px]">
            <div className="flex items-center gap-2 mb-4">
              <div className={cn("p-1.5 rounded-lg", `${colorClass.replace('text-', 'bg-')}/10`)}>
                <div className={colorClass}>
                  {iconComponent}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">
                  {section.title} {partNumber > 1 ? `(Parte ${partNumber})` : ''}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dimensão {idx + 1} de {navigableSections.length}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {currentSlideContent.map((subtopic, subIdx) => (
                <div key={subIdx} className="rounded-lg border border-border bg-card/50 p-3">
                  <h4 className="font-semibold text-sm text-foreground mb-2">
                    {subtopic.title}
                  </h4>
                  <ul className="space-y-1.5">
                    {subtopic.content.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      }
    } else {
      // Se não tem subtópicos, dividir o conteúdo direto
      let currentSlideContent: string[] = [];
      let currentSize = 0;
      let partNumber = 1;

      section.content.forEach((item, itemIdx) => {
        const itemSize = item.length;
        
        // Se adicionar este item ultrapassa 500 caracteres, criar um novo slide
        if (currentSize + itemSize > 500 && currentSlideContent.length > 0) {
          // Criar slide com o conteúdo atual
          slides.push(
            <div className="p-6 min-h-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("p-1.5 rounded-lg", `${colorClass.replace('text-', 'bg-')}/10`)}>
                  <div className={colorClass}>
                    {iconComponent}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {section.title} {partNumber > 1 ? `(Parte ${partNumber})` : ''}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dimensão {idx + 1} de {navigableSections.length}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {currentSlideContent.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-foreground leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
          
          // Resetar para o próximo slide
          currentSlideContent = [item];
          currentSize = itemSize;
          partNumber++;
        } else {
          // Adicionar ao slide atual
          currentSlideContent.push(item);
          currentSize += itemSize;
        }
      });

      // Adicionar o último slide se houver conteúdo restante
      if (currentSlideContent.length > 0) {
        slides.push(
          <div className="p-6 min-h-[280px]">
            <div className="flex items-center gap-2 mb-4">
              <div className={cn("p-1.5 rounded-lg", `${colorClass.replace('text-', 'bg-')}/10`)}>
                <div className={colorClass}>
                  {iconComponent}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">
                  {section.title} {partNumber > 1 ? `(Parte ${partNumber})` : ''}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dimensão {idx + 1} de {navigableSections.length}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {currentSlideContent.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
  });

  return (
    <div className="space-y-4 w-full">
      {/* Card Principal com Navegação Integrada */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <TransitionPanel
          activeIndex={activeIndex}
          variants={variants}
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          custom={direction}
        >
          {slides.map((slide, index) => (
            <div key={index} ref={ref}>
              {slide}
            </div>
          ))}
        </TransitionPanel>

        {/* Navegação */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30">
          <Button
            onClick={() => handleSetActiveIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 min-w-[100px]",
              activeIndex === 0 && "invisible"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Anterior
          </Button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSetActiveIndex(idx)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    idx === activeIndex
                      ? "w-6 bg-primary"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {activeIndex + 1} de {slides.length}
            </span>
          </div>

          <Button
            onClick={() => handleSetActiveIndex(activeIndex + 1)}
            disabled={activeIndex === slides.length - 1}
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 min-w-[100px]",
              activeIndex === slides.length - 1 && "invisible"
            )}
          >
            Próximo
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};