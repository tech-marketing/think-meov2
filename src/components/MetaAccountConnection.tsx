import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MetaAccountConnectionProps {
  isConnected: boolean;
  metaUserName?: string;
  onConnectionChange: () => void;
}

export const MetaAccountConnection = ({
  isConnected,
  metaUserName,
  onConnectionChange,
}: MetaAccountConnectionProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      // Chama edge function para iniciar OAuth
      const { data, error } = await supabase.functions.invoke('meta-oauth-init');

      if (error) throw error;

      if (data?.oauth_url) {
        // Redireciona para o Facebook OAuth
        window.location.href = data.oauth_url;
      } else {
        throw new Error('URL de OAuth não recebida');
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error(error.message || "Erro ao conectar com Meta");
      setIsConnecting(false);
    }
  };

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
      onConnectionChange();
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao desconectar conta Meta");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          Conta Meta (Facebook)
        </CardTitle>
        <CardDescription>
          {isConnected
            ? "Sua conta Meta está conectada e pronta para uso"
            : "Conecte sua conta Meta para acessar dados de anúncios"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {metaUserName && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Conectado como: <strong>{metaUserName}</strong>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleDisconnect}
                variant="outline"
                disabled={isDisconnecting}
              >
                {isDisconnecting ? "Desconectando..." : "Desconectar"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Para usar o Creative Analysis AI, você precisa conectar sua conta Meta.
                Você será redirecionado para o Facebook para autorizar o acesso.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isConnecting ? "Conectando..." : "Conectar com Meta"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
