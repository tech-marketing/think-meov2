import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Undo2 } from "lucide-react";
import { WireframeViewer } from "@/components/WireframeViewer";
import { DeleteBriefingModal } from "@/components/DeleteBriefingModal";
import { MaterialNavigationArrows } from "@/components/MaterialNavigationArrows";
import { CompetitiveInsightsDisplay } from "@/components/CompetitiveInsightsDisplay";
import { BriefingComments } from "@/components/BriefingComments";
import { CarouselGallery } from "@/components/CarouselGallery";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
interface ApprovedBriefingViewerProps {
  briefingId: string;
  projectId: string;
  onBack: () => void;
  allBriefingIds?: string[];
  searchTerm?: string;
}
export const ApprovedBriefingViewer = ({
  briefingId,
  projectId,
  onBack,
  allBriefingIds = [],
  searchTerm = ''
}: ApprovedBriefingViewerProps) => {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [filteredBriefingIds, setFilteredBriefingIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    loadBriefing();
  }, [briefingId]);
  useEffect(() => {
    // Filtrar briefings com base no searchTerm
    if (searchTerm) {
      const filtered = allBriefingIds.filter(id => {
        // Aqui você pode adicionar lógica mais complexa de filtragem se necessário
        return true;
      });
      setFilteredBriefingIds(filtered);
    } else {
      setFilteredBriefingIds(allBriefingIds);
    }
    const index = (searchTerm ? filteredBriefingIds : allBriefingIds).indexOf(briefingId);
    setCurrentIndex(index >= 0 ? index : 0);
  }, [allBriefingIds, briefingId, searchTerm]);
  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    const briefingsToUse = filteredBriefingIds.length > 0 ? filteredBriefingIds : allBriefingIds;
    if (newIndex >= 0 && newIndex < briefingsToUse.length) {
      const newBriefingId = briefingsToUse[newIndex];
      // Trigger loadBriefing by updating state
      window.location.hash = `briefing-${newBriefingId}`;
    }
  };
  const loadBriefing = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('materials').select('*').eq('id', briefingId).maybeSingle();
      if (error) throw error;
      setBriefing(data);
    } catch (error) {
      console.error('Erro ao carregar briefing:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar briefing aprovado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Gerar thumbnail automaticamente se não existir para briefing aprovado
  const generateMissingThumbnail = async () => {
    if (!briefing?.canvas_data) return;
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 700;
      tempCanvas.height = 550;
      const {
        Canvas: FabricCanvas
      } = await import('fabric');
      const fabricCanvas = new FabricCanvas(tempCanvas);
      await fabricCanvas.loadFromJSON(JSON.parse(briefing.canvas_data));
      fabricCanvas.renderAll();
      const thumbnailDataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.5
      });
      fabricCanvas.dispose();

      // Salvar no banco
      await supabase.from('materials').update({
        thumbnail_url: thumbnailDataUrl
      }).eq('id', briefingId);

      // Atualizar estado local
      setBriefing((prev: any) => ({
        ...prev,
        thumbnail_url: thumbnailDataUrl
      }));
    } catch (error) {
      console.error('Erro ao gerar thumbnail:', error);
    }
  };
  useEffect(() => {
    if (briefing?.canvas_data && !briefing?.thumbnail_url) {
      generateMissingThumbnail();
    }
  }, [briefing]);
  const handleRevertToBriefing = async () => {
    try {
      setReverting(true);
      const {
        error
      } = await supabase.from('materials').update({
        briefing_approved_by_client: false,
        status: 'pending'
      }).eq('id', briefingId);
      if (error) throw error;
      toast({
        title: "Sucesso!",
        description: "Briefing movido de volta para a seção Briefings"
      });

      // Redirecionar para a seção de briefings do projeto
      navigate(`/project/${projectId}?section=briefing`);
    } catch (error) {
      console.error('Erro ao reverter briefing:', error);
      toast({
        title: "Erro",
        description: "Erro ao reverter briefing",
        variant: "destructive"
      });
    } finally {
      setReverting(false);
    }
  };
  const handleBriefingDeleted = () => {
    // Redirecionar para a seção de briefings aprovados do projeto
    navigate(`/project/${projectId}?section=briefing-approved`);
  };
  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  if (!briefing) {
    return <div className="text-center py-12">
        <p className="text-muted-foreground">Briefing não encontrado</p>
        <Button onClick={onBack} className="mt-4">
          Voltar
        </Button>
      </div>;
  }
  return <div className="space-y-6">
      {/* Navigation Arrows */}
      <MaterialNavigationArrows currentIndex={currentIndex} totalMaterials={filteredBriefingIds.length || allBriefingIds.length} onNavigate={handleNavigate} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{briefing.name}</h2>
            <Badge className="bg-emerald-500 text-white mt-2">
              Aprovado pelo Cliente
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRevertToBriefing} disabled={reverting}>
            <Undo2 className="h-4 w-4 mr-2" />
            {reverting ? "Revertendo..." : "Voltar para Briefings"}
          </Button>
          <DeleteBriefingModal briefingId={briefingId} briefingName={briefing.name} onDeleted={handleBriefingDeleted} redirectAfterDelete={false} projectId={projectId} />
        </div>
      </div>

      {/* Competitive Insights */}
      {briefing.wireframe_data?.competitive_insights && <CompetitiveInsightsDisplay insights={briefing.wireframe_data.competitive_insights} />}

      {/* Canvas, Carousel ou Wireframe Viewer */}
      {briefing.type === 'carousel' && briefing.wireframe_data?.slides ? (
        // Carrossel - Mostrar galeria de imagens
        <CarouselGallery slides={briefing.wireframe_data.slides} />
      ) : briefing.type === 'wireframe' && <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">
              {briefing.canvas_data ? 'Canvas Aprovado' : 'Wireframe Aprovado'}
            </h3>
          </CardHeader>
          <CardContent className="flex justify-center">
            {briefing.canvas_data && briefing.thumbnail_url ?
        // Renderizar thumbnail do Canvas editado
        <div className="w-full max-w-2xl">
                <img src={briefing.thumbnail_url} alt="Canvas Preview" className="max-w-full h-auto rounded-lg border-2 border-border shadow-lg" />
              </div> : briefing.canvas_data && !briefing.thumbnail_url ?
        // Canvas existe mas thumbnail não - gerando...
        <div className="w-full max-w-2xl h-96 rounded-lg border-2 border-border bg-muted flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground text-sm">Gerando visualização...</p>
                </div>
              </div> : briefing.wireframe_data ?
        // Não tem Canvas - usar wireframe antigo
        <div className="w-full max-w-2xl">
                <WireframeViewer wireframe={briefing.wireframe_data} />
              </div> :
        // Não tem nada
        <p className="text-muted-foreground">Visualização não disponível</p>}
          </CardContent>
        </Card>}

      {/* Caption */}
      {briefing.caption && <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Caption</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {briefing.caption}
            </p>
          </CardContent>
        </Card>}

      {/* Metadata */}
      

      {/* Comments Section */}
      <BriefingComments briefingId={briefingId} projectId={projectId} />
    </div>;
};