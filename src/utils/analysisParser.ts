export interface ParsedAnalysis {
  summary: string;
  sections: Array<{
    title: string;
    icon: string;
    content: string[];
    type: 'visual' | 'copy' | 'performance' | 'insights' | 'recommendations' | 'general';
    subtopics?: Array<{
      title: string;
      content: string[];
    }>;
  }>;
  metrics: Array<{
    label: string;
    value: number;
    benchmark?: number;
    unit: string;
  }>;
  colors: string[];
  keyInsights: string[];
  type?: 'performance' | 'market_trends' | 'general';
}

export function parseAnalysisText(text: string): ParsedAnalysis {
  const lines = text.split('\n').filter(line => line.trim());
  const sections: ParsedAnalysis['sections'] = [];
  const colors: string[] = [];
  const keyInsights: string[] = [];
  let currentSection: ParsedAnalysis['sections'][0] | null = null;
  let currentSubtopic: { title: string; content: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detectar títulos de seções principais (**Título:** ou **Título**)
    const titleMatch = line.match(/^\*\*(.+?)(?::\*\*|\*\*)$/);
    if (titleMatch) {
      // Se havia uma seção anterior, salvar
      if (currentSection) {
        if (currentSubtopic) {
          currentSection.subtopics?.push(currentSubtopic);
          currentSubtopic = null;
        }
        // Só adicionar seções com conteúdo real
        if (currentSection.content.length > 0 || (currentSection.subtopics && currentSection.subtopics.length > 0)) {
          sections.push(currentSection);
        }
      }

      const title = titleMatch[1].trim();
      
      // Ignorar seções de ações/recomendações (já aparecem em outras seções)
      if (title.toLowerCase().includes('acionáveis') || 
          title.toLowerCase().includes('actionable') ||
          title.toLowerCase().includes('próximos passos') ||
          title.toLowerCase().includes('next steps')) {
        currentSection = null;
        continue;
      }

      currentSection = {
        title,
        icon: getIconForTitle(title),
        content: [],
        type: getTypeForTitle(title),
        subtopics: []
      };
      continue;
    }

    // Detectar subtópicos (- **Subtópico:** ou **Subtópico:**)
    const subtopicMatch = line.match(/^-?\s*\*\*(.+?):\*\*$/);
    if (subtopicMatch && currentSection) {
      if (currentSubtopic) {
        currentSection.subtopics?.push(currentSubtopic);
      }
      currentSubtopic = {
        title: subtopicMatch[1].trim(),
        content: []
      };
      continue;
    }

    // Detectar itens de lista (- item ou • item)
    const listMatch = line.match(/^[-•]\s*(.+)$/);
    if (listMatch) {
      const content = listMatch[1].trim();
      
      // Detectar cores hex
      const hexMatches = content.match(/#[0-9A-Fa-f]{6}/g);
      if (hexMatches) {
        colors.push(...hexMatches);
      }

      if (currentSubtopic) {
        currentSubtopic.content.push(content);
      } else if (currentSection) {
        currentSection.content.push(content);
      } else {
        keyInsights.push(content);
      }
      continue;
    }

    // Detectar cores hex no texto
    const hexMatches = line.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches) {
      colors.push(...hexMatches);
    }

    // Se não é título, subtópico ou lista, adicionar ao conteúdo
    if (line && !line.startsWith('**') && !line.startsWith('#')) {
      if (currentSubtopic) {
        currentSubtopic.content.push(line);
      } else if (currentSection) {
        currentSection.content.push(line);
      } else {
        keyInsights.push(line);
      }
    }
  }

  // Adicionar última seção
  if (currentSection) {
    if (currentSubtopic) {
      currentSection.subtopics?.push(currentSubtopic);
    }
    // Só adicionar seções com conteúdo real
    if (currentSection.content.length > 0 || (currentSection.subtopics && currentSection.subtopics.length > 0)) {
      sections.push(currentSection);
    }
  }

  // Criar resumo dos primeiros insights
  const summary = keyInsights.slice(0, 3).join(' ') || 'Análise detalhada de criativo';

  return {
    summary,
    sections,
    metrics: [],
    colors: [...new Set(colors)], // Remove duplicatas
    keyInsights,
    type: 'general'
  };
}

function getIconForTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.match(/visual|composição|design|layout|imagem|cor|paleta/)) return 'Palette';
  if (lower.match(/copy|texto|mensagem|headline|cta|call.*action/)) return 'Type';
  if (lower.match(/performance|resultado|métrica|conversão|roi|ctr/)) return 'TrendingUp';
  if (lower.match(/insight|análise|observação/)) return 'Lightbulb';
  if (lower.match(/recomend|sugest|próximo|ação|otimiz/)) return 'Target';
  if (lower.match(/estratég|abordagem|conceito/)) return 'Brain';
  if (lower.match(/público|audiência|persona/)) return 'Users';
  return 'FileText';
}

function getTypeForTitle(title: string): ParsedAnalysis['sections'][0]['type'] {
  const lower = title.toLowerCase();
  if (lower.match(/visual|composição|design|layout|imagem|cor/)) return 'visual';
  if (lower.match(/copy|texto|mensagem|headline|cta/)) return 'copy';
  if (lower.match(/performance|resultado|métrica|conversão/)) return 'performance';
  if (lower.match(/insight|análise|observação/)) return 'insights';
  if (lower.match(/recomend|sugest|próximo|ação|otimiz/)) return 'recommendations';
  return 'general';
}
