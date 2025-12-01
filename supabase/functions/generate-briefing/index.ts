import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id, id, role')
      .eq('user_id', user.id)
      .single();

    // Parse do corpo da requisição PRIMEIRO
    const {
      adId,
      accountId,
      projectId,
      creativeAnalysis,
      adName,
      materialCaption,
      materialFileUrl,
      competitorAds,
      simpleOutput = false,
      targetFormat = 'static', // Formato do criativo: 'static', 'carousel', 'video'
      materialId: providedMaterialId // ID do material já criado (opcional)
    } = await req.json();

    console.log('🔧 Dados recebidos:', {
      adId,
      accountId: accountId ? 'Present' : 'Missing',
      projectId: projectId ? 'Present' : 'Missing',
      creativeAnalysis: creativeAnalysis ? 'Present' : 'Missing',
      adName,
      materialCaption: materialCaption ? 'Present' : 'Missing',
      materialFileUrl: materialFileUrl ? 'Present' : 'Missing',
      simpleOutput,
      targetFormat,
      userRole: profile?.role,
      userCompanyId: profile?.company_id
    });

    // Log de dados competitivos
    console.log(`🏆 Dados competitivos recebidos: ${competitorAds?.length || 0} anúncios`);

    // Coletar URLs das imagens dos concorrentes para análise visual E criar mapeamento URL -> page_name
    const competitorImages: string[] = [];
    const competitorImageMapping: Array<{ url: string; page_name: string }> = [];

    if (competitorAds && competitorAds.length > 0) {
      console.log('✅ Análise competitiva ATIVA - briefing incluirá insights competitivos');

      for (const ad of competitorAds.slice(0, 5)) { // TOP 5 concorrentes
        try {
          if (ad.image_urls) {
            const urls = JSON.parse(ad.image_urls);
            if (urls && urls.length > 0 && urls[0]) {
              competitorImages.push(urls[0]);
              competitorImageMapping.push({
                url: urls[0],
                page_name: ad.page_name || 'Concorrente'
              });
            }
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao parsear image_urls para ${ad.page_name}:`, e);
        }
      }
      console.log(`🎨 Coletadas ${competitorImages.length} imagens de concorrentes para análise visual`);
      console.log(`📋 Mapeamento criado:`, competitorImageMapping.map(m => m.page_name).join(', '));
      console.log('📊 Competitor images collected:', {
        count: competitorImages.length,
        mapping: competitorImageMapping.map(c => ({ name: c.page_name, hasUrl: !!c.url }))
      });
    } else {
      console.log('⚠️ Nenhum dado competitivo disponível - briefing sem análise competitiva');
    }

    const hasVisualAnalysis = materialFileUrl && competitorImages.length > 0;
    if (hasVisualAnalysis) {
      console.log('🖼️ ANÁLISE VISUAL ATIVADA - Criativo base + ' + competitorImages.length + ' concorrentes');
    } else {
      console.log('⚠️ Análise visual desabilitada:', {
        materialFileUrl: !!materialFileUrl,
        competitorImages: competitorImages.length
      });
    }

    // Determinar company_id para uso (admin pode usar qualquer company)
    let companyIdToUse = profile?.company_id;

    if (!companyIdToUse) {
      console.log('🔍 Admin sem company_id, buscando via contexto...');

      // Tentar buscar company_id do projeto se fornecido
      if (projectId) {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('company_id')
          .eq('id', projectId)
          .single();

        if (project?.company_id) {
          companyIdToUse = project.company_id;
          console.log('✅ Company ID obtido do projeto:', companyIdToUse);
        }
      }

      // Se ainda não tem company_id, tentar buscar da conta Meta
      if (!companyIdToUse && accountId) {
        const { data: metaAccount } = await supabaseAdmin
          .from('meta_ad_accounts')
          .select('company_id')
          .eq('account_id', accountId)
          .single();

        if (metaAccount?.company_id) {
          companyIdToUse = metaAccount.company_id;
          console.log('✅ Company ID obtido da conta Meta:', companyIdToUse);
        }
      }

      // Se admin ainda não conseguiu company_id, continuamos mas logamos
      if (!companyIdToUse) {
        console.log('⚠️ Admin sem company_id definido, mas continuando...');
      }
    }

    // Buscar account name para verificar se é Mandic
    let accountName = '';
    if (accountId) {
      const { data: accountData } = await supabaseAdmin
        .from('meta_ad_accounts')
        .select('account_name')
        .eq('account_id', accountId)
        .maybeSingle();

      accountName = accountData?.account_name || '';
      console.log(`Account name: ${accountName}`);
    }

    // Verificar se é conta Mandic
    const isMandic = accountName && (
      accountName.toLowerCase().includes('são leopoldo mandic') ||
      accountName.toLowerCase().includes('mandic') ||
      accountName.toLowerCase().includes('pós-graduação medicina') ||
      accountName.toLowerCase().includes('medicina do sertão')
    );
    console.log(`🩺 Conta Mandic detectada: ${isMandic}`);
    // Validação dos parâmetros obrigatórios
    if (!adId) {
      console.error('❌ adId não fornecido');
      return new Response(
        JSON.stringify({ error: 'adId é obrigatório' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating briefing for ad:', adId, 'Project:', projectId, 'Format:', targetFormat);

    // Não usar mais simpleOutput - sempre usar análise IA
    if (!creativeAnalysis) {
      return new Response(
        JSON.stringify({ error: 'Creative analysis is required to generate briefing. Please run AI analysis first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== FUNÇÕES AUXILIARES PARA IDENTIDADE VISUAL =====

    // Extrair cores da marca do creativeAnalysis
    const extractBrandColors = (analysis: string): string[] => {
      const colorMatches = analysis.match(/#[0-9A-Fa-f]{6}/g) || [];
      return [...new Set(colorMatches)].slice(0, 5); // Top 5 cores únicas
    };

    // Detectar eventos sazonais baseado na data e análise de mercado
    const detectSeasonalEvent = (competitorAds: any[], marketAnalysis: string): {
      isSeasonalEvent: boolean;
      eventName: string;
      recommendedColors: string[]
    } => {
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const day = now.getDate();

      // Analisar texto da análise de mercado para keywords
      const analysisLower = (marketAnalysis || '').toLowerCase();

      // Black Friday (Novembro)
      if (month === 11 || analysisLower.includes('black friday') || analysisLower.includes('blackfriday')) {
        return {
          isSeasonalEvent: true,
          eventName: 'Black Friday',
          recommendedColors: ['#000000', '#FF0000', '#FFFF00'] // Preto, vermelho, amarelo
        };
      }

      // Natal (Dezembro)
      if (month === 12 || analysisLower.includes('natal') || analysisLower.includes('christmas')) {
        return {
          isSeasonalEvent: true,
          eventName: 'Natal',
          recommendedColors: ['#C41E3A', '#0F8B3D', '#FFD700'] // Vermelho, verde, dourado
        };
      }

      // Ano Novo (Dezembro/Janeiro)
      if ((month === 12 && day >= 26) || month === 1) {
        return {
          isSeasonalEvent: true,
          eventName: 'Ano Novo',
          recommendedColors: ['#FFD700', '#FFFFFF', '#000000'] // Dourado, branco, preto
        };
      }

      // Dia dos Namorados (Junho no Brasil)
      if (month === 6 || analysisLower.includes('namorados') || analysisLower.includes('amor')) {
        return {
          isSeasonalEvent: true,
          eventName: 'Dia dos Namorados',
          recommendedColors: ['#FF69B4', '#FF1493', '#FFC0CB'] // Rosa forte, rosa médio, rosa claro
        };
      }

      // Páscoa (Março/Abril - aproximado)
      if ((month === 3 || month === 4) && (analysisLower.includes('páscoa') || analysisLower.includes('pascoa'))) {
        return {
          isSeasonalEvent: true,
          eventName: 'Páscoa',
          recommendedColors: ['#8B4513', '#FFD700', '#FF69B4'] // Marrom chocolate, dourado, rosa
        };
      }

      // Nenhum evento sazonal detectado
      return {
        isSeasonalEvent: false,
        eventName: '',
        recommendedColors: []
      };
    };

    // Extrair cores da marca
    const brandColors = extractBrandColors(creativeAnalysis);
    console.log('🎨 Cores da marca detectadas:', brandColors);

    // Detectar eventos sazonais
    const seasonalEvent = detectSeasonalEvent(competitorAds || [], creativeAnalysis);
    console.log('🎄 Evento sazonal:', seasonalEvent);

    // Determinar estratégia de cores
    const colorStrategy = seasonalEvent.isSeasonalEvent
      ? `
**🎨 ESTRATÉGIA DE CORES - EVENTO SAZONAL (${seasonalEvent.eventName}):**

⚠️ CRÍTICO: Este criativo será usado em campanha de ${seasonalEvent.eventName}.

**PALETA OBRIGATÓRIA:**
${seasonalEvent.recommendedColors.map((color, i) => `- Cor ${i + 1}: ${color}`).join('\n')}

**REGRAS:**
1. Use PRIORITARIAMENTE as cores do evento sazonal
2. Pode manter 1-2 elementos da marca (logo, fonte) mas adapte as cores principais
3. O mercado ESPERA ver as cores do evento - não manter identidade visual original
4. Background, CTAs e elementos principais devem usar a paleta sazonal
5. Justifique visualmente a escolha das cores no campo "rationale"

Exemplos de aplicação:
- Background: Usar cor primária do evento
- CTA: Cor de destaque do evento (ex: amarelo na Black Friday)
- Texto principal: Contraste forte com background
- Elementos decorativos: Cores secundárias do evento
`
      : `
**🎨 ESTRATÉGIA DE CORES - IDENTIDADE DA MARCA:**

⚠️ CRÍTICO: Mantenha a identidade visual do criativo original.

**PALETA DA MARCA (cores detectadas do criativo base):**
${brandColors.length > 0
        ? brandColors.map((color, i) => `- Cor ${i + 1}: ${color}`).join('\n')
        : '- Nenhuma cor específica detectada - use análise visual do criativo base'}

**REGRAS:**
1. Mantenha as cores dominantes do criativo original
2. Preserve o estilo tipográfico (bold, tamanhos relativos)
3. Mantenha elementos visuais característicos (formas, ícones)
4. Aplique APENAS insights de copywriting e estrutura das tendências
5. A identidade visual deve ser RECONHECÍVEL como a mesma marca

O que PODE mudar (baseado em tendências):
- Copywriting e tom de voz
- CTAs e call-to-actions
- Hierarquia de informação
- Distribuição de elementos (desde que mantenha cores)

O que NÃO PODE mudar:
- Paleta de cores principal
- Estilo tipográfico geral
- Elementos visuais de marca
`;

    // Regras Mandic se aplicável
    const mandicGuidelines = isMandic ? `

**🩺 REGRAS OBRIGATÓRIAS MANDIC - BASE DE CONHECIMENTO:**

Você DEVE seguir rigorosamente as diretrizes de copywriting Mandic:

**ESTRUTURA OBRIGATÓRIA:**
- Copy principal: máximo 110 caracteres
- Legenda/Descrição (campo legenda_section): entre 250-500 caracteres
- CTA: único e coerente com o funil
- Tom: profissional, humano e inspirador

**PROIBIÇÕES ABSOLUTAS:**
- "últimas vagas", "faça já", "imperdível", "corra"
- Promessas de resultado ou títulos médicos (especialista, RQE)
- Linguagem de varejo ou urgência artificial
- Jargões complexos sem explicação

**OBRIGATÓRIO VALORIZAR:**
- Prática supervisionada (70% em pós-médica)
- Infraestrutura (laboratórios, ambulatórios, hospital próprio)
- Docentes atuantes e de referência
- Tradição e excelência acadêmica

**IDENTIFICAÇÃO DE PRODUTO (detectar automaticamente do anúncio):**

1. **Pós-Graduação Medicina** (Pós-Médica):
   - Tom: consultivo, técnico, inspirador
   - Mensagem: evolução profissional com prática
   - Provas: 70% prática, ambulatórios, docentes atuantes
   - CTA: "Conheça nossos cursos", "Inicie sua especialização"
   - Cidades: Campinas, SP, Brasília

2. **Pós-Graduação Odontologia** (Pós-Odonto):
   - Tom: educacional, técnico, profissional
   - Mensagem: tradição + prática + inovação
   - Provas: alta carga prática, docentes renomados
   - CTA: "Conheça as especialidades", "Garanta sua vaga"

3. **Vestibular Medicina**:
   - Tom: institucional, inspirador, confiável
   - Mensagem: tradição + excelência
   - Provas: nota máxima MEC, hospital próprio, prática desde início
   - CTA: "Inscreva-se", "Confira as datas"

4. **Vestibular Odontologia**:
   - Tom: acadêmico, moderno, jovem
   - Mensagem: 30 anos de história, 40 mil formados
   - Provas: clínicas e laboratórios avançados
   - CTA: "Inscreva-se agora"

5. **FMS - Medicina do Sertão**:
   - Tom: humano, regional, acolhedor
   - Mensagem: impacto social + oportunidade
   - Provas: interiorização, conexão comunidade
   - CTA: "Inscreva-se", "Veja como participar"
   - IMPORTANTE: NÃO mencionar Mandic

6. **BeautyCare** (Captação Pacientes):
   - Tom: acolhedor, seguro, transparente
   - Mensagem: clínica-escola supervisionada + acessibilidade
   - Provas: atendimentos supervisionados, docentes especialistas
   - CTA: "Agende sua consulta", "Faça sua triagem"
   - Evitar: promessas estéticas

**VALIDAÇÃO OBRIGATÓRIA:**
Antes de entregar, verifique:
✓ Copy ≤110 caracteres?
✓ Legenda 250-500 caracteres no campo legenda_section?
✓ CTA único e adequado ao produto?
✓ Sem palavras proibidas?
✓ Tom correto para o produto?
✓ Provas reais presentes?
✓ Coerência entre copy e legenda?

` : '';


    // Instruções específicas por formato
    const formatInstructions = targetFormat === 'carousel'
      ? `
**📱 INSTRUÇÕES PARA CARROSSEL:**
- Gere wireframe com estrutura para 3-5 slides (cards)
- Cada card deve ter um foco específico (ex: Card 1 = problema, Card 2 = solução, Card 3 = benefício, Card 4 = prova social, Card 5 = CTA)
- Mantenha consistência visual entre os cards (mesma paleta, tipografia, estilo)
- Último card deve ter CTA forte e claro
- No campo "rationale", explique a jornada narrativa dos cards
- IMPORTANTE: Gere apenas UM wireframe que represente o conceito visual geral - a estrutura multi-card será interpretada pelo designer
`
      : targetFormat === 'video'
        ? `
**🎬 INSTRUÇÕES PARA VÍDEO:**
- Gere wireframe que represente o conceito visual do vídeo
- No campo "rationale", inclua um storyboard com 3-5 cenas:
  * Cena 1 (0-3s): Gancho visual/textual para parar o scroll
  * Cena 2 (3-6s): Apresentação do problema/produto
  * Cena 3 (6-9s): Benefício principal ou prova social
  * Cena 4 (9-12s): CTA e próximos passos
- Para cada cena, descreva: duração, descrição visual, texto/narração sugerida
- Mantenha ritmo dinâmico (máx 3-5s por cena para vídeos curtos)
- IMPORTANTE: O wireframe deve capturar o frame-chave principal do vídeo
`
        : `
**📐 INSTRUÇÕES PARA IMAGEM ESTÁTICA:**
- Gere wireframe tradicional de imagem estática
- Foco em hierarquia visual clara e impactante
- CTA deve ser proeminente e bem posicionado
- Aplique princípios de design baseados nas tendências de mercado
`;

    console.log(`🎯 Formato selecionado: ${targetFormat} | Evento sazonal: ${seasonalEvent.isSeasonalEvent ? seasonalEvent.eventName : 'Nenhum'}`);


    // 1. Usar dados do request como fallback (as tabelas meta_ads/meta_ad_metrics não existem ainda)
    const fallbackAdData = {
      ad_name: adName || `Ad ${adId}`,
      status: 'active',
      account_id: accountId || 'unknown',
    };

    // Mock metrics para geração do briefing
    const metrics = {
      impressions: 10000,
      clicks: 250,
      ctr: 2.5,
      cpc: 0.75,
      spend: 187.50,
      conversions: 15,
      conversion_rate: 6.0,
      roas: 4.2
    };

    // 2. Generate wireframe with OpenAI based on creative analysis
    const wireframePromptPrefix = hasVisualAnalysis
      ? `Com base na análise IA do criativo de alta performance abaixo, gere um WIREFRAME VISUAL (esqueleto estrutural) para criação de uma nova versão otimizada do anúncio.

⚠️ IMPORTANTE: Você receberá IMAGENS REAIS do criativo base e de ${competitorImages.length} concorrentes. Faça uma ANÁLISE VISUAL PROFUNDA comparando os elementos visuais.`
      : `Com base na análise IA do criativo de alta performance abaixo, gere um WIREFRAME VISUAL (esqueleto estrutural) para criação de uma nova versão otimizada do anúncio:`;

    const wireframePrompt = `${wireframePromptPrefix}

CRIATIVO BASE:
- Nome: ${adName || fallbackAdData.ad_name}
- Status: ${fallbackAdData.status}
- **Arquivo de referência visual:** ${materialFileUrl ? 'Anexado (primeira imagem)' : 'Não disponível'}

${colorStrategy}

${mandicGuidelines}

FORMATO DE SAÍDA: ${targetFormat === 'carousel' ? 'CARROSSEL (múltiplas imagens)' : targetFormat === 'video' ? 'VÍDEO (storyboard)' : 'IMAGEM ESTÁTICA'}

${formatInstructions}

LEGENDA/DESCRIÇÃO ATUAL DO MATERIAL:
${materialCaption ? `"${materialCaption}"` : 'Legenda não disponível'}

MÉTRICAS DE PERFORMANCE:
${metrics ? `
- Impressões: ${metrics.impressions?.toLocaleString()}
- Cliques: ${metrics.clicks?.toLocaleString()}
- CTR: ${metrics.ctr}%
- CPC: $${metrics.cpc}
- Conversões: ${metrics.conversions}
- Taxa de Conversão: ${metrics.conversion_rate}%
- ROAS: ${metrics.roas}
- Período: N/A - N/A
` : 'Métricas não disponíveis'}

${hasVisualAnalysis ? `
**🎨 ANÁLISE VISUAL COMPARATIVA OBRIGATÓRIA:**

Você está recebendo:
1. IMAGEM DO CRIATIVO BASE (primeira imagem)
2. ${competitorImages.length} IMAGENS DE CONCORRENTES TOP (imagens seguintes)

**INSTRUÇÕES DE ANÁLISE VISUAL:**

Compare VISUALMENTE o criativo base com os concorrentes nas seguintes dimensões:

1. **COMPOSIÇÃO E LAYOUT**:
   - Posicionamento de elementos (logo, CTA, texto, imagem principal)
   - Hierarquia visual (o que chama atenção primeiro?)
   - Uso de espaço em branco vs. espaço preenchido
   - Padrões de grid/alinhamento que se repetem
   - Relação imagem/texto (% de cada)

2. **PALETA DE CORES**:
   - Cores dominantes dos concorrentes (primária, secundária, accent)
   - Esquemas de cor (monocromático, complementar, análogo)
   - Uso de contraste alto vs. suave
   - Se o criativo base está alinhado ou diverge
   - Uso de cores em CTAs (padrão de mercado)

3. **TIPOGRAFIA**:
   - Tamanho relativo das fontes (headline vs. body)
   - Peso das fontes (light, regular, bold, heavy)
   - Quantidade de texto vs. área de imagem
   - Tratamentos (caixa alta, itálico, underline)
   - Legibilidade: contraste texto/fundo

4. **ELEMENTOS VISUAIS**:
   - Uso de ícones, badges, selos, ribbons
   - Fotos de pessoas vs. ilustrações vs. produtos
   - Tratamento de imagens (filtros, overlays, gradientes)
   - Uso de formas geométricas (círculos, retângulos, arrows)
   - Presença de elementos de prova social (ratings, reviews)

5. **CALL-TO-ACTION VISUAL**:
   - Posição do CTA (top, center, bottom, corner)
   - Formato do botão (pill, retangular, outline, ghost)
   - Cor e contraste do CTA
   - Tamanho relativo do CTA vs. resto do anúncio
   - Uso de icons dentro do CTA

6. **ESTILO FOTOGRÁFICO/ILUSTRATIVO**:
   - Pessoas reais vs. ilustrações vs. 3D
   - Ângulo das fotos (frontal, 3/4, lateral)
   - Iluminação (natural, studio, dramática)
   - Background (sólido, gradiente, cenário real)
   - Emotional tone (sério, alegre, profissional, casual)

**ENTREGUE NA SEÇÃO competitive_insights.visual_analysis:**
- **color_trends**: ["Padrão de cor 1", "Padrão 2", "Padrão 3"]
- **layout_patterns**: ["Padrão de layout 1", "Padrão 2", "Padrão 3"]
- **typography_trends**: ["Padrão tipográfico 1", "Padrão 2"]
- **cta_visual_patterns**: ["Padrão de CTA 1", "Padrão 2"]
- **design_gaps**: ["Gap 1 não explorado", "Gap 2", "Gap 3"]
- **visual_score**: "X/10 - justificativa baseada no alinhamento com padrões de mercado"
- **visual_recommendations**: ["Testar elemento visual X", "Ajustar Y baseado em padrão Z"]

**🎯 SEÇÃO OBRIGATÓRIA E CRÍTICA: actionable_insights**

⚠️ VOCÊ DEVE RETORNAR esta estrutura EXATA dentro de competitive_insights:

"actionable_insights": [
  {
    "recommendation": "string - ação específica",
    "rationale": "string - justificativa com dados",
    "competitor_example_url": "string - URL EXATO de competitorImages",
    "competitor_example_page_name": "string - nome da página",
    "visual_annotation": "string - o que observar na imagem"
  }
]

**INSTRUÇÕES IMPERATIVAS:**
1. Gere EXATAMENTE ${Math.min(competitorImages.length, 6)} insights (máximo ${competitorImages.length} concorrentes disponíveis)
2. Cada insight DEVE ter UM URL diferente dos ${competitorImages.length} fornecidos
3. Use APENAS estes URLs (NÃO INVENTE URLs):

${competitorImageMapping.map((c, i) => `   ${i + 1}. "${c.page_name}" → ${c.url}`).join('\n')}

4. EXEMPLO DE INSIGHT VÁLIDO:
{
  "recommendation": "Adicionar CTA em botão laranja vibrante (#FF6B35)",
  "rationale": "80% dos top performers usam laranja/vermelho em CTAs, gerando 42% mais cliques que azul",
  "competitor_example_url": "${competitorImageMapping[0]?.url || 'https://exemplo.com/img1.jpg'}",
  "competitor_example_page_name": "${competitorImageMapping[0]?.page_name || 'Concorrente A'}",
  "visual_annotation": "Observe o botão 'Inscreva-se Agora' em laranja vibrante, centralizado no terço inferior da imagem, com sombra sutil para destacar do fundo"
}

**VALIDAÇÃO:**
- Cada competitor_example_url DEVE ser um dos URLs listados acima
- Não repita o mesmo URL 2 vezes
- Se tiver apenas ${competitorImages.length} concorrentes, gere no máximo ${competitorImages.length} insights (um por concorrente)

**CRITÉRIOS PARA SELEÇÃO DE EXEMPLOS:**
1. **Relevância visual direta**: A imagem DEVE mostrar claramente o elemento recomendado
2. **Qualidade do exemplo**: Prefira concorrentes com o elemento em destaque e boa execução
3. **Diversidade**: Use concorrentes DIFERENTES para cada insight (não repita URLs)
4. **Mapeamento correto**: Use APENAS os URLs fornecidos acima com seus respectivos page_names

` : ''}

${competitorAds && competitorAds.length > 0 ? `
**📊 INTELIGÊNCIA COMPETITIVA (TEXTUAL):**
Analisamos ${competitorAds.length} anúncios de concorrentes ativos. Use essas informações para:
1. Identificar PADRÕES DE SUCESSO no mercado
2. Encontrar GAPS DE OPORTUNIDADE não explorados pelos concorrentes
3. Recomendar elementos que devem ser TESTADOS baseados em tendências

TOP ANÚNCIOS COMPETITIVOS:
${competitorAds.slice(0, 10).map((ad: any, i: number) => `
📢 Concorrente ${i + 1} - ${ad.page_name}
   Copy: "${ad.ad_copy?.substring(0, 200) || 'Sem descrição'}..."
   CTA: ${ad.cta_text || 'N/A'}
   Formato: ${ad.ad_format || 'N/A'}
   Plataformas: ${ad.platform_positions ? JSON.parse(ad.platform_positions).join(', ') : 'N/A'}
   Ativo desde: ${ad.started_running_date || 'N/A'}
`).join('\n\n')}

**INSTRUÇÕES DE USO (ANÁLISE TEXTUAL):**
- Identifique padrões de copy (tom, urgência, benefícios)
- Compare CTAs: o anúncio analisado usa CTA similar ou diferente?
- Avalie formatos: vídeo vs imagem - qual predomina?
- Analise posicionamento: que plataformas/posições os concorrentes priorizam?
` : ''}

ANÁLISE IA DO CRIATIVO:
${creativeAnalysis
        ? (typeof creativeAnalysis === 'string'
          ? `Texto da Análise: ${creativeAnalysis}`
          : `Análise Visual: ${JSON.stringify(creativeAnalysis.visual_analysis, null, 2)}
Análise de Métricas: ${JSON.stringify(creativeAnalysis.metrics_analysis, null, 2)}  
Insights de Performance: ${JSON.stringify(creativeAnalysis.performance_insights, null, 2)}
Recomendações: ${JSON.stringify(creativeAnalysis.recommendations, null, 2)}`)
        : 'Análise IA não disponível'
      }

IMPORTANTE: Este wireframe é para empresas como franqueadoras, universidades e indústrias (ex: Hyster e Yale). Mantenha o tom profissional e focado.

Gere um WIREFRAME estruturado em JSON com POSICIONAMENTO PERCENTUAL PRECISO:

IMPORTANTE - POSICIONAMENTO INTELIGENTE:
1. Analise visualmente o criativo original e posicione elementos de forma coerente
2. Use coordenadas percentuais (left, top, width, height) baseadas na composição observada
3. Se recomendar adicionar uma pessoa, use role: "persona" com personType: "human"
4. Posicione onde sugeriu (ex: canto esquerdo = left:10, centro = left:35)
5. Permita sobreposição via zIndex (logo pode sobrepor pessoa, etc)
6. NÃO inclua textos de debug, contadores de caracteres ou informações técnicas
7. SEMPRE preencha title, subtitle e ctaLabel com textos COMPLETOS (não deixe vazio)

{
  "wireframe": {
    "elements": [
      {
        "id": "logo",
        "role": "logo",
        "left": 5,
        "top": 5,
        "width": 15,
        "height": 8,
        "zIndex": 10,
        "reasoning": "Logo no topo esquerdo para manter hierarquia visual do criativo"
      },
      {
        "id": "title",
        "role": "title",
        "left": 5,
        "top": 20,
        "width": 90,
        "height": 12,
        "zIndex": 2,
        "reasoning": "Título centralizado na área principal de atenção"
      },
      {
        "id": "subtitle",
        "role": "subtitle",
        "left": 5,
        "top": 35,
        "width": 90,
        "height": 8,
        "zIndex": 2,
        "reasoning": "Subtítulo abaixo do título para manter fluxo de leitura"
      },
      {
        "id": "persona",
        "role": "persona",
        "left": 10,
        "top": 50,
        "width": 30,
        "height": 35,
        "zIndex": 3,
        "personType": "human",
        "reasoning": "Pessoa adicionada para humanizar - SE RECOMENDADO pela análise"
      },
      {
        "id": "separator",
        "role": "separator",
        "left": 20,
        "top": 70,
        "width": 60,
        "height": 1,
        "zIndex": 3,
        "reasoning": "Separador visual para dividir seções"
      },
      {
        "id": "cta",
        "role": "cta",
        "left": 25,
        "top": 80,
        "width": 50,
        "height": 8,
        "zIndex": 4,
        "reasoning": "CTA na parte inferior para facilitar conversão"
      }
    ],
    "content": {
      "title": "Título de 5-9 palavras com benefício claro",
      "subtitle": "Subtítulo com insight ou prova social",
      "persona": "Gerente de Marketing",
      "ctaLabel": "Inscreva-se"
    },
    "meta": {
      "aspectRatio": "1:1",
      "gridSize": 8,
      "snapToGrid": false
    }
  },
  "objective": "leads | traffic | engagement | video | reach | unknown",
  "rationale": "Breve justificativa incluindo INSIGHTS COMPETITIVOS identificados",
  "competitive_insights": {
    "text_analysis": {
      "copy_trends": ["Padrão de copy 1", "Padrão 2", "Padrão 3"],
      "cta_patterns": ["Padrão de CTA 1", "Padrão 2"],
      "messaging_gaps": ["Gap de mensagem 1", "Gap 2"]
    },
    ${hasVisualAnalysis ? `"visual_analysis": {
      "color_trends": ["Padrão de cor 1 identificado nas imagens", "Padrão 2", "Padrão 3"],
      "layout_patterns": ["Padrão de layout 1 observado visualmente", "Padrão 2", "Padrão 3"],
      "typography_trends": ["Padrão tipográfico 1", "Padrão 2"],
      "cta_visual_patterns": ["Padrão visual de CTA 1", "Padrão 2"],
      "design_gaps": ["Gap de design 1 não explorado", "Gap 2", "Gap 3"],
      "visual_score": "X/10 - justificativa do score baseado no alinhamento visual com mercado",
      "visual_recommendations": ["Recomendação visual 1", "Recomendação 2", "Recomendação 3"]
    },
    "actionable_insights": [
      {
        "recommendation": "Ação específica a testar (ex: 'Testar CTA em tom laranja com alto contraste')",
        "rationale": "Por que fazer isso? Dados dos concorrentes (% que usam, impacto esperado)",
        "competitor_example_url": "URL_DA_IMAGEM_DO_CONCORRENTE",
        "competitor_example_page_name": "Nome da página do concorrente",
        "visual_annotation": "O que observar na imagem? (ex: 'Note o botão laranja no canto inferior direito com ícone de seta')"
      }
    ],` : ''}
    "recommended_tests": ["Testar elemento X dos concorrentes", "Testar variação Y baseada em padrão competitivo"]
  },
  "warnings": ["Lista de alertas como 'título excede limite', 'contraste insuficiente', etc."],
  "legenda_section": {
    "legenda_principal": "${materialCaption ? 'Legenda otimizada baseada na legenda atual - mínimo 383 caracteres' : 'Nova legenda baseada no criativo analisado - mínimo 383 caracteres'}",
    "competitive_rationale": "Por que esta legenda é competitiva baseada nos padrões observados nos concorrentes",
    "hashtags_sugeridas": ["#hashtag1", "#hashtag2", "#hashtag3"],
    "mentions_relevantes": ["@mention1", "@mention2"],
    "estrategia_legenda": "Por que esta legenda funciona melhor baseado na análise ${materialCaption ? '- melhorias da versão atual mantendo tom e comunicação do original' : '- criada do zero'}",
    "legenda_alternativas": ["Variação 1", "Variação 2", "Variação 3"]
  },
  "metadata": {
    "source_ad": "${adId}",
    "client_type": "Adequado para franqueadoras, universidades e indústrias",
    "analysis_date": "Baseado na análise de performance atual",
    "version": "1.0"
  }
}

REGRAS DE CTA POR OBJETIVO:
- leads: "Inscreva-se", "Fale conosco", "Baixar"
- traffic: "Saiba mais", "Acessar"
- engagement: "Ver mais", "Participar"  
- video: "Assistir", "Play"
- reach: "Saiba mais"
- unknown: "Saiba mais"

INSTRUÇÕES ESPECÍFICAS PARA WIREFRAME:
1. TÍTULO: benefício principal, máximo 65 caracteres, TEXTO COMPLETO
2. SUBTÍTULO: reforçar com prova (números, prazos), TEXTO COMPLETO
3. PERSONA/PRODUTO: 
   - Se recomendar adicionar PESSOA: use personType: "human" (renderiza silhueta)
   - Se for rótulo de persona/produto: use personType: "label" (renderiza badge amarelo)
   - Posicione baseado na análise visual do criativo
4. LOGO: posicionar onde está no criativo original (use left % apropriado)
5. CTA: derivar do objetivo detectado, TEXTO COMPLETO
6. POSICIONAMENTO: use % baseado no criativo analisado
7. SOBREPOSIÇÃO: permitida via zIndex (ex: logo sobre pessoa)
8. LEGENDA: separada do wireframe, mínimo 383 caracteres
9. SEM DEBUG: não inclua contadores, "(persona)", "Objetivo:", etc
10. TOM: ${materialCaption ? 'Mantenha RIGOROSAMENTE o tom da legenda original' : 'Crie legenda coerente com o criativo'}

Focalize em um wireframe prático que a equipe criativa possa implementar diretamente.
`;

    // Construir mensagem com ou sem imagens
    const userMessage: any = hasVisualAnalysis
      ? {
        role: 'user',
        content: [
          {
            type: 'text',
            text: wireframePrompt
          },
          // Imagem do criativo base
          {
            type: 'image_url',
            image_url: {
              url: materialFileUrl
            }
          },
          // Imagens dos concorrentes
          ...competitorImages.map((url: string) => ({
            type: 'image_url',
            image_url: {
              url: url
            }
          }))
        ]
      }
      : {
        role: 'user',
        content: wireframePrompt
      };

    // Schema para function calling do Gemini
    const responseSchema = {
      type: "object",
      properties: {
        wireframe: {
          type: "object",
          properties: {
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  role: { type: "string" },
                  left: { type: "number" },
                  top: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                  zIndex: { type: "number" },
                  reasoning: { type: "string" },
                  personType: { type: "string" }
                },
                required: ["id", "role", "left", "top", "width", "height", "zIndex"]
              }
            },
            content: {
              type: "object",
              properties: {
                title: { type: "string" },
                subtitle: { type: "string" },
                ctaLabel: { type: "string" }
              }
            },
            meta: {
              type: "object",
              properties: {
                aspectRatio: { type: "string" },
                gridSize: { type: "number" },
                snapToGrid: { type: "boolean" }
              }
            }
          }
        },
        objective: { type: "string" },
        rationale: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
        legenda_section: {
          type: "object",
          properties: {
            legenda_principal: { type: "string" },
            hashtags_sugeridas: { type: "array", items: { type: "string" } },
            mentions_relevantes: { type: "array", items: { type: "string" } },
            estrategia_legenda: { type: "string" },
            legenda_alternativas: { type: "array", items: { type: "string" } }
          }
        },
        competitive_insights: {
          type: "object",
          properties: {
            market_trends: { type: "array", items: { type: "string" } },
            positioning_gap: { type: "string" },
            actionable_insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  recommendation: { type: "string" },
                  rationale: { type: "string" },
                  competitor_example_url: { type: "string" },
                  competitor_example_page_name: { type: "string" },
                  visual_annotation: { type: "string" }
                }
              }
            }
          }
        },
        metadata: {
          type: "object",
          properties: {
            source_ad: { type: "string" },
            client_type: { type: "string" },
            analysis_date: { type: "string" },
            version: { type: "string" }
          }
        }
      },
      required: ["wireframe", "objective", "rationale", "legenda_section", "metadata"]
    };

    const tools = [{
      function_declarations: [{
        name: "generate_briefing",
        description: "Gera um briefing criativo com wireframe baseado em análise de performance e tendências de mercado",
        parameters: responseSchema
      }]
    }];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: wireframePrompt }]
          }],
          tools: tools,
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["generate_briefing"]
            }
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate briefing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();

    let wireframeData;
    try {
      const functionCall = geminiData.candidates[0].content.parts[0].functionCall;

      if (!functionCall || functionCall.name !== 'generate_briefing') {
        console.error('No valid function call in response:', JSON.stringify(geminiData).substring(0, 500));
        throw new Error('AI did not return structured data');
      }

      wireframeData = functionCall.args;

      // Log dos actionable_insights recebidos
      console.log('🎯 Actionable insights received:', {
        hasSection: !!wireframeData.competitive_insights?.actionable_insights,
        count: wireframeData.competitive_insights?.actionable_insights?.length || 0,
        firstInsight: wireframeData.competitive_insights?.actionable_insights?.[0]
      });

      // Validar e garantir actionable_insights
      if (wireframeData.competitive_insights && hasVisualAnalysis) {
        if (!wireframeData.competitive_insights.actionable_insights ||
          wireframeData.competitive_insights.actionable_insights.length === 0) {

          console.warn('⚠️ IA não retornou actionable_insights, gerando fallback...');

          // Fallback: criar pelo menos 1 insight usando o primeiro concorrente
          wireframeData.competitive_insights.actionable_insights = [
            {
              recommendation: "Testar elementos visuais dos concorrentes top",
              rationale: `Análise de ${competitorImages.length} concorrentes revelou padrões visuais não explorados`,
              competitor_example_url: competitorImageMapping[0]?.url || '',
              competitor_example_page_name: competitorImageMapping[0]?.page_name || 'Concorrente',
              visual_annotation: "Compare os elementos visuais desta referência com seu criativo atual"
            }
          ];
        }

        // Validar URLs nos insights
        const validUrls = competitorImageMapping.map(c => c.url);
        wireframeData.competitive_insights.actionable_insights =
          wireframeData.competitive_insights.actionable_insights.filter((insight: any) => {
            const isValid = validUrls.includes(insight.competitor_example_url);
            if (!isValid) {
              console.warn(`⚠️ Insight com URL inválido removido: ${insight.competitor_example_url}`);
            }
            return isValid;
          });

        console.log(`✅ ${wireframeData.competitive_insights.actionable_insights.length} actionable insights validados`);
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Fallback wireframe structure (novo formato)
      wireframeData = {
        wireframe: {
          elements: [
            { id: 'logo', role: 'logo', left: 5, top: 5, width: 15, height: 8, zIndex: 1, reasoning: 'Posição padrão' },
            { id: 'title', role: 'title', left: 5, top: 20, width: 90, height: 12, zIndex: 2, reasoning: 'Título central' },
            { id: 'subtitle', role: 'subtitle', left: 5, top: 35, width: 90, height: 8, zIndex: 2, reasoning: 'Subtítulo abaixo' },
            { id: 'separator', role: 'separator', left: 20, top: 65, width: 60, height: 1, zIndex: 3, reasoning: 'Divisor visual' },
            { id: 'cta', role: 'cta', left: 25, top: 80, width: 50, height: 8, zIndex: 4, reasoning: 'CTA na base' }
          ],
          content: {
            title: adName || fallbackAdData.ad_name || 'Título Principal',
            subtitle: 'Benefício principal da solução',
            persona: '',
            ctaLabel: 'Saiba mais'
          },
          meta: {
            aspectRatio: '1:1',
            gridSize: 8,
            snapToGrid: false
          }
        },
        objective: 'unknown',
        rationale: 'Wireframe gerado baseado nas melhores práticas para o tipo de cliente',
        warnings: [],
        legenda_section: {
          legenda_principal: materialCaption || 'Legenda otimizada baseada no criativo',
          hashtags_sugeridas: ['#marketing', '#campanha'],
          mentions_relevantes: [],
          estrategia_legenda: 'Foco em clareza e benefício',
          legenda_alternativas: []
        },
        metadata: {
          source_ad: adId,
          client_type: 'Adequado para franqueadoras, universidades e indústrias',
          analysis_date: 'N/A - N/A',
          version: '1.0'
        }
      };
    }

    // 3. Save wireframe to database (associate with project if provided)
    // REMOVIDO: Não salvamos mais em ai_generated_briefings
    // Agora transformamos diretamente em material completo

    console.log('Wireframe generated for ad:', adId);

    // Transformar o wireframe em material completo baseado no formato
    let materialId: string = providedMaterialId || '';
    let materialStatus = 'approved';

    if (targetFormat === 'carousel') {
      console.log('🎨 Gerando carrossel com imagens...');

      // Gerar imagens para os slides
      const { imageUrls, caption, slides } = await generateCarouselImages(
        wireframeData.wireframe.slides || [],
        wireframeData.legenda_section?.legenda_principal || '',
        geminiApiKey,
        supabaseAdmin,
        projectId
      );

      console.log(`✅ Carrossel gerado com ${slides.length} slides`);

      const materialData = {
        name: `Carrossel - Baseado em ${adName}`,
        type: 'carousel' as const,
        is_briefing: true,
        project_id: projectId,
        company_id: companyIdToUse,
        created_by: profile.id,
        canvas_data: null,
        caption: caption,
        file_url: imageUrls[0],
        wireframe_data: {
          isCarousel: true,
          slides: slides
        },
        metadata: {
          source_ad: adId,
          briefing_data: wireframeData
        },
        status: materialStatus
      };

      // Salvar ou atualizar em materials
      if (providedMaterialId) {
        const { error: updateError } = await supabaseAdmin
          .from('materials')
          .update(materialData)
          .eq('id', providedMaterialId);

        if (updateError) {
          console.error('Error updating carousel material:', updateError);
          throw updateError;
        }
        materialId = providedMaterialId;
      } else {
        const { data: material, error: insertError } = await supabaseAdmin
          .from('materials')
          .insert(materialData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating carousel material:', insertError);
          throw insertError;
        }
        materialId = material.id;
      }

    } else if (targetFormat === 'video') {
      console.log('🎥 Iniciando geração de vídeo...');

      // Construir prompt e iniciar Veo
      const videoPrompt = buildVideoPromptFromStoryboard(
        wireframeData.wireframe.storyboard || [],
        wireframeData.objective || '',
        { ad_name: adName, ad_copy: materialCaption }
      );

      console.log('📝 Prompt do vídeo:', videoPrompt);

      // Iniciar geração com Veo
      const veoOperation = await initiateVeoVideoGeneration({
        prompt: videoPrompt,
        imageUrl: materialFileUrl || '',
        geminiApiKey
      });

      console.log('✅ Operação Veo iniciada:', veoOperation.name);

      // Criar canvas visual do storyboard
      const canvasData = generateVideoCanvas(
        wireframeData.wireframe.storyboard || [],
        wireframeData.legenda_section?.legenda_principal || ''
      );

      const materialData = {
        name: `Vídeo - Baseado em ${adName}`,
        type: 'video' as const,
        is_briefing: true,
        project_id: projectId,
        company_id: companyIdToUse,
        created_by: profile.id,
        status: 'processing' as const,
        canvas_data: canvasData,
        caption: wireframeData.legenda_section?.legenda_principal,
        metadata: {
          veo_operation_name: veoOperation.name,
          storyboard: wireframeData.wireframe.storyboard,
          video_prompt: videoPrompt,
          source_ad: adId,
          briefing_data: wireframeData,
          ai_generated_video: true
        }
      };

      // Salvar ou atualizar em materials
      if (providedMaterialId) {
        const { error: updateError } = await supabaseAdmin
          .from('materials')
          .update(materialData)
          .eq('id', providedMaterialId);

        if (updateError) {
          console.error('Error updating video material:', updateError);
          throw updateError;
        }
        materialId = providedMaterialId;
      } else {
        const { data: material, error: insertError } = await supabaseAdmin
          .from('materials')
          .insert(materialData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating video material:', insertError);
          throw insertError;
        }
        materialId = material.id;
      }
      materialStatus = 'processing';

    } else if (targetFormat === 'static') {
      console.log('🖼️ Gerando imagem estática...');

      // Gerar canvas JSON
      const canvasData = generateStaticCanvas(wireframeData.wireframe);

      console.log('✅ Canvas estático gerado');

      const materialData = {
        name: `Imagem Estática - Baseado em ${adName}`,
        type: 'static' as const,
        is_briefing: true,
        project_id: projectId,
        company_id: companyIdToUse,
        created_by: profile.id,
        canvas_data: canvasData,
        caption: wireframeData.legenda_section?.legenda_principal,
        file_url: null,
        wireframe_data: wireframeData.wireframe,
        metadata: {
          source_ad: adId,
          briefing_data: wireframeData
        },
        status: materialStatus
      };

      // Salvar ou atualizar em materials
      if (providedMaterialId) {
        const { error: updateError } = await supabaseAdmin
          .from('materials')
          .update(materialData)
          .eq('id', providedMaterialId);

        if (updateError) {
          console.error('Error updating static material:', updateError);
          throw updateError;
        }
        materialId = providedMaterialId;
      } else {
        const { data: material, error: insertError } = await supabaseAdmin
          .from('materials')
          .insert(materialData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating static material:', insertError);
          throw insertError;
        }
        materialId = material.id;
      }
    } else {
      throw new Error(`Formato não suportado: ${targetFormat}`);
    }

    console.log(`✅ Material criado com sucesso: ${materialId} (status: ${materialStatus})`);

    return new Response(
      JSON.stringify({
        success: true,
        materialId: materialId,
        briefing: { id: materialId }, // For backward compatibility
        status: materialStatus,
        format: targetFormat
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-briefing:', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= FUNÇÕES AUXILIARES DE TRANSFORMAÇÃO =============

/**
 * Gera canvas JSON para imagem estática
 */
function generateStaticCanvas(layout: any): string {
  const objects = [];

  // Background
  objects.push({
    type: 'rect',
    left: 0,
    top: 0,
    width: 1080,
    height: 1080,
    fill: '#FFFFFF',
    selectable: false
  });

  // Headline (topo)
  objects.push({
    type: 'textbox',
    left: 540,
    top: 100,
    width: 900,
    text: layout.headline || 'Título Principal',
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    originX: 'center',
    fill: '#111827',
    selectable: true,
    fontFamily: 'Arial'
  });

  // Offer badge se existir
  if (layout.offer) {
    objects.push({
      type: 'rect',
      left: 540,
      top: 220,
      width: 250,
      height: 80,
      fill: '#DC2626',
      originX: 'center',
      rx: 40,
      ry: 40,
      selectable: true
    });

    objects.push({
      type: 'text',
      left: 540,
      top: 260,
      text: layout.offer,
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      fill: '#FFFFFF',
      selectable: true,
      fontFamily: 'Arial'
    });
  }

  // Body text
  objects.push({
    type: 'textbox',
    left: 540,
    top: 350,
    width: 800,
    text: layout.body || 'Texto principal do anúncio',
    fontSize: 24,
    textAlign: 'center',
    originX: 'center',
    fill: '#4B5563',
    selectable: true,
    fontFamily: 'Arial'
  });

  // Visual placeholder
  objects.push({
    type: 'rect',
    left: 240,
    top: 500,
    width: 600,
    height: 400,
    fill: '#F3F4F6',
    selectable: true,
    rx: 8,
    ry: 8
  });

  objects.push({
    type: 'text',
    left: 540,
    top: 700,
    text: layout.visualDescription || 'Área de Visual',
    fontSize: 16,
    textAlign: 'center',
    originX: 'center',
    fill: '#9CA3AF',
    selectable: true,
    fontFamily: 'Arial'
  });

  // CTA
  if (layout.cta) {
    objects.push({
      type: 'rect',
      left: 540,
      top: 950,
      width: 400,
      height: 80,
      fill: '#8B5CF6',
      originX: 'center',
      rx: 40,
      ry: 40,
      selectable: true
    });

    objects.push({
      type: 'text',
      left: 540,
      top: 990,
      text: layout.cta,
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      fill: '#FFFFFF',
      selectable: true,
      fontFamily: 'Arial'
    });
  }

  return JSON.stringify({
    version: '6.0.0',
    objects,
    background: '#FFFFFF'
  });
}

/**
 * Gera canvas visual do storyboard do vídeo
 */
function generateVideoCanvas(storyboard: any[], caption: string): string {
  const objects = [];
  const frameWidth = 600;
  const frameHeight = 120;
  const margin = 20;

  // Título "STORYBOARD DO VÍDEO"
  objects.push({
    type: 'textbox',
    left: 50,
    top: 30,
    width: 600,
    fontSize: 28,
    fontWeight: 'bold',
    fill: '#1a1a1a',
    text: 'STORYBOARD DO VÍDEO',
    fontFamily: 'Arial',
    selectable: true
  });

  // Legenda gerada
  if (caption) {
    objects.push({
      type: 'textbox',
      left: 50,
      top: 80,
      width: 600,
      fontSize: 14,
      fill: '#666666',
      text: `Legenda: ${caption}`,
      fontFamily: 'Arial',
      selectable: true
    });
  }

  // Cada frame do storyboard
  storyboard.forEach((scene, index) => {
    const yPos = 140 + (index * (frameHeight + margin));

    // Retângulo do frame
    objects.push({
      type: 'rect',
      left: 50,
      top: yPos,
      width: frameWidth,
      height: frameHeight,
      fill: '#f0f4f8',
      stroke: '#3b82f6',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
      selectable: true
    });

    // Número da cena
    objects.push({
      type: 'text',
      left: 70,
      top: yPos + 15,
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#3b82f6',
      text: `Cena ${index + 1}`,
      fontFamily: 'Arial',
      selectable: true
    });

    // Descrição da cena
    objects.push({
      type: 'textbox',
      left: 70,
      top: yPos + 45,
      width: frameWidth - 40,
      fontSize: 13,
      fill: '#1a1a1a',
      text: scene.description || '',
      fontFamily: 'Arial',
      selectable: true
    });

    // Texto da cena (se houver)
    if (scene.text) {
      objects.push({
        type: 'textbox',
        left: 70,
        top: yPos + 80,
        width: frameWidth - 40,
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#059669',
        text: `"${scene.text}"`,
        fontFamily: 'Arial',
        selectable: true
      });
    }
  });

  return JSON.stringify({
    version: '6.0.0',
    objects,
    background: '#ffffff'
  });
}

/**
 * Gera imagens para cada card do carrossel usando Gemini Image API
 */
async function generateCarouselImages(
  cards: Array<{
    headline: string;
    body: string;
    cta?: string;
    visualDescription: string;
  }>,
  originalCaption: string,
  geminiApiKey: string,
  supabaseClient: any,
  projectId: string
): Promise<{
  imageUrls: string[];
  caption: string;
  slides: Array<{ imageUrl: string; index: number }>;
}> {
  const imageUrls: string[] = [];
  const slides: Array<{ imageUrl: string; index: number }> = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    console.log(`Generating image for card ${i + 1}/${cards.length}...`);

    // Prompt detalhado para geração de imagem
    const imagePrompt = `
Crie uma imagem publicitária profissional para redes sociais (1080x1080px) com:

TEXTO PRINCIPAL (em destaque): "${card.headline}"
TEXTO SECUNDÁRIO: "${card.body}"
${card.cta ? `BOTÃO/CTA: "${card.cta}"` : ''}

ESTILO VISUAL:
${card.visualDescription}

REQUISITOS:
- Tipografia moderna e legível
- Cores vibrantes e profissionais
- Design limpo e balanceado
- Adequado para Instagram/Facebook
- Sem watermarks ou logos genéricos
- Texto bem integrado ao design visual
    `.trim();

    // Tenta primeiro com Gemini usando o modelo de imagem
    try {
      const geminiModel = 'gemini-2.5-flash-image';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: imagePrompt }
                ]
              }
            ]
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error for card ${i + 1}:`, response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      // Procurar a imagem em inlineData (camelCase) ou inline_data (snake_case)
      const parts = data?.candidates?.[0]?.content?.parts || [];
      let base64Image: string | undefined;
      let mimeType: string = 'image/jpeg';
      for (const part of parts) {
        if (part?.inlineData?.data) {
          base64Image = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
        if (part?.inline_data?.data) {
          base64Image = part.inline_data.data;
          mimeType = part.inline_data.mimeType || mimeType;
          break;
        }
      }

      if (!base64Image) {
        console.error('Unexpected Gemini response structure:', JSON.stringify(data).substring(0, 500));
        throw new Error('Invalid response from Gemini Image API');
      }

      // Converter base64 para Uint8Array
      const binaryString = atob(base64Image);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      // Upload para Supabase Storage
      const fileName = `carousel-${projectId}-${Date.now()}-slide-${i + 1}.jpg`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('materials')
        .upload(fileName, bytes, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabaseClient.storage
        .from('materials')
        .getPublicUrl(fileName);

      console.log(`Card ${i + 1} image generated successfully: ${publicUrl}`);

      imageUrls.push(publicUrl);
      slides.push({ imageUrl: publicUrl, index: i });
    } catch (geminiErr) {
      console.error(`Error generating image for card ${i + 1}:`, geminiErr);
      throw geminiErr;
    }
  }

  return { imageUrls, caption: originalCaption, slides };
}

/**
 * Constrói prompt detalhado para o Veo 3.1 baseado no storyboard
 */
function buildVideoPromptFromStoryboard(
  storyboard: any[],
  videoDescription: string,
  adData: any
): string {
  let prompt = `Create a professional 8-second video advertisement based on this storyboard:\n\n`;

  // Adicionar contexto do anúncio
  if (adData.ad_name || adData.headline) {
    prompt += `Product/Campaign: ${adData.ad_name || adData.headline}\n\n`;
  }

  // Adicionar descrição geral
  if (videoDescription) {
    prompt += `Overall vision: ${videoDescription}\n\n`;
  }

  // Adicionar cada cena do storyboard
  prompt += `Scene breakdown:\n`;
  storyboard.forEach((scene, idx) => {
    prompt += `\nScene ${idx + 1} (${scene.duration || '2s'}):\n`;
    prompt += `- Visual: ${scene.description}\n`;
    if (scene.text) {
      prompt += `- Text on screen: "${scene.text}"\n`;
    }
    if (scene.voiceover) {
      prompt += `- Voiceover: "${scene.voiceover}"\n`;
    }
  });

  prompt += `\n
Technical requirements:
- Duration: 8 seconds total
- Format: 16:9 aspect ratio
- Style: Professional, high-quality advertising
- Transitions: Smooth and engaging
- Audio: Background music matching the mood
- Quality: Cinematic, high production value`;

  return prompt;
}

/**
 * Inicia geração de vídeo com Veo 3.1
 */
async function initiateVeoVideoGeneration({
  prompt,
  imageUrl,
  geminiApiKey
}: {
  prompt: string;
  imageUrl: string;
  geminiApiKey: string;
}): Promise<{ name: string }> {

  // Primeiro, fazer upload da imagem para o Gemini Files API
  let imageData: any;

  if (imageUrl) {
    try {
      // Download da imagem
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      const base64Image = btoa(
        new Uint8Array(imageBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      imageData = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      };
    } catch (error) {
      console.error('Error processing image:', error);
      // Continuar sem imagem se falhar
    }
  }

  // Chamar API do Veo 3.1
  const requestBody: any = {
    instances: [{
      prompt: prompt
    }],
    parameters: {
      aspectRatio: '16:9',
      negativePrompt: 'low quality, blurry, distorted, cartoon, drawing'
    }
  };

  // Adicionar imagem de referência se disponível
  if (imageData) {
    requestBody.instances[0].image = imageData;
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Veo API error:', response.status, errorText);
    throw new Error(`Veo API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Veo operation created:', data);

  return { name: data.name };
}