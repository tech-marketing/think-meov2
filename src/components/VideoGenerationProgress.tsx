import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { LumaSpin } from '@/components/ui/luma-spin';
import { Progress } from '@/components/ui/progress';
interface VideoGenerationProgressProps {
  materialId: string;
  projectId: string;
}
export const VideoGenerationProgress = ({
  materialId,
  projectId
}: VideoGenerationProgressProps) => {
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [progress, setProgress] = useState(0);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let progressIntervalId: NodeJS.Timeout;
    let timeElapsed = 0;
    const checkStatus = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('check-video-status', {
          body: {
            materialId
          }
        });
        if (error) throw error;
        if (data.status === 'completed') {
          setStatus('completed');
          clearInterval(intervalId);
          clearInterval(progressIntervalId);
          toast({
            title: "Vídeo gerado com sucesso!",
            description: "Seu vídeo está pronto para visualização."
          });

          // Recarregar a página para mostrar o vídeo
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (data.status === 'failed') {
          setStatus('failed');
          clearInterval(intervalId);
          clearInterval(progressIntervalId);
          toast({
            title: "Erro ao gerar vídeo",
            description: data.error || "Ocorreu um erro durante a geração.",
            variant: "destructive"
          });
        }
      } catch (err) {
        console.error('Error checking video status:', err);
      }
    };

    // Simular progresso (estimativa de 2-5 minutos)
    progressIntervalId = setInterval(() => {
      timeElapsed += 5;
      // Progresso logarítmico que nunca chega a 100%
      const estimatedProgress = Math.min(95, Math.log(timeElapsed + 1) / Math.log(300) * 100);
      setProgress(estimatedProgress);
    }, 5000);

    // Verificar status a cada 10 segundos
    intervalId = setInterval(checkStatus, 10000);

    // Verificar imediatamente
    checkStatus();
    return () => {
      clearInterval(intervalId);
      clearInterval(progressIntervalId);
    };
  }, [materialId, toast, navigate]);

  // Mensagens dinâmicas baseadas no progresso
  const getStatusMessage = () => {
    if (status === 'completed') return 'Vídeo pronto!';
    if (status === 'failed') return 'Erro na geração';
    if (progress < 30) return 'Analisando anúncio e criando storyboard...';
    if (progress < 60) return 'Gerando vídeo com IA (Google Veo 3.1)...';
    if (progress < 90) return 'Quase pronto! Finalizando processamento...';
    return 'Últimos ajustes...';
  };
  const getStatusDescription = () => {
    if (status === 'completed') return 'Recarregando para visualização...';
    if (status === 'failed') return 'Por favor, tente novamente.';
    return 'Isso pode levar de 2 a 5 minutos. Por favor, aguarde.';
  };
  return <div className="flex flex-col items-center justify-center min-h-[500px] gap-8 p-8">
      {/* Luma Spin Loading */}
      <div className="relative flex flex-col items-center gap-4">
        <LumaSpin />
        {status === 'processing' && <div className="flex items-center gap-2 text-primary">
            <Video className="h-5 w-5 animate-pulse" />
          </div>}
      </div>
      
      {/* Status Message */}
      <div className="text-center space-y-3 max-w-md">
        <h3 className="text-2xl font-semibold text-foreground">
          {getStatusMessage()}
        </h3>
        
        <p className="text-base text-muted-foreground">
          {getStatusDescription()}
        </p>
      </div>
      
      {/* Progress Bar */}
      {status === 'processing' && <div className="w-full max-w-md space-y-3">
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-muted-foreground">
              Progresso estimado
            </p>
            <p className="text-sm font-bold text-primary">
              {Math.round(progress)}%
            </p>
          </div>
        </div>}
      
      {/* Tips */}
      <div className="text-sm text-muted-foreground text-center max-w-md space-y-2 pt-4 border-t border-border/50">
        <div className="flex items-center justify-center gap-2">
          
          
        </div>
        
      </div>
    </div>;
};