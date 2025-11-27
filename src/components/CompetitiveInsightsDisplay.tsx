import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Eye, 
  Lightbulb, 
  Palette, 
  Type, 
  Layout, 
  Target,
  AlertCircle,
  Star
} from "lucide-react";

interface CompetitiveInsights {
  text_analysis?: {
    copy_trends?: string[];
    cta_patterns?: string[];
    messaging_gaps?: string[];
  };
  visual_analysis?: {
    color_trends?: string[];
    layout_patterns?: string[];
    typography_trends?: string[];
    cta_visual_patterns?: string[];
    design_gaps?: string[];
    visual_score?: string;
    visual_recommendations?: string[];
  };
  recommended_tests?: string[];
  // Formato antigo (compatibilidade)
  trends_identified?: string[];
  gaps_found?: string[];
}

interface CompetitiveInsightsDisplayProps {
  insights: CompetitiveInsights;
}

export const CompetitiveInsightsDisplay = ({ insights }: CompetitiveInsightsDisplayProps) => {
  if (!insights) return null;

  const hasTextAnalysis = insights.text_analysis && (
    insights.text_analysis.copy_trends?.length > 0 ||
    insights.text_analysis.cta_patterns?.length > 0 ||
    insights.text_analysis.messaging_gaps?.length > 0
  );

  const hasVisualAnalysis = insights.visual_analysis && (
    insights.visual_analysis.color_trends?.length > 0 ||
    insights.visual_analysis.layout_patterns?.length > 0 ||
    insights.visual_analysis.typography_trends?.length > 0
  );

  const hasLegacyFormat = insights.trends_identified || insights.gaps_found;

  if (!hasTextAnalysis && !hasVisualAnalysis && !hasLegacyFormat) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <CardTitle>Análise Competitiva</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Insights baseados na análise de concorrentes ativos no mercado
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Análise Textual */}
        {hasTextAnalysis && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Análise Textual</h4>
            </div>

            {insights.text_analysis?.copy_trends && insights.text_analysis.copy_trends.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Padrões de Copy</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.text_analysis.copy_trends.map((trend, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.text_analysis?.cta_patterns && insights.text_analysis.cta_patterns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Padrões de CTA</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.text_analysis.cta_patterns.map((pattern, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.text_analysis?.messaging_gaps && insights.text_analysis.messaging_gaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Gaps de Mensagem</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.text_analysis.messaging_gaps.map((gap, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {hasTextAnalysis && hasVisualAnalysis && <Separator />}

        {/* Análise Visual */}
        {hasVisualAnalysis && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Análise Visual</h4>
              </div>
              {insights.visual_analysis?.visual_score && (
                <Badge variant="outline" className="gap-1">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {insights.visual_analysis.visual_score}
                </Badge>
              )}
            </div>

            {insights.visual_analysis?.color_trends && insights.visual_analysis.color_trends.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-muted-foreground">Tendências de Cores</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.color_trends.map((trend, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.visual_analysis?.layout_patterns && insights.visual_analysis.layout_patterns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layout className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="text-xs font-medium text-muted-foreground">Padrões de Layout</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.layout_patterns.map((pattern, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-cyan-500 mt-1">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.visual_analysis?.typography_trends && insights.visual_analysis.typography_trends.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-muted-foreground">Tendências Tipográficas</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.typography_trends.map((trend, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-indigo-500 mt-1">•</span>
                      <span>{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.visual_analysis?.cta_visual_patterns && insights.visual_analysis.cta_visual_patterns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Padrões Visuais de CTA</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.cta_visual_patterns.map((pattern, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.visual_analysis?.design_gaps && insights.visual_analysis.design_gaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Gaps de Design</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.design_gaps.map((gap, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.visual_analysis?.visual_recommendations && insights.visual_analysis.visual_recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-medium text-muted-foreground">Recomendações Visuais</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.visual_analysis.visual_recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-yellow-500 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {(hasTextAnalysis || hasVisualAnalysis) && insights.recommended_tests && insights.recommended_tests.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Testes Recomendados</span>
              </div>
              <ul className="space-y-1.5 ml-6">
                {insights.recommended_tests.map((test, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="font-medium">{test}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Formato antigo (compatibilidade) */}
        {hasLegacyFormat && (
          <>
            {insights.trends_identified && insights.trends_identified.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Tendências Identificadas</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.trends_identified.map((trend, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.gaps_found && insights.gaps_found.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Gaps Encontrados</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {insights.gaps_found.map((gap, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
