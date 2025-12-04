import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FigmaOAuth = () => {
  const [status, setStatus] = useState("Concluindo autenticação com o Figma...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setStatus("Dados inválidos recebidos. Você pode fechar esta janela e tentar novamente.");
      return;
    }

    const finishAuth = async () => {
      try {
        const { error } = await supabase.functions.invoke("figma-import", {
          body: {
            action: "complete-auth",
            code,
            state,
          },
        });

        if (error) throw error;

        setStatus("Conta do Figma conectada com sucesso. Esta janela será fechada em instantes.");
        if (window.opener) {
          window.opener.postMessage({ type: "FIGMA_AUTH_SUCCESS" }, "*");
        }
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        console.error("Erro ao concluir OAuth do Figma:", err);
        setStatus("Não foi possível finalizar a autenticação. Feche esta janela e tente novamente.");
      }
    };

    finishAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-center p-6">
      <div className="max-w-md space-y-3">
        <p className="text-lg font-semibold">Autenticando com o Figma...</p>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default FigmaOAuth;
