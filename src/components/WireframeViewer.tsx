import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import personaIcon from "@/assets/persona-icon.png";

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
    role: 'logo' | 'title' | 'subtitle' | 'persona' | 'separator' | 'cta' | 'text' | 'news-title' | 'source-label' | 'card-text';
    left: number;
    top: number;
    width: number;
    height: number;
    zIndex: number;
    locked?: boolean;
    personType?: 'human' | 'product' | 'label';
    personColor?: string;
    reasoning?: string;
  }>;
  content: {
    title: string;
    subtitle: string;
    persona: string;
    ctaLabel: string;
    newsTitle?: string;
    sourceLabel?: string;
    cardText?: string;
    // Backwards compatibility
    personaProduct?: string;
    cta?: string;
  };
  meta: {
    snapToGrid: boolean;
    gridSize: number;
    aspectRatio: string;
    layoutType?: 'default' | 'advertorial' | 'news' | 'card';
    lastEditedBy?: string;
    editedAt: string;
    version: number;
  };
}

type WireframeData = WireframeDataOld | WireframeDataNew;

interface WireframeViewerProps {
  wireframe: WireframeData | any;
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

  // Determinar tamanho do logo baseado no width
  let logoSize: 'small' | 'medium' | 'large' = 'medium';
  if (logoElement) {
    if (logoElement.width < 15) logoSize = 'small';
    else if (logoElement.width > 25) logoSize = 'large';
  }

  return {
    logo: {
      position: logoPosition,
      size: logoSize,
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
      align: 'center',
      objective_mapped: 'conversão',
      reasoning: ''
    }
  };
};

export const WireframeViewer: React.FC<WireframeViewerProps> = ({ wireframe, className }) => {
  if (!wireframe) {
    return (
      <Card className={`bg-muted/30 ${className}`}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Wireframe não disponível</p>
        </CardContent>
      </Card>
    );
  }

  // Se for formato novo (editado), renderizar com layout personalizado
  if (isNewFormat(wireframe)) {
    const newData = wireframe as WireframeDataNew;
    return (
      <Card className={`bg-gray-50 border-2 border-dashed border-gray-300 ${className}`}>
        <CardContent className="p-8">
          {/* Renderizar layout personalizado */}
          <div className="relative w-full bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ paddingTop: '100%' }}>
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
                      <div key={element.id} style={style} className="bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600 font-medium">
                        LOGO
                      </div>
                    );
                  case 'title':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center">
                        <h1 className="text-2xl font-bold text-gray-800 text-center leading-tight">
                          {newData.content.title}
                        </h1>
                      </div>
                    );
                  case 'subtitle':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center">
                        <p className="text-base font-semibold text-gray-700 text-center leading-relaxed">
                          {newData.content.subtitle}
                        </p>
                      </div>
                    );
                  case 'persona':
                    const isPerson = element.personType === 'human';
                    const personColor = element.personColor || '#9333EA';
                    
                    if (isPerson) {
                      return (
                        <div key={element.id} style={style} className="flex items-end justify-center">
                          <img 
                            src={personaIcon}
                            alt="Persona"
                            className="w-full h-full object-contain opacity-80"
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                          />
                        </div>
                      );
                    } else {
                      return (
                        <div key={element.id} style={style} className="flex items-center justify-center">
                          <span className="px-4 py-2 text-sm font-medium text-black rounded-full bg-yellow-400">
                            {newData.content.persona || newData.content.personaProduct || 'Produto'}
                          </span>
                        </div>
                      );
                    }
                  case 'separator':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center">
                        <hr className="w-full border-gray-400" />
                      </div>
                    );
                   case 'cta':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center">
                        <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors" disabled>
                          {newData.content.ctaLabel || newData.content.cta || 'Saiba Mais'}
                        </button>
                      </div>
                    );
                  case 'news-title':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center">
                        <h1 className="text-2xl font-bold text-gray-900 text-center leading-tight whitespace-pre-wrap break-words w-full">
                          {newData.content.newsTitle || 'Título da Notícia'}
                        </h1>
                      </div>
                    );
                  case 'source-label':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-start">
                        <p className="text-sm text-gray-600 whitespace-pre-wrap break-words w-full">
                          {newData.content.sourceLabel || 'Fonte: Portal de Notícias'}
                        </p>
                      </div>
                    );
                  case 'card-text':
                    return (
                      <div key={element.id} style={style} className="flex items-center justify-center p-4">
                        <p className="text-xl font-bold text-gray-900 text-center leading-tight">
                          {newData.content.cardText || 'Texto do card com mensagem principal'}
                        </p>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
          
        </CardContent>
      </Card>
    );
  }

  // Converter para formato antigo se necessário (para wireframes antigos)
  const data: WireframeDataOld = wireframe as WireframeDataOld;

  // Verificar se tem os campos necessários
  if (!data.logo || !data.title || !data.subtitle || !data.persona_product || !data.cta) {
    return (
      <Card className={`bg-muted/30 ${className}`}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Dados do wireframe incompletos</p>
        </CardContent>
      </Card>
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

  const getLogoSize = () => {
    switch (data.logo.size) {
      case 'small':
        return 'w-12 h-8';
      case 'large':
        return 'w-20 h-12';
      case 'medium':
      default:
        return 'w-16 h-10';
    }
  };

  const getSeparatorWidth = () => {
    return `${data.separator.width_percent}%`;
  };

  return (
    <Card className={`bg-gray-50 border-2 border-dashed border-gray-300 ${className}`}>
      <CardContent className="p-8">
        {/* Logo */}
        <div className={`flex ${getLogoPosition()} mb-6`}>
          <div className={`${getLogoSize()} bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600 font-medium`}>
            LOGO
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800 leading-tight">
            {data.title?.text || 'Título Principal'}
          </h1>
        </div>

        {/* Subtitle */}
        <div className="text-center mb-6">
          <p className="text-base font-semibold text-gray-700 leading-relaxed">
            {data.subtitle?.text || 'Subtítulo com benefício claro'}
          </p>
        </div>

        {/* Persona/Product */}
        {data.persona_product?.label && (
          <div className="flex justify-center mb-6">
            <span 
              className="px-4 py-2 text-sm font-medium text-black rounded-full"
              style={{ backgroundColor: data.persona_product?.bg_color || '#FCD34D' }}
            >
              {data.persona_product.label}
            </span>
          </div>
        )}

        {/* Separator */}
        {data.separator?.visible && (
          <div className="flex justify-center mb-6">
            <hr 
              className="border-gray-400" 
              style={{ width: getSeparatorWidth() }} 
            />
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center">
          <button 
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors"
            disabled
          >
            {data.cta?.label || 'Saiba Mais'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WireframeViewer;