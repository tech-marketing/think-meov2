import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Grid3X3,
  List,
  FileText,
  Filter
} from "lucide-react";
import { MaterialsGrid } from "@/components/MaterialsGrid";
import { BriefingViewer } from "@/components/BriefingViewer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BriefingMaterial {
  id: string;
  name: string;
  type: 'wireframe' | 'carousel' | 'video';
  status: 'client_approval' | 'internal_approval' | 'pending' | 'approved' | 'needs_adjustment' | 'rejected';
  comments: number;
  caption?: string;

  briefing_approved_by_client?: boolean;
}

interface BriefingSectionProps {
  projectId: string;
  onBriefingView?: (briefing: { caption?: string; id?: string } | null) => void;
}

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'client_approval' | 'internal_approval' | 'pending' | 'approved' | 'needs_adjustment' | 'rejected';

export const BriefingSection = ({ projectId, onBriefingView }: BriefingSectionProps) => {
  const [briefings, setBriefings] = useState<BriefingMaterial[]>([]);
  const [filteredBriefings, setFilteredBriefings] = useState<BriefingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewingBriefing, setViewingBriefing] = useState<string | null>(null);
  const [currentBriefingData, setCurrentBriefingData] = useState<{ caption?: string } | null>(null);
  const [allBriefingIds, setAllBriefingIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBriefingData = async () => {
      if (viewingBriefing) {
        const { data } = await supabase
          .from('materials')
          .select('caption, id')
          .eq('id', viewingBriefing)
          .single();

        setCurrentBriefingData(data);
        onBriefingView?.(data);
      } else {
        setCurrentBriefingData(null);
        onBriefingView?.(null);
      }
    };

    fetchBriefingData();
  }, [viewingBriefing, onBriefingView]);

  const loadBriefings = async () => {
    try {
      setLoading(true);

      const { data: briefingData, error } = await supabase
        .from('materials')
        .select('id, name, type, status, caption, wireframe_data, briefing_approved_by_client')
        .eq('project_id', projectId)
        .in('type', ['wireframe', 'carousel', 'video', 'image'])
        .eq('is_briefing', true)
        .eq('briefing_approved_by_client', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedBriefings: BriefingMaterial[] = (briefingData || []).map(briefing => ({
        id: briefing.id,
        name: briefing.name,
        type: briefing.type as BriefingMaterial['type'],
        status: briefing.status as BriefingMaterial['status'],
        comments: 0, // TODO: contar comentários
        caption: briefing.caption || undefined,

      }));

      setBriefings(processedBriefings);
      setFilteredBriefings(processedBriefings);
      setAllBriefingIds(processedBriefings.map(b => b.id));

    } catch (error) {
      console.error('Erro ao carregar briefings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar briefings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBriefings();

    // Setup realtime subscription
    const channel = supabase
      .channel('briefings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materials',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          console.log('Briefing change detected:', payload);
          loadBriefings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    const filtered = briefings.filter(briefing => {
      const matchesSearch = briefing.name.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = statusFilter === 'all';

      if (!matchesStatus) {
        if (statusFilter === 'needs_adjustment') {
          // Inclui tanto needs_adjustment quanto rejected no filtro de ajustes
          matchesStatus = briefing.status === 'needs_adjustment' || briefing.status === 'rejected';
        } else {
          matchesStatus = briefing.status === statusFilter;
        }
      }

      return matchesSearch && matchesStatus;
    });
    setFilteredBriefings(filtered);
  }, [briefings, searchTerm, statusFilter]);

  const stats = {
    total: briefings.length,
    clientApproval: briefings.filter(b => b.status === 'client_approval').length,
    internalApproval: briefings.filter(b => b.status === 'internal_approval').length,
    pending: briefings.filter(b => b.status === 'pending').length,
    approved: briefings.filter(b => b.briefing_approved_by_client).length,
    needsAdjustment: briefings.filter(b => b.status === 'needs_adjustment' || b.status === 'rejected').length,
  };

  // Se está visualizando um briefing específico
  if (viewingBriefing) {
    return (
      <BriefingViewer
        briefingId={viewingBriefing}
        projectId={projectId}
        onBack={() => {
          setViewingBriefing(null);
          loadBriefings();
        }}
        onNavigate={(newBriefingId) => setViewingBriefing(newBriefingId)}
        allBriefingIds={filteredBriefings.map(b => b.id)}
        searchTerm={searchTerm}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Briefings</h3>
          <p className="text-sm text-muted-foreground">
            Copies em processo de aprovação
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`border-0 cursor-pointer transition-all duration-200 ${statusFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'
            }`}
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'all' : 'all')}
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
          className={`border-0 cursor-pointer transition-all duration-200 ${statusFilter === 'internal_approval' ? 'ring-2 ring-purple-500 bg-purple-500/10' : 'hover:shadow-md'
            }`}
          onClick={() => setStatusFilter(statusFilter === 'internal_approval' ? 'all' : 'internal_approval')}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <div className="h-4 w-4 rounded-full bg-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-2xl font-bold ${statusFilter === 'internal_approval' ? 'text-purple-700' : ''}`}>{stats.internalApproval}</p>
                <p className={`text-xs leading-tight ${statusFilter === 'internal_approval' ? 'text-purple-600' : 'text-muted-foreground'}`}>Aprovados Interno</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-0 cursor-pointer transition-all duration-200 ${statusFilter === 'pending' ? 'ring-2 ring-warning bg-warning/5' : 'hover:shadow-md'
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
          className={`border-0 cursor-pointer transition-all duration-200 ${statusFilter === 'needs_adjustment' || statusFilter === 'rejected' ? 'ring-2 ring-destructive bg-destructive/5' : 'hover:shadow-md'
            }`}
          onClick={() => {
            if (statusFilter === 'needs_adjustment' || statusFilter === 'rejected') {
              setStatusFilter('all');
            } else {
              setStatusFilter('needs_adjustment');
            }
          }}
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

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar briefings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      {/* Briefings Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando briefings...</p>
        </div>
      ) : (
        <MaterialsGrid
          materials={filteredBriefings.map(briefing => ({
            ...briefing,
            is_briefing: true,
            briefing_approved_by_client: briefing.briefing_approved_by_client
          }))}
          viewMode={viewMode}
          onMaterialUpdated={loadBriefings}
          onMaterialClick={(id) => setViewingBriefing(id)}
        />
      )}
    </div>
  );
};