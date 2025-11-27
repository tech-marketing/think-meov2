import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointer, Target, BarChart3, DollarSign, TrendingUp } from "lucide-react";

interface DashboardMetrics {
  total_impressions: number;
  total_reach: number;
  total_clicks: number;
  average_ctr: number;
  total_results: number;
  average_cpa: number;
  average_conversion_rate: number;
  average_frequency: number;
  average_roas: number;
  total_spend: number;
}

interface MetaAdsDashboardProps {
  metrics: DashboardMetrics | null;
  loading?: boolean;
}

export const MetaAdsDashboard: React.FC<MetaAdsDashboardProps> = ({ metrics, loading = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-6 sm:h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Nenhuma métrica disponível</p>
        </CardContent>
      </Card>
    );
  }

  const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const metricCards = [
    {
      title: "CTR Médio",
      value: `${metrics.average_ctr.toFixed(2)}%`,
      icon: BarChart3,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Total de Cliques",
      value: metrics.total_clicks.toLocaleString('pt-BR'),
      icon: MousePointer,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Impressões Totais",
      value: metrics.total_impressions.toLocaleString('pt-BR'),
      icon: Eye,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Resultados",
      value: metrics.total_results.toLocaleString('pt-BR'),
      icon: Target,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Investimento",
      value: brl(metrics.total_spend),
      icon: DollarSign,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "CPA Médio",
      value: brl(metrics.average_cpa),
      icon: DollarSign,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Alcance",
      value: metrics.total_reach.toLocaleString('pt-BR'),
      icon: TrendingUp,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    },
    {
      title: "Frequência",
      value: metrics.average_frequency.toFixed(1),
      icon: BarChart3,
      color: "text-purple-500",
      shadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((metric, index) => {
        if (!metric || !metric.icon) return null;
        const IconComponent = metric.icon;
        return (
          <Card key={index} className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium text-purple-600 font-montserrat ${metric.shadow}`}>{metric.title}</CardTitle>
              <IconComponent className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-montserrat" style={{ fontFamily: 'Montserrat', fontWeight: 800 }}>{metric.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};