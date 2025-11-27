import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MetaAdsDirectProvider } from "@/contexts/MetaAdsDirectContext";
import { CreativeComparison } from "@/components/CreativeComparison";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { MetaAccountConnection } from "@/components/MetaAccountConnection";
import { Brain, GitCompare, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MetaComparisonContent = () => {
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
      setSearchParams({});
    } else if (metaErrorParam) {
      toast.error(`Erro ao conectar: ${metaErrorParam}`);
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
            <h1 className="text-3xl font-bold font-montserrat">Histórico e Comparação</h1>
            <p className="text-muted-foreground font-montserrat">
              Compare e analise o histórico de criativos
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md">
            <MetaAccountConnection
              isConnected={false}
              onConnectionChange={() => window.location.reload()}
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
          <h1 className="text-3xl font-bold font-montserrat">Histórico e Comparação</h1>
          <p className="text-muted-foreground font-montserrat">
            Compare e analise o histórico de criativos
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
          onClick={() => navigate('/meta-analysis')}
          variant="outline"
          className="flex items-center gap-2 font-montserrat"
        >
          <Brain className="h-4 w-4" />
          Creative Analysis AI
        </Button>
        <Button
          variant="default"
          className="flex items-center gap-2 font-montserrat"
        >
          <GitCompare className="h-4 w-4" />
          Histórico e Comparação
        </Button>
      </div>

      {/* Content */}
      <CreativeComparison />
    </div>
  );
};

const MetaComparison = () => {
  return (
    <MetaAdsDirectProvider>
      <MetaComparisonContent />
    </MetaAdsDirectProvider>
  );
};

export default MetaComparison;
