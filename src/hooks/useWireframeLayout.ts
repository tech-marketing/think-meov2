import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WireframeElement {
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
}

export interface WireframeContent {
  title: string;
  subtitle: string;
  persona: string;
  ctaLabel: string;
  newsTitle?: string;
  sourceLabel?: string;
  cardText?: string;
}

export interface WireframeLayout {
  elements: WireframeElement[];
  content: WireframeContent;
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

interface LayoutVersion {
  id: string;
  version: number;
  layout: WireframeLayout;
  createdAt: string;
  createdBy: string;
}

interface UseWireframeLayoutProps {
  creativeId: string;
  aspectRatio: string;
  initialWireframe?: any;
}

export const useWireframeLayout = ({ 
  creativeId, 
  aspectRatio, 
  initialWireframe 
}: UseWireframeLayoutProps) => {
  const { toast } = useToast();
  const [layout, setLayout] = useState<WireframeLayout | null>(null);
  const [versions, setVersions] = useState<LayoutVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Generate layout key for persistence
  const getLayoutKey = useCallback(() => {
    return `${creativeId}_${aspectRatio}`;
  }, [creativeId, aspectRatio]);

  // Template generators for different types
  const createAdvertorialTemplate = (): WireframeLayout => ({
    elements: [
      { id: 'logo', role: 'logo', left: 40, top: 5, width: 20, height: 8, zIndex: 1 },
      { id: 'persona', role: 'persona', personType: 'human', personColor: '#9333EA', left: 15, top: 25, width: 25, height: 35, zIndex: 2 },
      { id: 'title', role: 'title', left: 45, top: 25, width: 45, height: 15, zIndex: 2 },
      { id: 'subtitle', role: 'subtitle', left: 45, top: 45, width: 45, height: 10, zIndex: 2 },
      { id: 'separator', role: 'separator', left: 15, top: 65, width: 75, height: 1, zIndex: 3 },
      { id: 'cta', role: 'cta', left: 30, top: 75, width: 40, height: 10, zIndex: 4 }
    ],
    content: { title: 'Título Principal', subtitle: 'Subtítulo explicativo', persona: 'Persona', ctaLabel: 'Saiba Mais' },
    meta: { snapToGrid: false, gridSize: 8, aspectRatio, layoutType: 'advertorial', editedAt: new Date().toISOString(), version: 1 }
  });

  const createNewsTemplate = (): WireframeLayout => ({
    elements: [
      { id: 'news-title', role: 'news-title', left: 10, top: 8, width: 80, height: 12, zIndex: 1 },
      { id: 'separator', role: 'separator', left: 0, top: 21, width: 100, height: 0.5, zIndex: 2 },
      { id: 'persona', role: 'persona', personType: 'human', personColor: '#9333EA', left: 37.5, top: 35, width: 25, height: 30, zIndex: 3 },
      { id: 'source', role: 'source-label', left: 15, top: 72, width: 70, height: 8, zIndex: 4 }
    ],
    content: { title: '', subtitle: '', persona: '', ctaLabel: '', newsTitle: 'Título da Notícia', sourceLabel: 'Fonte: Portal de Notícias' },
    meta: { snapToGrid: false, gridSize: 8, aspectRatio, layoutType: 'news', editedAt: new Date().toISOString(), version: 1 }
  });

  const createCardTemplate = (): WireframeLayout => ({
    elements: [
      { id: 'card-text', role: 'card-text', left: 20, top: 10, width: 60, height: 35, zIndex: 1 },
      { id: 'separator', role: 'separator', left: 10, top: 50, width: 80, height: 1, zIndex: 2 },
      { id: 'logo', role: 'logo', left: 15, top: 60, width: 25, height: 12, zIndex: 3 }
    ],
    content: { title: '', subtitle: '', persona: '', ctaLabel: '', cardText: 'Texto do card com mensagem principal' },
    meta: { snapToGrid: false, gridSize: 8, aspectRatio, layoutType: 'card', editedAt: new Date().toISOString(), version: 1 }
  });

  // Initialize default layout from wireframe data
  const initializeDefaultLayout = useCallback((): WireframeLayout => {
    if (!initialWireframe) {
      console.warn('No initial wireframe data provided, using default layout');
      return {
        elements: [
          { id: 'title', role: 'title', left: 5, top: 20, width: 90, height: 15, zIndex: 1 }
        ],
        content: { title: 'Título do Anúncio', subtitle: '', persona: '', ctaLabel: 'Saiba Mais' },
        meta: { snapToGrid: false, gridSize: 8, aspectRatio, editedAt: new Date().toISOString(), version: 1 }
      };
    }

    // Novo formato: se já vier com elements array, usar diretamente
    if (Array.isArray(initialWireframe.elements)) {
      return {
        elements: initialWireframe.elements,
        content: initialWireframe.content || {
          title: '',
          subtitle: '',
          persona: '',
          ctaLabel: ''
        },
        meta: initialWireframe.meta || {
          snapToGrid: false,
          gridSize: 8,
          aspectRatio,
          editedAt: new Date().toISOString(),
          version: 1
        }
      };
    }

    // Formato antigo: converter para novo formato
    const elements: WireframeElement[] = [
      {
        id: 'logo',
        role: 'logo',
        left: initialWireframe.logo?.position === 'top-left' ? 5 : 
              initialWireframe.logo?.position === 'top-right' ? 75 : 42.5,
        top: 5,
        width: initialWireframe.logo?.size === 'small' ? 15 : 
               initialWireframe.logo?.size === 'large' ? 25 : 20,
        height: 8,
        zIndex: 1
      },
      {
        id: 'title',
        role: 'title',
        left: 5,
        top: 20,
        width: 90,
        height: 12,
        zIndex: 2
      },
      {
        id: 'subtitle',
        role: 'subtitle',
        left: 5,
        top: 35,
        width: 90,
        height: 8,
        zIndex: 2
      },
      {
        id: 'persona',
        role: 'persona',
        personType: 'human',
        personColor: '#9333EA',
        left: 35,
        top: 50,
        width: 30,
        height: 6,
        zIndex: 3
      },
      {
        id: 'separator',
        role: 'separator',
        left: 20,
        top: 65,
        width: 60,
        height: 1,
        zIndex: 3
      },
      {
        id: 'cta',
        role: 'cta',
        left: 25,
        top: 80,
        width: 50,
        height: 8,
        zIndex: 4
      }
    ];

    return {
      elements,
      content: {
        title: initialWireframe.title?.text || '',
        subtitle: initialWireframe.subtitle?.text || '',
        persona: initialWireframe.persona_product?.label || '',
        ctaLabel: initialWireframe.cta?.label || ''
      },
      meta: {
        snapToGrid: false,
        gridSize: 8,
        aspectRatio,
        editedAt: new Date().toISOString(),
        version: 1
      }
    };
  }, [initialWireframe, aspectRatio]);

  // Load layout from storage
  const loadLayout = useCallback(async () => {
    try {
      setLoading(true);
      const layoutKey = getLayoutKey();

      // Use localStorage for now (until we create the database table)
      const savedLayout = localStorage.getItem(`wireframe_layout_${layoutKey}`);
      if (savedLayout) {
        try {
          setLayout(JSON.parse(savedLayout));
        } catch (e) {
          console.error('Error parsing saved layout:', e);
          setLayout(initializeDefaultLayout());
        }
      } else {
        setLayout(initializeDefaultLayout());
      }
    } catch (error) {
      console.error('Error loading layout:', error);
      setLayout(initializeDefaultLayout());
    } finally {
      setLoading(false);
    }
  }, [getLayoutKey, initializeDefaultLayout]);

  // Save layout to storage
  const saveLayout = useCallback(async (newLayout: WireframeLayout, createVersion = false) => {
    try {
      setSaving(true);
      const layoutKey = getLayoutKey();
      const updatedLayout = {
        ...newLayout,
        meta: {
          ...newLayout.meta,
          editedAt: new Date().toISOString(),
          version: createVersion ? newLayout.meta.version + 1 : newLayout.meta.version
        }
      };

      // Save to localStorage (until we create the database table)
      localStorage.setItem(`wireframe_layout_${layoutKey}`, JSON.stringify(updatedLayout));
      
      // Also save versions history in localStorage
      const versionsKey = `wireframe_versions_${creativeId}_${aspectRatio}`;
      const existingVersions = JSON.parse(localStorage.getItem(versionsKey) || '[]');
      const newVersions = [
        ...existingVersions.filter((v: any) => v.version !== updatedLayout.meta.version),
        {
          id: `${layoutKey}_v${updatedLayout.meta.version}`,
          version: updatedLayout.meta.version,
          layout: updatedLayout,
          createdAt: updatedLayout.meta.editedAt,
          createdBy: 'Usuário Atual'
        }
      ].sort((a: any, b: any) => b.version - a.version);
      
      localStorage.setItem(versionsKey, JSON.stringify(newVersions));

      toast({
        title: "Layout salvo!",
        description: "Suas alterações foram salvas com sucesso."
      });

      setLayout(updatedLayout);
      return updatedLayout;
    } catch (error) {
      console.error('Error saving layout:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar layout. Verifique sua conexão.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [getLayoutKey, creativeId, aspectRatio, toast]);

  // Load versions history
  const loadVersions = useCallback(async () => {
    try {
      const versionsKey = `wireframe_versions_${creativeId}_${aspectRatio}`;
      const savedVersions = localStorage.getItem(versionsKey);
      
      if (savedVersions) {
        const versionsList: LayoutVersion[] = JSON.parse(savedVersions);
        setVersions(versionsList);
      } else {
        setVersions([]);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      setVersions([]);
    }
  }, [creativeId, aspectRatio]);

  // Restore version
  const restoreVersion = useCallback(async (versionLayout: WireframeLayout) => {
    try {
      const restoredLayout = await saveLayout(versionLayout, true);
      toast({
        title: "Versão restaurada!",
        description: `Layout da versão ${versionLayout.meta.version} foi restaurado.`
      });
      return restoredLayout;
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        title: "Erro",
        description: "Erro ao restaurar versão do layout.",
        variant: "destructive"
      });
    }
  }, [saveLayout, toast]);

  // Auto-save functionality
  const autoSave = useCallback(async (newLayout: WireframeLayout) => {
    try {
      const layoutKey = getLayoutKey();
      localStorage.setItem(`wireframe_layout_${layoutKey}`, JSON.stringify(newLayout));
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, [getLayoutKey]);

  // Initialize
  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  return {
    layout,
    setLayout,
    loading,
    saving,
    versions,
    saveLayout,
    loadVersions,
    restoreVersion,
    autoSave,
    createAdvertorialTemplate,
    createNewsTemplate,
    createCardTemplate
  };
};