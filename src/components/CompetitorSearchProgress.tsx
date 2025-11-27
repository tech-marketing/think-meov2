import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Loader2, Search, Database, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CompetitorSearchProgressProps {
  keyword: string;
  onComplete?: (adsCount: number) => void;
  onError?: (error: string) => void;
}

interface LoadingPhase {
  phase: 'initiating' | 'searching' | 'processing' | 'caching' | 'completed' | 'error';
  message: string;
  description: string;
  progress: number;
}

const getPhaseConfig = (phase: string): LoadingPhase => {
  const configs: Record<string, LoadingPhase> = {
    initiating: {
      phase: 'initiating',
      message: 'Iniciando busca competitiva',
      description: 'Preparando conexão com a Biblioteca de Anúncios do Facebook...',
      progress: 10
    },
    searching: {
      phase: 'searching',
      message: 'Buscando anúncios ativos',
      description: 'Se a palavra-chave de Análise Competitiva estiver sendo usada pela primeira vez, talvez demore um pouco para retornar o resultado, tudo isso para entregar a melhor análise para você!',
      progress: 40
    },
    processing: {
      phase: 'processing',
      message: 'Processando resultados',
      description: 'Extraindo copy, CTAs, formatos e elementos visuais dos anúncios...',
      progress: 70
    },
    caching: {
      phase: 'caching',
      message: 'Salvando dados',
      description: 'Armazenando anúncios para acesso rápido nas próximas consultas...',
      progress: 90
    },
    completed: {
      phase: 'completed',
      message: 'Busca concluída!',
      description: 'Anúncios competitivos carregados com sucesso.',
      progress: 100
    },
    error: {
      phase: 'error',
      message: 'Erro na busca',
      description: 'Não foi possível completar a busca. Tente novamente.',
      progress: 0
    }
  };
  return configs[phase] || configs.initiating;
};

const getIcon = (phase: string) => {
  switch (phase) {
    case 'initiating':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'searching':
      return <Search className="h-5 w-5 text-primary animate-pulse" />;
    case 'processing':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'caching':
      return <Database className="h-5 w-5 text-primary animate-pulse" />;
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  }
};

export const CompetitorSearchProgress: React.FC<CompetitorSearchProgressProps> = ({
  keyword,
  onComplete,
  onError
}) => {
  const [currentPhase, setCurrentPhase] = useState<LoadingPhase>(getPhaseConfig('initiating'));
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const startTime = Date.now();

    // Update elapsed time every second
    interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Poll search history for status updates
    const pollSearchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('competitor_search_history')
          .select('*')
          .eq('search_keyword', keyword.toLowerCase())
          .order('searched_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('Error polling search status:', error);
          return;
        }

        if (!data) return;

        const status = data.search_status;
        const totalAds = data.total_ads_found || 0;

        console.log(`📊 Search status: ${status}, total ads: ${totalAds}`);

        if (status === 'completed') {
          setCurrentPhase(getPhaseConfig('completed'));
          clearInterval(pollInterval);
          clearInterval(interval);
          clearTimeout(timeoutId);
          onComplete?.(totalAds);
        } else if (status === 'failed') {
          setCurrentPhase(getPhaseConfig('error'));
          clearInterval(pollInterval);
          clearInterval(interval);
          clearTimeout(timeoutId);
          onError?.(data.error_message || 'Erro desconhecido');
        } else if (status === 'processing') {
          // Update phase based on elapsed time
          if (elapsedTime < 15) {
            setCurrentPhase(getPhaseConfig('searching'));
          } else if (elapsedTime < 30) {
            setCurrentPhase(getPhaseConfig('processing'));
          } else {
            setCurrentPhase(getPhaseConfig('caching'));
          }
        }
      } catch (error) {
        console.error('Error in pollSearchStatus:', error);
      }
    };

    // Start polling immediately and then every 3 seconds
    pollSearchStatus();
    pollInterval = setInterval(pollSearchStatus, 3000);

    // Set timeout for 90 seconds (should match waitForFinish)
    timeoutId = setTimeout(() => {
      console.warn('⚠️ Search timeout reached');
      // Don't mark as error, just keep showing processing state
    }, 90000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [keyword, elapsedTime, onComplete, onError]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getIcon(currentPhase.phase)}
            <div>
              <h3 className="font-semibold text-lg">{currentPhase.message}</h3>
              <p className="text-sm text-muted-foreground">{currentPhase.description}</p>
            </div>
          </div>
          <div className="text-sm font-mono text-muted-foreground">
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={currentPhase.progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Buscando: "{keyword}"</span>
            <span>{currentPhase.progress}%</span>
          </div>
        </div>

        {/* Status indicator */}
        {currentPhase.phase === 'searching' && (
          <div className="text-xs text-muted-foreground italic">
            💡 Esta é a primeira busca para "{keyword}". Próximas consultas serão instantâneas.
          </div>
        )}
        
        {currentPhase.phase === 'completed' && (
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
            ✅ Dados salvos! Próximas consultas retornarão em &lt;1s
          </div>
        )}
      </div>
    </Card>
  );
};
