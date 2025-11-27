import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

// Formato antigo (AI-generated)
interface WireframeDataOld {
  logo: {
    position: 'top-left' | 'top-center' | 'top-right';
    size: 'small' | 'medium' | 'large';
    reasoning: string;
  };
  title: {
    text: string;
    max_chars: number;
    font_weight: string;
    reasoning: string;
  };
  subtitle: {
    text: string;
    max_chars: number;
    font_weight: string;
    reasoning: string;
  };
  persona_product: {
    label: string;
    max_chars: number;
    bg_color: string;
    type: 'persona' | 'produto';
    reasoning: string;
  };
  separator: {
    visible: boolean;
    style: string;
    width_percent: number;
  };
  cta: {
    label: string;
    max_chars: number;
    shape: string;
    align: string;
    objective_mapped: string;
    reasoning: string;
  };
}

// Formato novo (WireframeEditor)
interface WireframeDataNew {
  elements: Array<{
    id: string;
    role: 'logo' | 'title' | 'subtitle' | 'persona' | 'separator' | 'cta' | 'text';
    left: number;
    top: number;
    width: number;
    height: number;
    zIndex: number;
    locked?: boolean;
  }>;
  content: {
    title: string;
    subtitle: string;
    persona: string;
    ctaLabel: string;
  };
  meta: {
    snapToGrid: boolean;
    gridSize: number;
    aspectRatio: string;
    lastEditedBy?: string;
    editedAt: string;
    version: number;
  };
}

type WireframeData = WireframeDataOld | WireframeDataNew;

interface WireframeCompactPreviewProps {
  wireframe_data: WireframeData | any;
  className?: string;
}

// Helper para verificar se é formato novo
const isNewFormat = (data: any): data is WireframeDataNew => {
  return data && 'elements' in data && 'content' in data && 'meta' in data;
};

// Converter formato novo para antigo para renderização
const convertToOldFormat = (data: WireframeDataNew): WireframeDataOld => {
  const logoElement = data.elements.find(e => e.role === 'logo');
  const ctaElement = data.elements.find(e => e.role === 'cta');
  
  // Determinar posição do logo baseado na posição left
  let logoPosition: 'top-left' | 'top-center' | 'top-right' = 'top-center';
  if (logoElement) {
    if (logoElement.left < 33) logoPosition = 'top-left';
    else if (logoElement.left > 66) logoPosition = 'top-right';
    else logoPosition = 'top-center';
  }

  // Determinar alinhamento do CTA
  let ctaAlign = 'center';
  if (ctaElement) {
    if (ctaElement.left < 33) ctaAlign = 'left';
    else if (ctaElement.left > 66) ctaAlign = 'right';
    else ctaAlign = 'center';
  }

  return {
    logo: {
      position: logoPosition,
      size: 'medium',
      reasoning: ''
    },
    title: {
      text: data.content.title || '',
      max_chars: 60,
      font_weight: 'bold',
      reasoning: ''
    },
    subtitle: {
      text: data.content.subtitle || '',
      max_chars: 120,
      font_weight: 'semibold',
      reasoning: ''
    },
    persona_product: {
      label: data.content.persona || '',
      max_chars: 30,
      bg_color: '#FCD34D',
      type: 'persona',
      reasoning: ''
    },
    separator: {
      visible: data.elements.some(e => e.role === 'separator'),
      style: 'line',
      width_percent: 60
    },
    cta: {
      label: data.content.ctaLabel || '',
      max_chars: 30,
      shape: 'rounded',
      align: ctaAlign,
      objective_mapped: 'conversão',
      reasoning: ''
    }
  };
};

export const WireframeCompactPreview: React.FC<WireframeCompactPreviewProps> = ({ wireframe_data, className }) => {
  if (!wireframe_data) {
    return (
      <div className={`bg-muted/30 p-3 rounded-lg border border-muted text-center ${className}`}>
        <p className="text-xs text-muted-foreground">Wireframe não disponível</p>
      </div>
    );
  }

  // Se for formato novo (editado), renderizar com layout personalizado
  if (isNewFormat(wireframe_data)) {
    const newData = wireframe_data as WireframeDataNew;
    return (
      <Card className={`bg-gradient-to-br from-white to-gray-50 shadow-md border-0 overflow-hidden max-w-xs ${className}`}>
        <CardContent className="p-0">
          {/* Container com layout personalizado */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 min-h-[200px] relative">
            {/* Pattern de fundo sutil */}
            <div className="absolute inset-0 opacity-5">
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 100 100">
                <pattern id="compact-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.3"/>
                </pattern>
                <rect width="100" height="100" fill="url(#compact-grid)"/>
              </svg>
            </div>

            {/* Renderizar elementos com posições reais */}
            <div className="relative w-full" style={{ paddingTop: '100%' }}>
              <div className="absolute inset-0">
                {newData.elements.map(element => {
                  const style = {
                    position: 'absolute' as const,
                    left: `${element.left}%`,
                    top: `${element.top}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                    zIndex: element.zIndex
                  };

                  switch (element.role) {
                    case 'logo':
                      return (
                        <div key={element.id} style={style} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded text-white flex items-center justify-center text-xs font-bold">
                          <span className="text-[8px]">LOGO</span>
                        </div>
                      );
                    case 'title':
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <h1 className="text-sm font-bold text-gray-900 leading-tight text-center line-clamp-2">
                            {newData.content.title}
                          </h1>
                        </div>
                      );
                    case 'subtitle':
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <p className="text-xs font-semibold text-gray-700 leading-snug text-center line-clamp-2">
                            {newData.content.subtitle}
                          </p>
                        </div>
                      );
                    case 'persona':
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-gray-900 bg-yellow-400">
                            <span className="text-[10px] uppercase tracking-wide truncate max-w-[80px]">
                              {newData.content.persona}
                            </span>
                          </div>
                        </div>
                      );
                    case 'separator':
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <hr className="w-full border border-gray-300 rounded-full" />
                        </div>
                      );
                    case 'cta':
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-1.5 px-3 rounded-full shadow-sm text-xs disabled:cursor-not-allowed" disabled>
                            <span className="text-[10px] uppercase tracking-wide truncate max-w-[60px] block">
                              {newData.content.ctaLabel}
                            </span>
                          </button>
                        </div>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            </div>

            {/* Elementos decorativos */}
            <div className="absolute top-1 right-1 w-3 h-3 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-60"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-60"></div>
          </div>

          {/* Footer */}
          <div className="bg-gray-900 text-white p-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-green-400 text-[10px]">APROVADO</span>
              </div>
              <div className="text-gray-400 text-[9px] truncate max-w-[100px]">
                Layout Personalizado
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Converter para formato antigo se necessário (para wireframes antigos)
  const data: WireframeDataOld = wireframe_data as WireframeDataOld;

  // Verificar se tem os campos necessários
  if (!data.logo || !data.title || !data.subtitle || !data.persona_product || !data.cta) {
    return (
      <div className={`bg-muted/30 p-3 rounded-lg border border-muted text-center ${className}`}>
        <p className="text-xs text-muted-foreground">Dados do wireframe incompletos</p>
      </div>
    );
  }

  const getLogoPosition = () => {
    switch (data.logo.position) {
      case 'top-left':
        return 'justify-start';
      case 'top-right':
        return 'justify-end';
      case 'top-center':
      default:
        return 'justify-center';
    }
  };

  const getCTAAlignment = () => {
    switch (data.cta.align) {
      case 'left':
        return 'justify-start';
      case 'right':
        return 'justify-end';
      case 'center':
      default:
        return 'justify-center';
    }
  };

  const getSeparatorWidth = () => {
    return `${data.separator.width_percent}%`;
  };

  return (
    <Card className={`bg-gradient-to-br from-white to-gray-50 shadow-md border-0 overflow-hidden max-w-xs ${className}`}>
      <CardContent className="p-0">
        {/* Container principal compacto */}
        <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 min-h-[200px] relative">
          {/* Pattern de fundo sutil */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 100 100">
              <pattern id="compact-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.3"/>
              </pattern>
              <rect width="100" height="100" fill="url(#compact-grid)"/>
            </svg>
          </div>

          <div className="relative z-10">
            {/* Logo compacto */}
            <div className={`flex ${getLogoPosition()} mb-3`}>
              <div className="w-8 h-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded text-white flex items-center justify-center text-xs font-bold">
                <span className="text-[8px]">LOGO</span>
              </div>
            </div>

            {/* Title compacto */}
            <div className="text-center mb-2">
              <h1 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">
                {data.title.text}
              </h1>
            </div>

            {/* Subtitle compacto */}
            <div className="text-center mb-3">
              <p className="text-xs font-semibold text-gray-700 leading-snug line-clamp-2">
                {data.subtitle.text}
              </p>
            </div>

            {/* Persona/Product Tag compacto */}
            <div className="flex justify-center mb-3">
              <div 
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-gray-900"
                style={{ backgroundColor: data.persona_product.bg_color }}
              >
                <span className="text-[10px] uppercase tracking-wide truncate max-w-[80px]">
                  {data.persona_product.label}
                </span>
              </div>
            </div>

            {/* Separator compacto */}
            {data.separator.visible && (
              <div className="flex justify-center mb-3">
                <hr 
                  className="border border-gray-300 rounded-full" 
                  style={{ width: getSeparatorWidth() }} 
                />
              </div>
            )}

            {/* CTA Button compacto */}
            <div className={`flex ${getCTAAlignment()}`}>
              <button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-1.5 px-3 rounded-full shadow-sm text-xs disabled:cursor-not-allowed"
                disabled
              >
                <span className="text-[10px] uppercase tracking-wide truncate max-w-[60px] block">
                  {data.cta.label}
                </span>
              </button>
            </div>
          </div>

          {/* Elementos decorativos compactos */}
          <div className="absolute top-1 right-1 w-3 h-3 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-60"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-60"></div>
        </div>

        {/* Footer compacto */}
        <div className="bg-gray-900 text-white p-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium text-green-400 text-[10px]">APROVADO</span>
            </div>
            <div className="text-gray-400 text-[9px] truncate max-w-[100px]">
              {data.cta.objective_mapped}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WireframeCompactPreview;