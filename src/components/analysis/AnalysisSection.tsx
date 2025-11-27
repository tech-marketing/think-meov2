import React from 'react';
import { 
  Palette, 
  Type, 
  TrendingUp, 
  Lightbulb, 
  Target, 
  FileText,
  Brain,
  Users,
  CheckCircle2
} from 'lucide-react';

interface AnalysisSectionProps {
  title: string;
  icon: string;
  content: string[];
  type: 'visual' | 'copy' | 'performance' | 'insights' | 'recommendations' | 'general';
}

const ICONS: Record<string, React.ReactNode> = {
  Palette: <Palette className="w-5 h-5" />,
  Type: <Type className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  Lightbulb: <Lightbulb className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  Brain: <Brain className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />
};

const SECTION_STYLES = {
  visual: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    icon: 'text-blue-500'
  },
  copy: {
    border: 'border-l-purple-500',
    bg: 'bg-purple-500/5',
    icon: 'text-purple-500'
  },
  performance: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-500/5',
    icon: 'text-orange-500'
  },
  insights: {
    border: 'border-l-green-500',
    bg: 'bg-green-500/5',
    icon: 'text-green-500'
  },
  recommendations: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    icon: 'text-amber-500'
  },
  general: {
    border: 'border-l-gray-500',
    bg: 'bg-gray-500/5',
    icon: 'text-gray-500'
  }
};

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  title,
  icon,
  content,
  type
}) => {
  const iconComponent = ICONS[icon] || ICONS.FileText;
  const styles = SECTION_STYLES[type];
  
  return (
    <div className={`border-l-4 ${styles.border} ${styles.bg} rounded-lg p-4 transition-all duration-300 hover:shadow-md flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={styles.icon}>
          {iconComponent}
        </div>
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <ul className="space-y-2 flex-1">
        {content.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
