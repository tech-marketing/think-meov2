import { useState, useEffect } from "react";

import { MaterialViewer } from "@/components/MaterialViewer";
import { MaterialNavigationArrows } from "@/components/MaterialNavigationArrows";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  isClient?: boolean;
  replies?: Comment[];
}

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'copy' | 'wireframe';
  status: 'approved' | 'pending' | 'needs_adjustment' | 'rejected';
  company_name?: string;
  project_name?: string;
  project_id?: string;
  created_at: string;
  caption?: string;
  reference?: string;
  copy?: string;
  file_url?: string;
  wireframe_data?: any;
  comments?: Comment[];
  is_running?: boolean;
}

const MaterialView = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectMaterials, setProjectMaterials] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadMaterial = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Buscar material com suas relações
      const { data, error } = await supabase
        .from('materials')
        .select(`
          id,
          name,
          type,
          status,
          caption,
          reference,
          copy,
          file_url,
          wireframe_data,
          project_id,
          created_at,
          is_running,
          projects!inner(
            id,
            name,
            companies!inner(name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Buscar comentários do material - versão simplificada primeiro
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('material_id', id)
        .order('created_at', { ascending: false });

      console.log('Query simples - Comentários carregados:', commentsData);
      console.log('Query simples - Erro:', commentsError);

      // Se a query simples funcionar, buscar os perfis separadamente
      let profilesData = null;
      if (commentsData && commentsData.length > 0) {
        const authorIds = [...new Set(commentsData.map(comment => comment.author_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', authorIds);
        
        console.log('Profiles carregados:', profiles);
        console.log('Profiles erro:', profilesError);
        profilesData = profiles;
      }

      console.log('Material ID:', id);
      console.log('Comentários carregados:', commentsData);
      console.log('Erro de comentários:', commentsError);

      if (data) {
        // Organizar comentários de forma hierárquica
        const allComments = (commentsData || []).map(comment => {
          const profile = profilesData?.find(p => p.id === comment.author_id);
          
          return {
            id: comment.id,
            author: profile?.full_name || 'Usuário desconhecido',
            content: comment.content,
            timestamp: formatDate(comment.created_at),
            isClient: profile?.role === 'client',
            parent_id: comment.parent_id,
            replies: [] as Comment[]
          };
        });

        // Separar comentários principais das respostas
        const mainComments = allComments.filter(comment => !comment.parent_id);
        const replies = allComments.filter(comment => comment.parent_id);

        // Associar respostas aos comentários principais
        replies.forEach(reply => {
          const parentComment = mainComments.find(main => main.id === reply.parent_id);
          if (parentComment) {
            parentComment.replies = parentComment.replies || [];
            parentComment.replies.push(reply);
          }
        });

        console.log('Comentários organizados:', mainComments);

        // Handle wireframe data fallback and backfill
        let wireframeData = data.wireframe_data;
        
        // If it's a wireframe and no wireframe_data, try to parse from copy field
        if (data.type === 'wireframe' && !wireframeData && data.copy) {
          try {
            wireframeData = JSON.parse(data.copy);
            console.log('Wireframe data parsed from copy field:', wireframeData);
            
            // Optional backfill: update wireframe_data field in database
            if (wireframeData) {
              supabase
                .from('materials')
                .update({ wireframe_data: wireframeData })
                .eq('id', data.id)
                .then(({ error }) => {
                  if (error) {
                    console.error('Error backfilling wireframe_data:', error);
                  } else {
                    console.log('Successfully backfilled wireframe_data for material:', data.id);
                  }
                });
            }
          } catch (e) {
            console.error('Error parsing wireframe data from copy field:', e);
          }
        }

        setMaterial({
          id: data.id,
          name: data.name,
          type: data.type as 'image' | 'video' | 'pdf' | 'copy' | 'wireframe',
          status: data.status as 'approved' | 'pending' | 'needs_adjustment' | 'rejected',
          caption: data.caption,
          reference: data.reference,
          copy: data.copy,
          file_url: data.file_url,
          wireframe_data: wireframeData,
          created_at: data.created_at,
          company_name: data.projects?.companies?.name,
          project_name: data.projects?.name,
          project_id: data.project_id,
          comments: mainComments,
          is_running: data.is_running ?? true
        });
      }
    } catch (error) {
      console.error('Erro ao carregar material:', error);
      
      // Check if it's a 404 or material not found error
      const isNotFoundError = error?.code === 'PGRST116' || error?.message?.includes('not found') || error?.status === 404;
      
      toast({
        title: "Erro",
        description: isNotFoundError ? "Material deletado ou removido" : "Erro ao carregar material",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterial();
    loadProjectMaterials();
  }, [id]);

  const loadProjectMaterials = async () => {
    if (!id) return;

    try {
      // Primeiro, buscar o material atual para obter project_id e status
      const { data: currentMaterial, error: materialError } = await supabase
        .from('materials')
        .select('project_id, status')
        .eq('id', id)
        .single();

      if (materialError || !currentMaterial) return;

      const statusFilter = searchParams.get('status');
      
      // Buscar todos os materiais do projeto com o mesmo status
      let query = supabase
        .from('materials')
        .select('id')
        .eq('project_id', currentMaterial.project_id)
        .eq('is_briefing', false)
        .order('created_at', { ascending: true });

      // Aplicar filtro de status se fornecido
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      } else {
        query = query.eq('status', currentMaterial.status);
      }

      const { data: materials, error: materialsError } = await query;

      if (materialsError || !materials) return;

      const materialIds = materials.map(m => m.id);
      setProjectMaterials(materialIds);
      setCurrentIndex(materialIds.indexOf(id));
    } catch (error) {
      console.error('Erro ao carregar materiais do projeto:', error);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < projectMaterials.length) {
      const newMaterialId = projectMaterials[newIndex];
      const statusParam = searchParams.get('status');
      navigate(`/material/${newMaterialId}${statusParam ? `?status=${statusParam}` : ''}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Dashboard
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Material não encontrado ou foi deletado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {/* Navigation Arrows */}
      <MaterialNavigationArrows
        currentIndex={currentIndex}
        totalMaterials={projectMaterials.length}
        onNavigate={handleNavigate}
      />

      <MaterialViewer
        id={material.id}
        name={material.name}
        type={material.type as 'image' | 'video' | 'pdf' | 'wireframe'}
        status={material.status}
        client={material.company_name || "Cliente desconhecido"}
        project={material.project_name || "Projeto desconhecido"}
        projectId={material.project_id}
        uploadDate={formatDate(material.created_at)}
        caption={material.caption}
        reference={material.reference}
        isRunning={material.is_running}
        fileUrl={material.file_url}
        wireframeData={material.wireframe_data}
        comments={material.comments || []}
        onStatusUpdate={loadMaterial} // Callback para recarregar dados após mudanças
      />
    </div>
  );
};

export default MaterialView;