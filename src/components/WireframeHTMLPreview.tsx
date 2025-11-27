import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface WireframeData {
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

interface WireframeHTMLPreviewProps {
  wireframe_data: WireframeData;
  className?: string;
}

export const WireframeHTMLPreview: React.FC<WireframeHTMLPreviewProps> = ({ wireframe_data, className }) => {
  if (!wireframe_data) {
    return (
      <div className={`bg-muted/50 p-8 rounded-lg border border-muted ${className}`}>
        <p className="text-center text-muted-foreground">Dados do wireframe não disponíveis</p>
      </div>
    );
  }

  const getLogoPosition = () => {
    switch (wireframe_data.logo.position) {
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
    switch (wireframe_data.logo.size) {
      case 'small':
        return 'w-16 h-10';
      case 'large':
        return 'w-24 h-16';
      case 'medium':
      default:
        return 'w-20 h-12';
    }
  };

  const getTitleWeight = () => {
    switch (wireframe_data.title.font_weight) {
      case 'normal':
        return 'font-normal';
      case 'semibold':
        return 'font-semibold';
      case 'bold':
      default:
        return 'font-bold';
    }
  };

  const getSubtitleWeight = () => {
    switch (wireframe_data.subtitle.font_weight) {
      case 'normal':
        return 'font-normal';
      case 'bold':
        return 'font-bold';
      case 'semibold':
      default:
        return 'font-semibold';
    }
  };

  const getCTAAlignment = () => {
    switch (wireframe_data.cta.align) {
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
    return `${wireframe_data.separator.width_percent}%`;
  };

  return (
    <Card className={`bg-gradient-to-br from-white to-gray-50 shadow-xl border-0 overflow-hidden ${className}`}>
      <CardContent className="p-0">
        {/* Container principal com fundo gradiente */}
        <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8 min-h-[500px] relative">
          {/* Pattern de fundo sutil */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 100 100">
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
              <rect width="100" height="100" fill="url(#grid)"/>
            </svg>
          </div>

          <div className="relative z-10">
            {/* Logo */}
            <div className={`flex ${getLogoPosition()} mb-8`}>
              <div className={`${getLogoSize()} bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg flex items-center justify-center`}>
                <span className="text-white font-bold text-sm tracking-wide">LOGO</span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h1 className={`text-3xl lg:text-4xl ${getTitleWeight()} text-gray-900 leading-tight max-w-4xl mx-auto`}>
                {wireframe_data.title.text}
              </h1>
            </div>

            {/* Subtitle */}
            <div className="text-center mb-8">
              <p className={`text-lg lg:text-xl ${getSubtitleWeight()} text-gray-700 leading-relaxed max-w-3xl mx-auto`}>
                {wireframe_data.subtitle.text}
              </p>
            </div>

            {/* Persona/Product Tag */}
            <div className="flex justify-center mb-8">
              <div 
                className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold text-gray-900 shadow-lg"
                style={{ backgroundColor: wireframe_data.persona_product.bg_color }}
              >
                <span className="uppercase tracking-wide">
                  {wireframe_data.persona_product.label}
                </span>
              </div>
            </div>

            {/* Separator */}
            {wireframe_data.separator.visible && (
              <div className="flex justify-center mb-8">
                <hr 
                  className="border-2 border-gradient-to-r from-blue-400 to-purple-400 rounded-full" 
                  style={{ width: getSeparatorWidth() }} 
                />
              </div>
            )}

            {/* CTA Button */}
            <div className={`flex ${getCTAAlignment()}`}>
              <button 
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300"
                disabled
              >
                <span className="relative z-10 uppercase tracking-wide text-sm">
                  {wireframe_data.cta.label}
                </span>
                {/* Efeito de brilho no hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out"></div>
              </button>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-50"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-50"></div>
          <div className="absolute top-1/2 right-8 w-8 h-8 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full opacity-40"></div>
        </div>

        {/* Footer com informações do wireframe */}
        <div className="bg-gray-900 text-white p-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium text-green-400">WIREFRAME APROVADO</span>
            </div>
            <div className="text-gray-400">
              Objetivo: {wireframe_data.cta.objective_mapped}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WireframeHTMLPreview;