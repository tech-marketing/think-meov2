import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MaterialsGrid } from "@/components/MaterialsGrid";
import { ProjectParticipants } from "@/components/ProjectParticipants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Filter,
  Search,
  Grid3X3,
  List,
  Image,
  Video,
  FileText,
  Users,
  Calendar,
  Building,
  ArrowLeft,
  MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BriefingSection } from "@/components/BriefingSection";
import { BriefingApprovedSection } from "@/components/BriefingApprovedSection";
import { BriefingComments } from "@/components/BriefingComments";
import { DeleteProjectModal } from "@/components/DeleteProjectModal";
import { useMaterials } from "@/contexts/MaterialsContext";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
  status: 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval' | 'internal_approval' | 'processing' | 'failed';
  comments: number;
  thumbnail?: string;
  file_url?: string;
  project?: string;
  company?: string;
  is_running?: boolean;
  is_briefing?: boolean; // Added for briefings
}

interface Project {
  id: string;
  name: string;
  description?: string;
  company: string;
  dueDate: string;
  status: string;
  createdBy: string;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'image' | 'video' | 'pdf' | 'wireframe';
type StatusFilter = 'all' | 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval' | 'internal_approval';
type RunningFilter = 'all' | 'running' | 'available';
type SectionFilter = 'all' | 'materials' | 'briefings'; // Added for filtering materials vs briefings

const ProjectView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { materialsVersion } = useMaterials();
  const [project, setProject] = useState<Project | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [runningFilter, setRunningFilter] = useState<RunningFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('materials'); // Default to materials only
  const [showParticipants, setShowParticipants] = useState(true);
  const [activeSection, setActiveSection] = useState<'briefing' | 'briefing-approved' | 'materials'>('materials');
  const [briefingsApprovedCount, setBriefingsApprovedCount] = useState(0);
  const [currentBriefing, setCurrentBriefing] = useState<{ caption?: string; id?: string } | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Limpar briefing atual quando mudar de seção
  useEffect(() => {
    if (activeSection !== 'briefing') {
      setCurrentBriefing(null);
    }
  }, [activeSection]);

  const loadProject = async () => {
    if (!id) return;

    try {
      setLoading(true);

      console.log('Loading project with ID:', id);
      console.log('Current user profile:', profile);

      // Buscar dados do projeto
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          companies!inner(name)
        `)
        .eq('id', id)
        .maybeSingle();

      console.log('Project query result:', { projectData, projectError });

      if (projectError) {
        console.error('Project query error:', projectError);
        throw projectError;
      }

      // Se não encontrou o projeto, não processar nada
      if (!projectData) {
        console.log('No project data found');
        setProject(null);
        setMaterials([]);
        return;
      }

      // Buscar materiais e briefings do projeto
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, type, status, file_url, thumbnail_url, is_running, is_briefing')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (materialsError) throw materialsError;

      // Processar dados do projeto
      let dueDate = 'Sem prazo definido';
      if (projectData.due_date) {
        const date = new Date(projectData.due_date);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          dueDate = 'Hoje';
        } else if (diffDays === 1) {
          dueDate = 'Amanhã';
        } else if (diffDays > 1) {
          dueDate = `Em ${diffDays} dias`;
        } else {
          dueDate = `${Math.abs(diffDays)} dias atrás`;
        }
      }

      // Buscar informações do criador do projeto
      let createdByName = 'Usuário não encontrado';
      if (projectData && projectData.created_by) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', projectData.created_by)
          .maybeSingle();

        if (creatorProfile) {
          createdByName = creatorProfile.full_name;
        }
      }

      const processedProject: Project = {
        id: projectData.id,
        name: projectData.name,
        description: projectData.description,
        company: projectData.companies?.name || 'Empresa não encontrada',
        dueDate,
        status: projectData.status,
        createdBy: createdByName
      };

      // Processar materiais
      const processedMaterials: Material[] = (materialsData || []).map(material => {
        // Priorizar o tipo do banco, usar detecção como fallback
        let materialType: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel' = material.type as Material['type'] || 'image';

        // Map legacy 'copy' type to 'wireframe'
        if (material.type === 'copy') {
          materialType = 'wireframe';
        }

        // Se o tipo do banco for 'image' mas não for realmente uma imagem, detectar o correto
        if (materialType === 'image') {
          const fileName = material.name?.toLowerCase() || '';
          const fileUrl = material.file_url?.toLowerCase() || '';
          // Verificar extensões de vídeo
          if (fileName.includes('video') ||
            fileUrl.includes('.mp4') || fileUrl.includes('.mov') ||
            fileUrl.includes('.avi') || fileUrl.includes('.webm') ||
            fileName.includes('.mp4') || fileName.includes('.mov') ||
            fileName.includes('.avi') || fileName.includes('.webm')) {
            materialType = 'video';
          }
          // Verificar extensões de PDF
          else if (fileName.includes('pdf') || fileUrl.includes('.pdf') ||
            fileName.includes('.pdf')) {
            materialType = 'pdf';
          }
        }

        return {
          id: material.id,
          name: material.name,
          type: materialType,
          status: material.status as Material['status'],
          comments: 0, // TODO: contar comentários
          thumbnail: material.thumbnail_url || material.file_url,
          file_url: material.file_url,
          is_running: material.is_running ?? true,
          project: projectData.name,
          company: projectData.companies?.name
        };
      });

      // Buscar briefings aprovados para contar (excluir os que já foram convertidos em materiais)
      const { data: briefingsApprovedData, error: briefingsApprovedError } = await supabase
        .from('materials')
        .select('id, wireframe_data, caption')
        .eq('project_id', id)
        .eq('type', 'wireframe')
        .eq('is_briefing', true)
        .eq('briefing_approved_by_client', true);

      if (!briefingsApprovedError && briefingsApprovedData) {
        // Buscar materiais que foram criados a partir de briefings aprovados
        const { data: convertedMaterials, error: convertedError } = await supabase
          .from('materials')
          .select('wireframe_data, caption')
          .eq('project_id', id)
          .eq('is_briefing', false);

        if (!convertedError && convertedMaterials) {
          // Filtrar briefings que já foram convertidos em materiais
          const availableBriefings = briefingsApprovedData.filter(briefing => {
            return !convertedMaterials.some(material =>
              JSON.stringify(material.wireframe_data) === JSON.stringify(briefing.wireframe_data) &&
              material.caption === briefing.caption
            );
          });
          setBriefingsApprovedCount(availableBriefings.length);
        } else {
          setBriefingsApprovedCount(briefingsApprovedData.length);
        }
      } else {
        setBriefingsApprovedCount(0);
      }

      // Definir os dados do projeto processado
      setProject(processedProject);
      setMaterials(processedMaterials);
      console.log('Project loaded successfully:', processedProject);

    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id, materialsVersion]);

  useEffect(() => {
    const filtered = materials.filter(material => {
      const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || material.type === filterType;

      // Section filter (materials vs briefings)
      let matchesSection = true;
      if (sectionFilter === 'materials') {
        matchesSection = !material.is_briefing;
      } else if (sectionFilter === 'briefings') {
        matchesSection = material.is_briefing === true;
      }

      // Corrigir filtro de status para incluir tanto needs_adjustment quanto rejected
      let matchesStatus = statusFilter === 'all';
      if (statusFilter === 'needs_adjustment') {
        matchesStatus = material.status === 'needs_adjustment' || material.status === 'rejected';
      } else if (statusFilter !== 'all') {
        matchesStatus = material.status === statusFilter;
      }

      // Aplicar filtro de is_running apenas quando statusFilter === 'client_approval'
      let matchesRunning = true;
      if (statusFilter === 'client_approval' && runningFilter !== 'all') {
        matchesRunning = runningFilter === 'running'
          ? material.is_running === true
          : material.is_running === false;
      }

      return matchesSearch && matchesFilter && matchesSection && matchesStatus && matchesRunning;
    });
    setFilteredMaterials(filtered);
  }, [materials, searchTerm, filterType, sectionFilter, statusFilter, runningFilter]);

  const stats = {
    total: materials.length,
    images: materials.filter(m => m.type === 'image').length,
    videos: materials.filter(m => m.type === 'video').length,
    pdfs: materials.filter(m => m.type === 'pdf').length,
    wireframes: materials.filter(m => m.type === 'wireframe').length,
    approved: materials.filter(m => m.status === 'approved').length,
    pending: materials.filter(m => m.status === 'pending').length,
    needsAdjustment: materials.filter(m => m.status === 'needs_adjustment' || m.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando projeto...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Projeto não encontrado</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar com participantes e navegação */}
          {showParticipants && (
            <div className="w-80 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 w-full justify-start hover:bg-accent/50 transition-all duration-200 group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
                <span className="text-sm font-medium">Voltar</span>
              </Button>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participantes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectParticipants projectId={project.id} />
                </CardContent>
              </Card>

              {/* Menu de navegação entre seções */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Navegação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant={activeSection === 'briefing' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('briefing')}
                  >
                    Briefings
                  </Button>
                  <Button
                    variant={activeSection === 'briefing-approved' ? 'default' : 'ghost'}
                    className="w-full justify-start relative"
                    onClick={() => setActiveSection('briefing-approved')}
                  >
                    Briefings Aprovados
                    {briefingsApprovedCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 w-5 p-0 text-xs rounded-full flex items-center justify-center"
                      >
                        {briefingsApprovedCount || 0}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant={activeSection === 'materials' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('materials')}
                  >
                    Materiais
                  </Button>
                </CardContent>
              </Card>

              {/* Legenda/Descrição do Briefing */}
              {currentBriefing?.caption && (
                <Card className="border-primary/20 bg-primary-light/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-primary">Legenda/Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground leading-relaxed">
                      {currentBriefing.caption}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Comentários do Briefing */}
              {currentBriefing?.id && (
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm text-foreground">Comentários</CardTitle>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        0
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <BriefingComments
                      briefingId={currentBriefing.id}
                      projectId={project.id}
                      noCard={true}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Conteúdo principal */}
          <div className="flex-1 space-y-6">
            {/* Header do projeto */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{project.name}</h1>
                    {project.description && (
                      <p className="text-muted-foreground">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {project.company}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {project.dueDate}
                      </div>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status === 'active' ? 'Ativo' : project.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile && (profile.role === 'admin' || profile.role === 'collaborator') && (
                      <DeleteProjectModal
                        projectId={project.id}
                        projectName={project.name}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowParticipants(!showParticipants)}
                    >
                      <Users className="h-4 w-4" />
                      {showParticipants ? 'Ocultar' : 'Mostrar'} Participantes
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Conteúdo condicional baseado na seção ativa */}
            {activeSection === 'briefing' && (
              <Card className="border-0">
                <CardContent className="p-6">
                  <BriefingSection
                    projectId={project.id}
                    onBriefingView={setCurrentBriefing}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === 'briefing-approved' && (
              <Card className="border-0">
                <CardContent className="p-6">
                  <BriefingApprovedSection
                    projectId={project.id}
                    onMaterialCreated={loadProject}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === 'materials' && (
              <Card className="border-0">
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">Materiais</h3>
                        <p className="text-sm text-muted-foreground">
                          Materiais finais do projeto
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === 'grid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('grid')}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Section Filter - Materials vs Briefings */}
                    <div className="flex items-center gap-2 mb-4">
                      <Button
                        variant={sectionFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSectionFilter('all')}
                      >
                        Todos
                      </Button>
                      <Button
                        variant={sectionFilter === 'materials' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSectionFilter('materials')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Materiais
                      </Button>
                      <Button
                        variant={sectionFilter === 'briefings' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSectionFilter('briefings')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Briefings
                      </Button>
                    </div>

                    {/* Stats Cards - Materiais */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Card
                        className={`cursor-pointer transition-all duration-200 ${statusFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'
                          }`}
                        onClick={() => setStatusFilter('all')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-2xl font-bold">{stats.total}</p>
                              <p className="text-xs text-muted-foreground leading-tight">Total</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all duration-200 ${statusFilter === 'client_approval' ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                          }`}
                        onClick={() => {
                          setStatusFilter(statusFilter === 'client_approval' ? 'all' : 'client_approval');
                          setRunningFilter('all');
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <div className="h-4 w-4 rounded-full bg-blue-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-2xl font-bold ${statusFilter === 'client_approval' ? 'text-blue-700' : ''}`}>{materials.filter(m => m.status === 'client_approval').length}</p>
                              <p className={`text-xs leading-tight ${statusFilter === 'client_approval' ? 'text-blue-600' : 'text-muted-foreground'}`}>Aprovados Cliente</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all duration-200 ${statusFilter === 'internal_approval' ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
                          }`}
                        onClick={() => setStatusFilter(statusFilter === 'internal_approval' ? 'all' : 'internal_approval')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <div className="h-4 w-4 rounded-full bg-purple-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-2xl font-bold ${statusFilter === 'internal_approval' ? 'text-purple-700' : ''}`}>{materials.filter(m => m.status === 'internal_approval').length}</p>
                              <p className={`text-xs leading-tight ${statusFilter === 'internal_approval' ? 'text-purple-600' : 'text-muted-foreground'}`}>Aprovados Interno</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all duration-200 ${statusFilter === 'pending' ? 'ring-2 ring-warning bg-warning/5' : ''
                          }`}
                        onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-warning/10 rounded-lg">
                              <div className="h-4 w-4 rounded-full bg-warning" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-2xl font-bold">{stats.pending}</p>
                              <p className="text-xs text-muted-foreground leading-tight">Pendentes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all duration-200 ${statusFilter === 'needs_adjustment' ? 'ring-2 ring-destructive bg-destructive/5' : ''
                          }`}
                        onClick={() => setStatusFilter(statusFilter === 'needs_adjustment' ? 'all' : 'needs_adjustment')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-destructive/10 rounded-lg">
                              <div className="h-4 w-4 rounded-full bg-destructive" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-2xl font-bold">{stats.needsAdjustment}</p>
                              <p className="text-xs text-muted-foreground leading-tight">Ajustes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sub-filtros para "Aprovados Cliente" */}
                    {statusFilter === 'client_approval' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Filtrar por:</span>
                        <Button
                          variant={runningFilter === 'available' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRunningFilter('available')}
                        >
                          Disponíveis
                        </Button>
                        <Button
                          variant={runningFilter === 'running' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRunningFilter('running')}
                        >
                          Em Veiculação
                        </Button>
                        <Button
                          variant={runningFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRunningFilter('all')}
                        >
                          Todos
                        </Button>
                      </div>
                    )}

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar materiais..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <MaterialsGrid
                      materials={filteredMaterials}
                      viewMode={viewMode}
                      onMaterialUpdated={loadProject}
                      currentStatusFilter={statusFilter !== 'all' ? statusFilter : undefined}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;
