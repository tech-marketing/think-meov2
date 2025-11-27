import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';

interface InsightCardProps {
  text: string;
  index: number;
}

export const InsightCard: React.FC<InsightCardProps> = ({ text, index }) => {
  return (
    <div className="relative p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg transition-all duration-300 hover:shadow-lg hover:border-green-500/50">
      <div className="flex items-start gap-3">
        <div className="relative">
          <Lightbulb className="w-6 h-6 text-green-500 flex-shrink-0" />
          <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
};
