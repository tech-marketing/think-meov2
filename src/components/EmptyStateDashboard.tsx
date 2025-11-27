import { Inbox, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface EmptyStateDashboardProps {
  onCreateProject: () => void;
}

export const EmptyStateDashboard = ({ onCreateProject }: EmptyStateDashboardProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
        <Inbox size={64} className="relative text-muted-foreground opacity-50" />
      </div>
      
      <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-2">
        Nenhum dado disponível
      </h3>
      
      <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md mb-8">
        Conecte sua conta Meta Ads ou crie seu primeiro projeto para começar a acompanhar suas métricas
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => navigate('/meta-analysis')}
          variant="outline"
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Conectar Meta Ads
        </Button>
        
        <Button
          onClick={onCreateProject}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Criar Primeiro Projeto
        </Button>
      </div>
    </div>
  );
};
