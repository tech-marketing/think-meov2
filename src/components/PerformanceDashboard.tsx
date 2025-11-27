import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type PeriodOption = '7d' | '30d' | '90d';

interface PerformanceDashboardProps {
  projects: any[];
}

const periodLabels: Record<PeriodOption, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias'
};

export const PerformanceDashboard = ({ projects }: PerformanceDashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [visibleLines, setVisibleLines] = useState({
    projetos: true,
    materiais: false,
    aprovados: false
  });

  const handlePeriodChange = (period: PeriodOption) => {
    setIsLoading(true);
    setIsLoadingChart(true);
    setSelectedPeriod(period);
    setTimeout(() => {
      setIsLoading(false);
      setIsLoadingChart(false);
    }, 500);
  };

  const handleLegendClick = (dataKey: string) => {
    setVisibleLines(prev => ({
      ...prev,
      [dataKey]: !prev[dataKey]
    }));
  };

  const chartData = useMemo(() => {
    // Função auxiliar para gerar chave de data no timezone local
    const getLocalDateKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const data = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Inicializar contadores para cada dia
    const dailyData: { [key: string]: { projetos: number; materiais: number; aprovados: number } } = {};
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dateKey = getLocalDateKey(date);
      dailyData[dateKey] = { projetos: 0, materiais: 0, aprovados: 0 };
    }
    
    // Contar projetos e materiais criados em cada dia
    projects.forEach(project => {
      if (project.created_at) {
        const createdDate = new Date(project.created_at);
        const dateKey = getLocalDateKey(createdDate);
        
        if (dailyData[dateKey]) {
          dailyData[dateKey].projetos += 1;
        }
      }
      
      // Contar materiais criados em cada dia
      project.materials.forEach((material: any) => {
        if (material.created_at) {
          const materialDate = new Date(material.created_at);
          const matDateKey = getLocalDateKey(materialDate);
          
          if (dailyData[matDateKey]) {
            dailyData[matDateKey].materiais += 1;
            
            // Contar aprovados
            if (material.status === 'client_approval') {
              dailyData[matDateKey].aprovados += 1;
            }
          }
        }
      });
    });
    
  // Transformar em array para o gráfico
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const dateKey = getLocalDateKey(date);
    
    // Garantir que a chave existe antes de acessar
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = { projetos: 0, materiais: 0, aprovados: 0 };
    }
    
    const dateStr = selectedPeriod === '7d' 
      ? date.toLocaleDateString('pt-BR', { weekday: 'short' })
      : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    data.push({
      name: dateStr,
      projetos: dailyData[dateKey].projetos,
      materiais: dailyData[dateKey].materiais,
      aprovados: dailyData[dateKey].aprovados
    });
  }
    
    return data;
  }, [projects, selectedPeriod]);

  const chartHeight = selectedPeriod === '7d' ? 300 : selectedPeriod === '30d' ? 350 : 400;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-heading">
              Performance dos Projetos
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe a evolução dos seus projetos ao longo do tempo
            </p>
          </div>
          
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as PeriodOption[]).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(period)}
                className={`text-xs sm:text-sm transition-all ${
                  isLoading || isLoadingChart ? 'opacity-50' : 'hover:scale-105'
                }`}
              >
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {periodLabels[period]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              className="text-xs text-muted-foreground"
              angle={selectedPeriod === '7d' ? 0 : -45}
              textAnchor={selectedPeriod === '7d' ? 'middle' : 'end'}
              height={selectedPeriod === '7d' ? 30 : 60}
            />
            <YAxis className="text-xs text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend content={(props) => <CustomLegend {...props} onClick={handleLegendClick} visibleLines={visibleLines} />} />
            
            {visibleLines.projetos && (
              <Line 
                type="monotone" 
                dataKey="projetos" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Projetos"
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            )}
            {visibleLines.materiais && (
              <Line 
                type="monotone" 
                dataKey="materiais" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                name="Materiais"
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            )}
            {visibleLines.aprovados && (
              <Line 
                type="monotone" 
                dataKey="aprovados" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                name="Aprovados"
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

const CustomLegend = ({ onClick, visibleLines }: any) => {
  const allItems = [
    { dataKey: 'projetos', color: 'hsl(var(--primary))', label: 'Projetos' },
    { dataKey: 'materiais', color: 'hsl(var(--warning))', label: 'Materiais' },
    { dataKey: 'aprovados', color: 'hsl(var(--success))', label: 'Aprovados' }
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 mb-4">
      {allItems.map((item) => {
        const isVisible = visibleLines[item.dataKey];
        
        return (
          <button
            key={item.dataKey}
            onClick={() => onClick(item.dataKey)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:scale-105 cursor-pointer ${isVisible ? 'opacity-100 shadow-sm' : 'opacity-40'}`}
          >
            <div
              className={`w-8 h-1 rounded-full transition-all duration-200 ${isVisible ? 'scale-100' : 'scale-75 opacity-50'}`}
              style={{ backgroundColor: item.color }}
            />
            <span className={`text-sm transition-all ${isVisible ? 'font-semibold' : 'font-normal line-through'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
