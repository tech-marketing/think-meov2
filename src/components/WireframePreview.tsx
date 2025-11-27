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

  return (
    <div className={`bg-gradient-to-br from-accent/20 to-accent/5 p-4 rounded-lg border border-accent/30 ${className}`}>
      <div className="space-y-3">
        {/* Wireframe Info Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-accent rounded-full"></div>
          <span className="text-xs font-medium text-accent">WIREFRAME APROVADO</span>
        </div>

        {/* Title */}
        {wireframe_data.title?.text && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Título:</p>
            <p className="text-sm font-semibold text-foreground">{wireframe_data.title.text}</p>
          </div>
        )}

        {/* Subtitle */}
        {wireframe_data.subtitle?.text && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Subtítulo:</p>
            <p className="text-sm text-foreground">{wireframe_data.subtitle.text}</p>
          </div>
        )}

        {/* CTA */}
        {wireframe_data.cta?.label && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">Call to Action:</p>
            <p className="text-sm font-medium text-primary">{wireframe_data.cta.label}</p>
          </div>
        )}

        {/* Persona/Product */}
        {wireframe_data.persona_product?.label && (
          <div className="bg-background/80 p-2 rounded border">
            <p className="text-xs font-medium text-foreground/60 mb-1">
              {wireframe_data.persona_product.type === 'persona' ? 'Persona:' : 'Produto:'}
            </p>
            <p className="text-sm text-foreground">{wireframe_data.persona_product.label}</p>
          </div>
        )}

        {/* Meta info */}
        <div className="pt-2 border-t border-accent/20">
          <p className="text-xs text-muted-foreground italic">
            Wireframe com layout estrutural definido
          </p>
        </div>
      </div>
    </div>
  );
};

export default WireframePreview;