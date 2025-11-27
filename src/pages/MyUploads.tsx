import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MaterialsGrid } from "@/components/MaterialsGrid";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/UploadModal";
import { supabase } from "@/integrations/supabase/client";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe';
  status: 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval';
  comments: number;
  thumbnail?: string;
  project?: string;
  company?: string;
  created_at: string;
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval';

export default function MyUploads() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Function to load user materials from database
  const loadUserMaterials = async () => {
    if (!profile?.id) return;
    
    try {
      setIsLoading(true);
      
      // Query materials created by the current user
      const { data: materials, error } = await supabase
        .from('materials')
        .select(`
          id,
          name,
          type,
          status,
          file_url,
          thumbnail_url,
          created_at,
          projects(name),
          companies(name)
        `)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user materials:', error);
        setMaterials([]);
        setFilteredMaterials([]);
        return;
      }

      // Process materials data
      const processedMaterials: Material[] = (materials || []).map((material: any) => ({
        id: material.id,
        name: material.name,
        type: material.type as 'image' | 'video' | 'pdf' | 'wireframe',
        status: material.status as 'approved' | 'pending' | 'needs_adjustment' | 'rejected' | 'client_approval',
        comments: 0,
        thumbnail: material.thumbnail_url || material.file_url,
        project: material.projects?.name || "Projeto",
        company: material.companies?.name || "Empresa",
        created_at: material.created_at
      }));

      setMaterials(processedMaterials);
      setFilteredMaterials(processedMaterials);
    } catch (error) {
      console.error('Error loading user materials:', error);
      setMaterials([]);
      setFilteredMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load materials on component mount and when profile changes
  useEffect(() => {
    loadUserMaterials();
  }, [profile?.id]);

  // Filter materials based on status
  useEffect(() => {
    const filtered = materials.filter(material => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'approved') {
        return material.status === 'approved' || material.status === 'client_approval';
      }
      return material.status === statusFilter;
    });
    setFilteredMaterials(filtered);
  }, [materials, statusFilter]);

  const stats = {
    total: materials.length,
    pending: materials.filter(m => m.status === 'pending').length,
    approved: materials.filter(m => m.status === 'approved' || m.status === 'client_approval').length,
    needsAdjustment: materials.filter(m => m.status === 'needs_adjustment').length,
  };

  const canUpload = profile?.role === 'admin' || profile?.role === 'collaborator';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-end">
        <div>
          <h1 className="text-3xl font-brand font-light text-foreground">Meus Uploads</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <FileText className="h-8 w-8 text-primary/60" />
              <div>
                <p className="text-3xl font-bold text-foreground font-heading">{stats.total}</p>
                <p className="text-sm font-medium text-muted-foreground font-body">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <Clock className="h-8 w-8 text-warning/60" />
              <div>
                <p className="text-3xl font-bold text-warning font-heading">{stats.pending}</p>
                <p className="text-sm font-medium text-muted-foreground font-body">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <CheckCircle className="h-8 w-8 text-success/60" />
              <div>
                <p className="text-3xl font-bold text-success font-heading">{stats.approved}</p>
                <p className="text-sm font-medium text-muted-foreground font-body">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-soft transition-all duration-300 cursor-pointer ${
            statusFilter === 'needs_adjustment' ? 'ring-2 ring-destructive bg-destructive/5' : ''
          }`}
          onClick={() => setStatusFilter(statusFilter === 'needs_adjustment' ? 'all' : 'needs_adjustment')}
        >
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <Clock className="h-8 w-8 text-destructive/60" />
              <div>
                <p className="text-3xl font-bold text-destructive font-heading">{stats.needsAdjustment}</p>
                <p className="text-sm font-medium text-muted-foreground font-body">Ajustes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Materials Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium text-muted-foreground mr-2">Status:</span>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="text-xs rounded-full"
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              className="text-xs rounded-full"
              onClick={() => setStatusFilter('approved')}
            >
              Aprovados
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              className="text-xs rounded-full"
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={statusFilter === 'needs_adjustment' ? 'default' : 'outline'}
              size="sm"
              className="text-xs rounded-full"
              onClick={() => setStatusFilter('needs_adjustment')}
            >
              Ajustes
            </Button>
          </div>
        </div>
        {filteredMaterials.length > 0 ? (
          <MaterialsGrid materials={filteredMaterials} />
        ) : materials.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-12 text-center">
              <Upload className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-heading font-light mb-2">Nenhum material encontrado</h3>
              <p className="text-muted-foreground font-body mb-6">
                Você ainda não enviou nenhum material. Comece fazendo seu primeiro upload!
              </p>
              {canUpload && (
                <Button onClick={() => setUploadModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Fazer Upload
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground font-body">
                Nenhum material encontrado com o filtro "
                {statusFilter === 'needs_adjustment' ? 'Ajustes' : 
                 statusFilter === 'approved' ? 'Aprovados' :
                 statusFilter === 'pending' ? 'Pendentes' : statusFilter}" aplicado.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <UploadModal 
        open={uploadModalOpen} 
        onOpenChange={setUploadModalOpen}
        onMaterialUploaded={() => {
          // Refresh materials list after upload
          if (profile?.id) {
            loadUserMaterials();
          }
        }}
      />
    </div>
  );
}