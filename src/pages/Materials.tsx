import { useState, useEffect } from "react";

import { MaterialsMasonry } from "@/components/MaterialsMasonry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Grid3X3,
  List,
  Image as ImageIcon,
  Video,
  FileText,
  Layers,
  Play,
  Upload
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'carousel';
  status: 'approved' | 'pending' | 'needs_adjustment' | 'rejected';
  comments: number;
  thumbnail?: string;
  file_url?: string;
  metadata?: any;
  project?: string;
  company?: string;
  is_running?: boolean;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'image' | 'video' | 'pdf' | 'carousel';
type CompanyFilter = 'all' | string;

const Materials = () => {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<string[]>([]);
  const { toast } = useToast();

  // Atualizar searchTerm quando a URL mudar
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const loadMaterials = async () => {
    try {
      setLoading(true);

      // Buscar materiais com suas relações
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select(`
          id,
          name,
          type,
          status,
          file_url,
          thumbnail_url,
          is_running,
          metadata,
          projects(
            name,
            companies(name)
          )
        `)
        .eq('is_briefing', false)
        .not('file_url', 'is', null)
        .order('created_at', { ascending: false });

      if (materialsError) {
        console.error('Erro na query de materiais:', materialsError);
        throw materialsError;
      }

      console.log('Dados dos materiais carregados:', materialsData);

      // Processar os dados para o formato esperado
      const processedMaterials: Material[] = (materialsData || []).map(material => {
        // Priorizar o tipo do banco, usar detecção como fallback
        let materialType: 'image' | 'video' | 'pdf' | 'carousel' = material.type as 'image' | 'video' | 'pdf' | 'carousel' || 'image';

        // Se o tipo do banco for 'image' mas não for realmente uma imagem, detectar o correto
        if (materialType === 'image') {
          const fileName = material.name?.toLowerCase() || '';
          const fileUrl = material.file_url?.toLowerCase() || '';
          const mimeType = material.metadata?.mimetype || material.metadata?.mime_type || '';

          // Verificar mime type no metadata
          if (mimeType.includes('video')) {
            materialType = 'video';
          }
          // Verificar extensões de vídeo
          else if (fileName.includes('video') ||
            fileUrl.includes('.mp4') || fileUrl.includes('.mov') ||
            fileUrl.includes('.avi') || fileUrl.includes('.webm') ||
            fileName.includes('.mp4') || fileName.includes('.mov') ||
            fileName.includes('.avi') || fileName.includes('.webm')) {
            materialType = 'video';
          }
          // Verificar extensões de PDF
          else if (fileName.includes('pdf') || fileUrl.includes('.pdf') ||
            mimeType.includes('pdf')) {
            materialType = 'pdf';
          }
        }

        console.log('Material processado:', {
          id: material.id,
          name: material.name,
          detectedType: materialType,
          originalType: material.type,
          fileUrl: material.file_url
        });

        return {
          id: material.id,
          name: material.name,
          type: materialType,
          status: material.status as 'approved' | 'pending' | 'needs_adjustment' | 'rejected',
          comments: 0, // Pode ser implementado depois contando os comments
          thumbnail: material.thumbnail_url || material.file_url, // Priorizar thumbnail_url
          file_url: material.file_url,
          project: material.projects?.name || 'Projeto não encontrado',
          company: material.projects?.companies?.name || 'Empresa não encontrada',
          is_running: material.is_running ?? true
        };
      });

      setMaterials(processedMaterials);

      // Extrair lista única de empresas
      const uniqueCompanies = Array.from(new Set(
        processedMaterials.map(m => m.company).filter(Boolean)
      ));
      setCompanies(uniqueCompanies);

    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar materiais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (material.project && material.project.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || material.type === filterType;
    const matchesCompany = companyFilter === 'all' || material.company === companyFilter;
    return matchesSearch && matchesFilter && matchesCompany;
  });

  const stats = {
    total: materials.length,
    images: materials.filter(m => m.type === 'image').length,
    videos: materials.filter(m => m.type === 'video').length,
    pdfs: materials.filter(m => m.type === 'pdf').length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-6">Materiais</h1>
      </div>

      {/* Stats Cards Row with Upload Button */}
      <div className="flex items-center gap-4">
        {/* Stats Cards Container */}
        <div className="flex gap-5 flex-wrap">
          <Card
            className="bg-white border-[#EBEBEB] dark:bg-primary/15 dark:border-primary/35"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04), inset 0px -1px 0px rgba(0, 0, 0, 0.02)',
              transition: 'none',
              width: 'auto',
              minWidth: '240px',
              flexShrink: 0,
              flexGrow: 0
            }}
          >
            <CardContent className="bg-primary/5 dark:bg-primary/20" style={{ padding: '28px 24px' }}>
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl">
                  <Layers className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-col text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-4xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-white border-[#EBEBEB] dark:bg-primary/15 dark:border-primary/35"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04), inset 0px -1px 0px rgba(0, 0, 0, 0.02)',
              transition: 'none',
              width: 'auto',
              minWidth: '240px',
              flexShrink: 0,
              flexGrow: 0
            }}
          >
            <CardContent className="bg-primary/5 dark:bg-primary/20" style={{ padding: '28px 24px' }}>
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl">
                  <ImageIcon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-col text-right">
                  <p className="text-xs text-muted-foreground">Imagens</p>
                  <p className="text-4xl font-bold text-foreground">{stats.images}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-white border-[#EBEBEB] dark:bg-primary/15 dark:border-primary/35"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04), inset 0px -1px 0px rgba(0, 0, 0, 0.02)',
              transition: 'none',
              width: 'auto',
              minWidth: '240px',
              flexShrink: 0,
              flexGrow: 0
            }}
          >
            <CardContent className="bg-primary/5 dark:bg-primary/20" style={{ padding: '28px 24px' }}>
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl">
                  <Play className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-col text-right">
                  <p className="text-xs text-muted-foreground">Vídeos</p>
                  <p className="text-4xl font-bold text-foreground">{stats.videos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="bg-white border-[#EBEBEB] dark:bg-primary/15 dark:border-primary/35"
            style={{
              borderRadius: '12px',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04), inset 0px -1px 0px rgba(0, 0, 0, 0.02)',
              transition: 'none',
              width: 'auto',
              minWidth: '240px',
              flexShrink: 0,
              flexGrow: 0
            }}
          >
            <CardContent className="bg-primary/5 dark:bg-primary/20" style={{ padding: '28px 24px' }}>
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-col text-right">
                  <p className="text-xs text-muted-foreground">PDFs</p>
                  <p className="text-4xl font-bold text-foreground">{stats.pdfs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Button */}
        <Button
          size="icon"
          className="rounded-full h-12 w-12 shrink-0"
        >
          <Upload className="h-5 w-5" />
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar materiais..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Company Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Empresa:</span>
            <Button
              variant={companyFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCompanyFilter('all')}
              className="rounded-full"
            >
              Todas
            </Button>
            {companies.map((company) => (
              <Button
                key={company}
                variant={companyFilter === company ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompanyFilter(company)}
                className="rounded-full text-xs"
              >
                {company}
              </Button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Tipo:</span>
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setFilterType('all')}
            >
              Todos
            </Button>
            <Button
              variant={filterType === 'image' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setFilterType('image')}
            >
              <ImageIcon className="h-3 w-3 mr-1" />
              Imagens
            </Button>
            <Button
              variant={filterType === 'video' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setFilterType('video')}
            >
              <Video className="h-3 w-3 mr-1" />
              Vídeos
            </Button>
            <Button
              variant={filterType === 'pdf' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setFilterType('pdf')}
            >
              <FileText className="h-3 w-3 mr-1" />
              PDFs
            </Button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredMaterials.length} de {stats.total} materiais
        </p>
      </div>

      {/* Materials Display */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando materiais...</p>
          </CardContent>
        </Card>
      ) : filteredMaterials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {materials.length === 0
                ? "Nenhum material encontrado. Faça o upload do seu primeiro material!"
                : "Nenhum material encontrado com os filtros aplicados."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <MaterialsMasonry materials={filteredMaterials} />
      )}
    </div>
  );
};

export default Materials;
