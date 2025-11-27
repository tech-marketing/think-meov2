import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, CreditCard, Layout } from "lucide-react";

interface WireframeTemplateSelectorProps {
  onSelectTemplate: (type: 'default' | 'news' | 'card') => void;
}

export const WireframeTemplateSelector: React.FC<WireframeTemplateSelectorProps> = ({
  onSelectTemplate
}) => {
  const templates = [
    {
      type: 'default' as const,
      name: 'Padrão',
      description: 'Layout tradicional com logo, título, subtítulo e CTA',
      icon: Layout,
      image: null
    },
    {
      type: 'news' as const,
      name: 'Notícia',
      description: 'Formato de notícia com fonte',
      icon: Newspaper,
      image: '/wireframe-templates/news.png'
    },
    {
      type: 'card' as const,
      name: 'Card',
      description: 'Card simples com texto destacado',
      icon: CreditCard,
      image: '/wireframe-templates/card-1.png'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <Card 
            key={template.type}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onSelectTemplate(template.type)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">{template.name}</h3>
              </div>
              
              {template.image && (
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={template.image} 
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {!template.image && (
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">{template.description}</p>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTemplate(template.type);
                }}
              >
                Usar Template
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
