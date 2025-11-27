import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials } from "@/contexts/MaterialsContext";
import { Plus, Settings, Save, Trash2, Edit, Check, X, Info, Lightbulb, Wand2, Download, Tag, HelpCircle } from "lucide-react";
import { Thumbnail } from "@/components/Thumbnail";
interface TaxonomyPattern {
  id: string;
  pattern_name: string;
  pattern_rules: {
    separator?: string;
    max_length?: number;
    allowed_chars?: string;
    required_fields?: string[];
    format_example?: string;
    description?: string;
  };
  is_default: boolean;
  created_at: string;
}
interface Project {
  id: string;
  name: string;
  description?: string;
}
interface Material {
  id: string;
  name: string;
  status: string;
  file_url?: string;
  thumbnail_url?: string;
  project_id: string;
}
const TaxonomyAssistant = () => {
  const {
    toast
  } = useToast();
  const {
    notifyMaterialChange
  } = useMaterials();
  const [patterns, setPatterns] = useState<TaxonomyPattern[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual taxonomy state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [approvedMaterials, setApprovedMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [manualTaxonomy, setManualTaxonomy] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [showDownloadOption, setShowDownloadOption] = useState(false);
  const [appliedTaxonomy, setAppliedTaxonomy] = useState('');
  useEffect(() => {
    loadPatterns();
    loadProjects();
  }, []);
  useEffect(() => {
    if (selectedProject) {
      loadApprovedMaterials(selectedProject);
    }
  }, [selectedProject]);
  const loadPatterns = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('taxonomy_patterns').select('*').order('is_default', {
        ascending: false
      }).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setPatterns((data || []).map(item => ({
        ...item,
        pattern_rules: item.pattern_rules as any
      })));
    } catch (error) {
      console.error('Error loading patterns:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar padrões de taxonomia",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const getCurrentUserCompanyId = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const {
      data: profile
    } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single();
    return profile?.company_id;
  };
  const loadProjects = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('projects').select('id, name, description').eq('status', 'active').order('name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };
  const loadApprovedMaterials = async (projectId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('materials').select('*').eq('project_id', projectId).eq('status', 'client_approval').not('file_url', 'is', null).order('name');
      if (error) throw error;
      setApprovedMaterials(data || []);
    } catch (error) {
      console.error('Error loading approved materials:', error);
      setApprovedMaterials([]);
    }
  };
  const generateTaxonomyWithAI = async () => {
    if (!selectedMaterial || !selectedPattern) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um material e um padrão de taxonomia",
        variant: "destructive"
      });
      return;
    }
    try {
      setGenerating(true);
      const material = approvedMaterials.find(m => m.id === selectedMaterial);
      const pattern = patterns.find(p => p.id === selectedPattern);
      if (!material || !pattern) return;
      const {
        data,
        error
      } = await supabase.functions.invoke('suggest-taxonomy', {
        body: {
          materialName: material.name,
          imageUrl: material.thumbnail_url || material.file_url,
          patternRules: pattern.pattern_rules,
          patternName: pattern.pattern_name
        }
      });
      if (error) throw error;
      setManualTaxonomy(data.suggestedTaxonomy || '');
      toast({
        title: "Taxonomia gerada",
        description: "A IA sugeriu uma taxonomia baseada no padrão selecionado"
      });
    } catch (error) {
      console.error('Error generating taxonomy:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar taxonomia com IA",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };
  const applyTaxonomy = async () => {
    if (!selectedMaterial || !manualTaxonomy.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um material e insira uma taxonomia",
        variant: "destructive"
      });
      return;
    }
    try {
      console.log('🏷️ Aplicando taxonomia:', {
        materialId: selectedMaterial,
        newName: manualTaxonomy.trim()
      });

      // First get the current material to preserve client approval status
      const {
        data: currentMaterial,
        error: fetchError
      } = await supabase.from('materials').select('status, name').eq('id', selectedMaterial).single();
      if (fetchError) throw fetchError;
      console.log('📋 Material atual:', currentMaterial);

      // Prepare update data - preserve client_approval status if it exists
      const updateData: any = {
        name: manualTaxonomy.trim(),
        updated_at: new Date().toISOString() // Force timestamp update
      };

      // Only change status if it's not already client approved
      // This preserves the client_approval status while marking as taxonomized
      if (currentMaterial?.status !== 'client_approval') {
        updateData.status = 'taxonomized';
      }
      // If it was client_approval, we keep that status and the taxonomy is just in the name

      console.log('🔄 Dados de atualização:', updateData);

      // Update material name with taxonomy
      const {
        error,
        data: updatedData
      } = await supabase.from('materials').update(updateData).eq('id', selectedMaterial).select('name, status, updated_at');
      if (error) throw error;
      console.log('✅ Material atualizado com sucesso:', updatedData);

      // Notify the global context that a material was updated
      notifyMaterialChange('updated', selectedMaterial);
      toast({
        title: "Taxonomia aplicada",
        description: `Material renomeado para: ${manualTaxonomy.trim()}`
      });

      // Set state to show download option with applied taxonomy
      setAppliedTaxonomy(manualTaxonomy.trim());
      setShowDownloadOption(true);

      // Reset form (but keep the applied taxonomy for download)
      setSelectedMaterial('');
      setManualTaxonomy('');

      // Reload materials to show the updated name immediately
      if (selectedProject) {
        console.log('🔄 Recarregando materiais do projeto...');
        await loadApprovedMaterials(selectedProject);
      }
    } catch (error) {
      console.error('❌ Erro ao aplicar taxonomia:', error);
      toast({
        title: "Erro",
        description: "Falha ao aplicar taxonomia",
        variant: "destructive"
      });
    }
  };
  const downloadMaterialWithTaxonomy = async () => {
    try {
      if (!selectedProject || !appliedTaxonomy) return;

      // Find the material that was just updated (it should be in approvedMaterials still)
      const materialWithNewName = approvedMaterials.find(m => m.name === appliedTaxonomy || m.name.includes(appliedTaxonomy));
      if (!materialWithNewName?.file_url) {
        toast({
          title: "Arquivo indisponível",
          description: "Não foi possível localizar o arquivo para download",
          variant: "destructive"
        });
        return;
      }
      const link = document.createElement('a');
      link.href = materialWithNewName.file_url;
      link.download = appliedTaxonomy; // Use the applied taxonomy as filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download iniciado",
        description: `Baixando ${appliedTaxonomy}`
      });
    } catch (error) {
      console.error('Error downloading material with taxonomy:', error);
      toast({
        title: "Erro no download",
        description: "Falha ao baixar o material",
        variant: "destructive"
      });
    }
  };
  const downloadMaterial = async (material: Material) => {
    try {
      if (!material.file_url) {
        toast({
          title: "Arquivo indisponível",
          description: "Este material não possui arquivo para download",
          variant: "destructive"
        });
        return;
      }
      const link = document.createElement('a');
      link.href = material.file_url;
      link.download = material.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download iniciado",
        description: `Baixando ${material.name}`
      });
    } catch (error) {
      console.error('Error downloading material:', error);
      toast({
        title: "Erro no download",
        description: "Falha ao baixar o material",
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando padrões...</p>
        </div>
      </div>;
  }
  return <div className="container mx-auto p-6 space-y-6">

      {/* Manual Taxonomy Main Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Aplicar Taxonomia</CardTitle>
              <CardDescription>
                Selecione um material aprovado e defina sua nova nomenclatura
              </CardDescription>
            </div>
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent 
                side="left" 
                align="start" 
                className="w-80 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 animate-in fade-in-0 zoom-in-95"
              >
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Info className="h-4 w-4" />
                    Como usar a Taxonomia
                  </h4>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Use esta ferramenta para renomear seus materiais aprovados pelo cliente com uma nomenclatura customizada e organizada.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-purple-600 dark:text-purple-400">
                    <li>Selecione um projeto e escolha um material aprovado pelo cliente</li>
                    <li>Digite o novo nome/taxonomia que deseja aplicar ao material</li>
                    <li>Aplique a nova nomenclatura mantendo o status de aprovação do cliente</li>
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="project-select">Selecionar Projeto</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedProject && <div>
              <Label htmlFor="material-select">Material Aprovado pelo Cliente</Label>
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um material aprovado" />
                </SelectTrigger>
                <SelectContent>
                  {approvedMaterials.map(material => <SelectItem key={material.id} value={material.id}>
                      <div className="flex items-center gap-3 w-full">
                        <Thumbnail type={material.file_url?.includes('.mp4') || material.file_url?.includes('.mov') ? 'video' : 'image'} thumbnail={material.thumbnail_url || material.file_url} name={material.name} size="sm" />
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate max-w-[200px]">{material.name}</span>
                          <Badge variant="outline" className="ml-2">Aprovado</Badge>
                        </div>
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>}

          {patterns.length > 0 && selectedMaterial && <div>
              <Label htmlFor="pattern-select">Padrão de Taxonomia (Opcional)</Label>
              <Select value={selectedPattern} onValueChange={setSelectedPattern}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um padrão para IA" />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map(pattern => <SelectItem key={pattern.id} value={pattern.id}>
                      {pattern.pattern_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="manual-taxonomy">Nova Nomenclatura do Material</Label>
              {selectedMaterial && selectedPattern && <Button onClick={generateTaxonomyWithAI} disabled={generating} size="sm" variant="outline">
                  {generating ? <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-primary mr-2" />
                      Gerando...
                    </> : <>
                      <Wand2 className="h-3 w-3 mr-2" />
                      Gerar com IA
                    </>}
                </Button>}
            </div>
            <Textarea id="manual-taxonomy" value={manualTaxonomy} onChange={e => setManualTaxonomy(e.target.value)} placeholder="Digite a nova nomenclatura do material..." className="min-h-[100px]" />
          </div>

          {selectedMaterial && approvedMaterials.length > 0 && <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-3">Material Selecionado:</h4>
              {(() => {
            const material = approvedMaterials.find(m => m.id === selectedMaterial);
            return material ? <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Thumbnail type={material.file_url?.includes('.mp4') || material.file_url?.includes('.mov') ? 'video' : 'image'} thumbnail={material.thumbnail_url || material.file_url} name={material.name} size="md" />
                      <div>
                        <p className="text-sm font-medium">{material.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          Status: {material.status}
                        </Badge>
                      </div>
                    </div>
                    <Button onClick={() => downloadMaterial(material)} size="sm" variant="outline">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div> : null;
          })()}
            </div>}

          <div className="flex gap-2 pt-4">
            <Button onClick={applyTaxonomy} disabled={!selectedMaterial || !manualTaxonomy.trim()} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Aplicar Nova Nomenclatura
            </Button>
            <Button variant="outline" onClick={() => {
            setSelectedProject('');
            setSelectedMaterial('');
            setManualTaxonomy('');
            setSelectedPattern('');
            setShowDownloadOption(false);
            setAppliedTaxonomy('');
          }}>
              Limpar Formulário
            </Button>
          </div>

          {/* Download option after applying taxonomy */}
          {showDownloadOption && appliedTaxonomy && <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-300">Taxonomia Aplicada com Sucesso!</h4>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Material renomeado para: <strong>{appliedTaxonomy}</strong>
                  </p>
                </div>
                <Button onClick={downloadMaterialWithTaxonomy} variant="outline" className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20">
                  <Download className="h-3 w-3 mr-1" />
                  Download Material
                </Button>
              </div>
            </div>}
        </CardContent>
      </Card>

    </div>;
};
export default TaxonomyAssistant;