import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Download, Activity, TrendingUp, Layers, CheckCircle, Loader2 } from 'lucide-react';

export interface LoadingPhase {
  phase: 'idle' | 'fetching-ads' | 'processing-metrics' | 'calculating' | 'enriching-taxonomy' | 'finalizing' | 'complete' 
    | 'resolving-images' | 'categorizing-creatives' | 'analyzing-ai' | 'generating-insights';
  message: string;
  description: string;
  progress: number;
}

interface ProgressLoaderProps {
  status: LoadingPhase;
  className?: string;
}

const getIcon = (phase: LoadingPhase['phase']) => {
  const iconClass = "h-6 w-6 animate-pulse";
  
  switch (phase) {
    case 'fetching-ads':
      return <Download className={iconClass} />;
    case 'processing-metrics':
      return <Activity className={iconClass} />;
    case 'calculating':
      return <TrendingUp className={iconClass} />;
    case 'enriching-taxonomy':
      return <Layers className={iconClass} />;
    case 'resolving-images':
      return <Download className={iconClass} />;
    case 'categorizing-creatives':
      return <Layers className={iconClass} />;
    case 'analyzing-ai':
      return <Activity className={iconClass} />;
    case 'generating-insights':
      return <TrendingUp className={iconClass} />;
    case 'finalizing':
    case 'complete':
      return <CheckCircle className={iconClass} />;
    default:
      return <Loader2 className={`${iconClass} animate-spin`} />;
  }
};

const getColorClasses = (progress: number) => {
  if (progress < 30) return 'text-blue-500';
  if (progress < 60) return 'text-purple-500';
  if (progress < 85) return 'text-indigo-500';
  return 'text-green-500';
};

export const ProgressLoader: React.FC<ProgressLoaderProps> = ({ status, className = '' }) => {
  const colorClass = getColorClasses(status.progress);
  
  return (
    <div className={`flex flex-col items-center justify-center space-y-4 py-8 ${className}`}>
      <div className={`${colorClass} transition-colors duration-500`}>
        {getIcon(status.phase)}
      </div>
      
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-lg font-semibold animate-fade-in">
          {status.message}
        </h3>
        <p className="text-sm text-muted-foreground animate-fade-in">
          {status.description}
        </p>
      </div>
      
      <div className="w-full max-w-md space-y-2">
        <Progress 
          value={status.progress} 
          className="h-2 transition-all duration-500"
        />
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Progresso</span>
          <span className="font-medium">{status.progress}%</span>
        </div>
      </div>
    </div>
  );
};
