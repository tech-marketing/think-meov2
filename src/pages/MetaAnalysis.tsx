import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MetaAdsDirectProvider } from "@/contexts/MetaAdsDirectContext";
import { MetaAnalysisDashboard } from "@/components/MetaAnalysisDashboard";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { MetaAccountConnection } from "@/components/MetaAccountConnection";
import { Brain, GitCompare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MetaAnalysisContent = () => {
  const { metaConnected, metaLoading, checkMetaConnection } = useMetaAdsDirect();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle OAuth callback query params
  useEffect(() => {
    const metaConnectedParam = searchParams.get('meta_connected');
    const metaErrorParam = searchParams.get('meta_error');

    if (metaConnectedParam === 'true') {
      toast.success("✅ Conta Meta conectada com sucesso!");
      checkMetaConnection();
      // Remove query param from URL
      setSearchParams({});
    } else if (metaErrorParam) {
      toast.error(`Erro ao conectar: ${metaErrorParam}`);
      // Remove query param from URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, checkMetaConnection]);

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Remove Meta token from profile
      const { error } = await supabase
        .from('profiles')
        .update({
          meta_access_token: null,
          meta_token_expires_at: null,
          meta_user_id: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success("Conta Meta desconectada");
      await checkMetaConnection();
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao desconectar conta Meta");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (metaLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Verificando conexão Meta...</p>
        </div>
      </div>
    );
  }

  if (!metaConnected) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-montserrat">Creative Analysis AI</h1>
            <p className="text-muted-foreground font-montserrat">
              Análise de criativos do Meta e geração de briefings
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md">
            <MetaAccountConnection
              isConnected={false}
              onConnectionChange={checkMetaConnection}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-montserrat">Creative Analysis AI</h1>
          <p className="text-muted-foreground font-montserrat">
            Análise de criativos do Meta e geração de briefings
          </p>
        </div>
        <Button
          onClick={handleDisconnect}
          variant="outline"
          disabled={isDisconnecting}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          {isDisconnecting ? "Desconectando..." : "Sair da Conta Meta"}
        </Button>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <Button
          variant="default"
          className="flex items-center gap-2 font-montserrat"
        >
          <Brain className="h-4 w-4" />
          Creative Analysis AI
        </Button>
        <Button
          onClick={() => navigate('/meta-comparison')}
          variant="outline"
          className="flex items-center gap-2 font-montserrat"
        >
          <GitCompare className="h-4 w-4" />
          Histórico e Comparação
        </Button>
      </div>

      {/* Content */}
      <MetaAnalysisDashboard />
    </div>
  );
};

const MetaAnalysis = () => {
  return (
    <MetaAdsDirectProvider>
      <MetaAnalysisContent />
    </MetaAdsDirectProvider>
  );
};

export default MetaAnalysis;
