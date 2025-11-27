import React from 'react';
import { CheckCircle2, Palette, Type, TrendingUp, Lightbulb, Target, Brain, Users, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface AnalysisTextSectionProps {
  title: string;
  icon: string;
  content: string[];
  type: 'visual' | 'copy' | 'performance' | 'insights' | 'recommendations' | 'general';
  showCheckIcons?: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  Palette: <Palette className="w-5 h-5" />,
  Type: <Type className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  Lightbulb: <Lightbulb className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  Brain: <Brain className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />
};

const TYPE_COLORS = {
  visual: 'text-blue-500',
  copy: 'text-purple-500',
  performance: 'text-orange-500',
  insights: 'text-green-500',
  recommendations: 'text-amber-500',
  general: 'text-muted-foreground'
};

export const AnalysisTextSection: React.FC<AnalysisTextSectionProps> = ({
  title,
  icon,
  content,
  type,
  showCheckIcons = true
}) => {
  const iconComponent = ICONS[icon] || ICONS.FileText;
  const colorClass = TYPE_COLORS[type];
  
  return (
    <div className="space-y-4">
      {/* Título da Seção com Ícone */}
      <div className="flex items-center gap-2">
        <div className={colorClass}>
          {iconComponent}
        </div>
        <h4 className="font-semibold text-lg text-foreground">{title}</h4>
      </div>
      
      {/* Lista de Itens */}
      <ul className={`space-y-3 ${showCheckIcons ? 'ml-7' : ''}`}>
        {content.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            {showCheckIcons && (
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
            )}
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
