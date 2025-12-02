import { useState, useEffect } from "react";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectModal } from "./CreateProjectModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TrendingUp, Clock, CheckCircle, AlertTriangle, Filter, ArrowUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SafeErrorBoundary } from "./SafeErrorBoundary";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { EmptyStateDashboard } from "./EmptyStateDashboard";

interface Project {
  id: string;
  name: string;
  client: string;
  companyLogo?: string | null;
  dueDate: string;
  created_at: string;
  materials: Array<{
    id: string;
    name: string;
    type: 'image' | 'video' | 'pdf' | 'wireframe';
    status: 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval' | 'internal_approval';
    comments: number;
    thumbnail?: string;
    is_running?: boolean;
    created_at?: string;
  }>;
}

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
}

type SortOption = 'name' | 'dueDate' | 'client' | 'materialsCount';
type SortDirection = 'asc' | 'desc';

const ProjectCardSkeleton = () => (
  <Card className="p-6">
    <div className="space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  </Card>
);

export const Dashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingApproval: 0,
    approvedToday: 0,
    needsAdjustments: 0
  });

  const loadProjects = async () => {
    try {
      setLoading(true);

      if (!profile?.company_id && (!profile?.allowed_companies || profile?.allowed_companies.length === 0) && profile?.role !== 'admin') {
        setLoading(false);
        return;
      }

      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .order('name');
      
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      let projectsQuery = supabase.from('projects').select('*');
      
      if (profile?.role !== 'admin') {
        if (profile?.company_id) {
          projectsQuery = projectsQuery.eq('company_id', profile.company_id);
        } else if (profile?.allowed_companies && profile.allowed_companies.length > 0) {
          projectsQuery = projectsQuery.in('company_id', profile.allowed_companies as string[]);
        }
      }

      const { data: projectsData, error: projectsError } = await projectsQuery.order('created_at', { ascending: false });
      
      if (projectsError) throw projectsError;

      const companyData = new Map<string, { name: string; logo_url: string | null }>();
      if (companiesData) {
        companiesData.forEach(company => {
          companyData.set(company.id, { name: company.name, logo_url: company.logo_url || null });
        });
      }

      const projectsWithMaterials: Project[] = [];
      
      if (projectsData && projectsData.length > 0) {
        for (const project of projectsData) {
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, type, status, file_url, thumbnail_url, is_briefing, is_running, created_at')
        .eq('project_id', project.id)
        .eq('is_briefing', false)
        .order('created_at', { ascending: false });

          if (materialsError) {
            console.error('Erro ao buscar materiais do projeto:', materialsError);
          }

          const materials = (materialsData || []).map(material => {
            let materialType: 'image' | 'video' | 'pdf' | 'wireframe' = material.type as any || 'image';

            if (materialType === 'image') {
              const fileName = material.name?.toLowerCase() || '';
              const fileUrl = material.file_url?.toLowerCase() || '';

              if (fileName.includes('video') || fileUrl.includes('.mp4') || fileUrl.includes('.mov') || 
                  fileUrl.includes('.avi') || fileUrl.includes('.webm')) {
                materialType = 'video';
              } else if (fileName.includes('pdf') || fileUrl.includes('.pdf')) {
                materialType = 'pdf';
              }
            }

            return {
              id: material.id,
              name: material.name,
              type: materialType,
              status: material.status as any,
              comments: 0,
              thumbnail: material.file_url,
              is_running: material.is_running ?? true,
              created_at: material.created_at
            };
          });

          let dueDate = 'Sem prazo definido';
          if (project.due_date) {
            const date = new Date(project.due_date);
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

          projectsWithMaterials.push({
            id: project.id,
            name: project.name,
            client: companyData.get(project.company_id)?.name || 'Cliente não encontrado',
            companyLogo: companyData.get(project.company_id)?.logo_url || null,
            dueDate,
            materials,
            created_at: project.created_at
          });
        }
      }

      setProjects(projectsWithMaterials);

      const { data: allBriefingsData } = await supabase
        .from('materials')
        .select('id, status, briefing_approved_by_client')
        .eq('is_briefing', true);

      const allBriefings = allBriefingsData || [];

      const pendingMaterials = projectsWithMaterials.reduce((acc, p) => 
        acc + p.materials.filter(m => m.status === 'pending').length, 0);
      
      const pendingBriefings = allBriefings.filter(b => !b.briefing_approved_by_client).length;
      const totalPending = pendingBriefings + pendingMaterials;

      const { data: clientApprovedData } = await supabase
        .from('materials')
        .select('id, file_url')
        .eq('status', 'client_approval')
        .eq('is_briefing', false)
        .not('file_url', 'is', null);

      const totalClientApproved = clientApprovedData?.length || 0;

      const briefingsAdjustments = allBriefings.filter(b => 
        b.status === 'needs_adjustment' || b.status === 'rejected').length;
      
      const materialsAdjustments = projectsWithMaterials.reduce((acc, p) => 
        acc + p.materials.filter(m => m.status === 'needs_adjustment' || m.status === 'rejected').length, 0);
      
      const totalAdjustments = briefingsAdjustments + materialsAdjustments;

      setStats({
        totalProjects: projectsWithMaterials.length,
        pendingApproval: totalPending,
        approvedToday: totalClientApproved,
        needsAdjustments: totalAdjustments
      });
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar projetos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...projects];

    if (selectedClients.length > 0) {
      filtered = filtered.filter(project => selectedClients.includes(project.client));
    }

    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'client':
          aValue = a.client.toLowerCase();
          bValue = b.client.toLowerCase();
          break;
        case 'dueDate':
          aValue = a.dueDate === 'Sem prazo definido' ? 0 : 
                   a.dueDate === 'Hoje' ? Date.now() : 
                   a.dueDate === 'Amanhã' ? Date.now() + 86400000 : 
                   a.dueDate.includes('Em') ? Date.now() + parseInt(a.dueDate.split(' ')[1]) * 86400000 : 
                   Date.now() - parseInt(a.dueDate.split(' ')[0]) * 86400000;
          bValue = b.dueDate === 'Sem prazo definido' ? 0 : 
                   b.dueDate === 'Hoje' ? Date.now() : 
                   b.dueDate === 'Amanhã' ? Date.now() + 86400000 : 
                   b.dueDate.includes('Em') ? Date.now() + parseInt(b.dueDate.split(' ')[1]) * 86400000 : 
                   Date.now() - parseInt(b.dueDate.split(' ')[0]) * 86400000;
          break;
        case 'materialsCount':
          aValue = a.materials.length;
          bValue = b.materials.length;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    setFilteredProjects(filtered);
  }, [projects, selectedClients, sortBy, sortDirection]);

  const handleClientToggle = (clientName: string) => {
    setSelectedClients(prev => 
      prev.includes(clientName) ? prev.filter(c => c !== clientName) : [...prev, clientName]
    );
  };

  const clearFilters = () => {
    setSelectedClients([]);
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    if (profile?.company_id || (profile?.allowed_companies && profile?.allowed_companies.length > 0) || profile?.role === 'admin') {
      loadProjects();
    }
  }, [profile?.company_id, profile?.allowed_companies, profile?.role]);

  const handleProjectCreated = () => {
    loadProjects();
  };

  const statsArray = [
    {
      title: "Projetos",
      value: stats.totalProjects.toString(),
      change: "+1 este mês",
      icon: TrendingUp
    },
    {
      title: "Pendentes",
      value: stats.pendingApproval.toString(),
      change: "itens aguardando",
      icon: Clock
    },
    {
      title: "Aprovados pelo Cliente",
      value: stats.approvedToday.toString(),
      change: "materiais e briefings",
      icon: CheckCircle
    },
    {
      title: "Ajustes",
      value: stats.needsAdjustments.toString(),
      change: "materiais",
      icon: AlertTriangle
    }
  ];

  return (
    <SafeErrorBoundary>
      <div className="space-y-8">
        <CreateProjectModal 
          open={showCreateModal} 
          onOpenChange={setShowCreateModal} 
          onProjectCreated={handleProjectCreated} 
        />

        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground font-body -my-2.5">
          Home / Dashboard
        </div>

        {/* Seção Visão Geral */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
              Visão Geral
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Acompanhe o desempenho dos seus projetos em tempo real
            </p>
          </div>

          {/* Botão Novo Projeto */}
          <div className="flex items-center gap-2">
            {(profile?.role === 'admin' || profile?.role === 'collaborator') && (
              <Button 
                variant="outline"
                className="group gap-2 font-heading text-xs sm:text-sm h-9 sm:h-10 hover:shadow-[0_0_20px_rgba(110,80,255,0.4)] transition-all duration-300 hover:-translate-y-0.5" 
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Novo Projeto
              </Button>
            )}
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statsArray.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className="card-metric card-metric--static">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="card-metric-icon flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 p-2 sm:p-2.5">
                      <IconComponent className="h-full w-full text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 truncate font-body">
                        {stat.title}
                      </p>
                      <p className="text-2xl sm:text-3xl font-extrabold text-foreground font-heading">
                        {stat.value}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground opacity-70 mt-0.5 font-body">
                        {stat.change}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Dashboard */}
        {!loading && projects.length > 0 && (
          <PerformanceDashboard projects={projects} />
        )}

        {/* Seção Projetos Ativos */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
              Projetos Ativos
            </h2>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Gerencie todos os seus projetos e materiais em um só lugar
            </p>
            <div className="h-px bg-gradient-to-r from-primary/40 via-primary/20 to-transparent mt-4" />
          </div>

          {/* Filtros e Ordenação */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro de Clientes */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="btn-outline h-8 sm:h-9 text-xs hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-2" />
                  <span className="hidden sm:inline">Filtrar</span>
                  {selectedClients.length > 0 && (
                    <Badge className="ml-1 sm:ml-2 h-4 w-4 p-0 text-[10px] rounded-full" variant="secondary">
                      {selectedClients.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 bg-background border border-border shadow-lg z-50">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Filtrar por Cliente</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {companies.map(company => (
                      <div key={company.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`client-${company.id}`}
                          checked={selectedClients.includes(company.name)}
                          onCheckedChange={() => handleClientToggle(company.name)}
                        />
                        <label
                          htmlFor={`client-${company.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {company.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedClients.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="w-full text-xs"
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Ordenação */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="btn-outline h-8 sm:h-9 text-xs hover:-translate-y-0.5 transition-all duration-300"
                >
                  <ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-2" />
                  <span className="hidden sm:inline">Ordenar</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 sm:w-56 p-3 sm:p-4 bg-background border border-border shadow-lg z-50">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm mb-3">Ordenar por</h4>
                  {[
                    { value: 'name', label: 'Nome' },
                    { value: 'client', label: 'Cliente' },
                    { value: 'dueDate', label: 'Prazo' },
                    { value: 'materialsCount', label: 'Nº Materiais' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleSort(option.value as SortOption)}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                    >
                      {option.label}
                      {sortBy === option.value && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Chips de Filtros Aplicados */}
            {selectedClients.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedClients.map(client => (
                  <Badge key={client} variant="secondary" className="text-xs gap-1">
                    {client}
                    <button
                      onClick={() => handleClientToggle(client)}
                      className="hover:bg-destructive/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Grid de Projetos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {loading ? (
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map(project => (
                <ProjectCard 
                  key={project.id} 
                  {...project} 
                  canDelete={profile?.role === 'admin' || profile?.role === 'collaborator'} 
                  className="project-card"
                />
              ))
            ) : projects.length === 0 ? (
              <div className="col-span-full">
                <EmptyStateDashboard onCreateProject={() => setShowCreateModal(true)} />
              </div>
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground font-body">
                  Nenhum projeto encontrado com os filtros aplicados
                </p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </SafeErrorBoundary>
  );
};
