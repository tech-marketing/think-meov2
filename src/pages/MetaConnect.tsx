import { MetaAccountConnection } from "@/components/MetaAccountConnection";
import { useMetaAdsDirect } from "@/contexts/MetaAdsDirectContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Zap } from "lucide-react";

const MetaConnect = () => {
  const { metaConnected, checkMetaConnection } = useMetaAdsDirect();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-montserrat">Conectar Conta Meta</h1>
          <p className="text-muted-foreground mt-2">
            Conecte sua conta Meta (Facebook) para acessar dados de anúncios e campanhas
          </p>
        </div>

        <MetaAccountConnection
          isConnected={metaConnected}
          onConnectionChange={checkMetaConnection}
        />

        {!metaConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Por que conectar?
              </CardTitle>
              <CardDescription>
                Veja o que você pode fazer após conectar sua conta Meta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Acessar todas as suas contas de anúncios do Meta",
                  "Visualizar campanhas e anúncios em tempo real",
                  "Analisar métricas de desempenho detalhadas",
                  "Gerar briefings inteligentes com IA",
                  "Comparar criativos e otimizar resultados"
                ].map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MetaConnect;
