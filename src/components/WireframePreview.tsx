import React from 'react';

interface WireframePreviewProps {
  wireframe_data: any;
  className?: string;
}

export const WireframePreview: React.FC<WireframePreviewProps> = ({ wireframe_data, className }) => {
  if (!wireframe_data) {
    return (
      <div className={`bg-muted/50 p-4 rounded-lg border border-muted ${className}`}>
        <p className="text-sm text-muted-foreground">Dados do wireframe não disponíveis</p>
      </div>
    );
  }

  // Helper to safely get text content whether it's a string or an object
  const getText = (field: any) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    return field.text || field.label || null;
  };

  const title = getText(wireframe_data.title);
  const subtitle = getText(wireframe_data.subtitle);
  const cta = getText(wireframe_data.cta);
  const personaProduct = getText(wireframe_data.persona_product);
  const imageUrl = wireframe_data.image_url;

  return (
    <div className={`bg-gradient-to-br from-accent/20 to-accent/5 p-4 rounded-lg border border-accent/30 ${className}`}>
      <div className="space-y-3">
        {/* Wireframe Info Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-accent rounded-full"></div>
          <span className="text-xs font-medium text-accent">WIREFRAME</span>
        </div>

        {/* Generated Image (if available) */}
        {imageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden border border-border/50 shadow-sm">
            <img
              src={imageUrl}
              alt="Generated Preview"
              className="w-full h-auto object-cover max-h-[300px]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Título:</p>
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Subtítulo:</p>
            <p className="text-sm text-foreground">{subtitle}</p>
          </div>
        )}

        {/* CTA */}
        {cta && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Call to Action:</p>
            <p className="text-sm font-medium text-primary">{cta}</p>
          </div>
        )}

        {/* Persona/Product */}
        {personaProduct && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">
              {wireframe_data.persona_product?.type === 'persona' ? 'Persona:' : 'Produto/Info:'}
            </p>
            <p className="text-sm text-foreground">{personaProduct}</p>
          </div>
        )}

        {/* Meta info */}
        <div className="pt-2 border-t border-accent/20">
          <p className="text-xs text-muted-foreground italic">
            {imageUrl ? 'Preview gerado com IA' : 'Wireframe com layout estrutural definido'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WireframePreview;