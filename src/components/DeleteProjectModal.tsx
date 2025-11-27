import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface DeleteProjectModalProps {
  projectId: string;
  projectName: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DeleteProjectModal = ({ 
  projectId, 
  projectName, 
  trigger, 
  open: controlledOpen, 
  onOpenChange 
}: DeleteProjectModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleDelete = async () => {
    try {
      setLoading(true);

      // Primeiro, buscar os IDs dos materiais do projeto
      const { data: materials, error: materialsQueryError } = await supabase
        .from('materials')
        .select('id')
        .eq('project_id', projectId);

      if (materialsQueryError) throw materialsQueryError;

      // Deletar todos os comentários dos materiais do projeto
      if (materials && materials.length > 0) {
        const materialIds = materials.map(m => m.id);
        const { error: commentsError } = await supabase
          .from('comments')
          .delete()
          .in('material_id', materialIds);

        if (commentsError) throw commentsError;
      }

      // Deletar todos os materiais do projeto
      const { error: materialsError } = await supabase
        .from('materials')
        .delete()
        .eq('project_id', projectId);

      if (materialsError) throw materialsError;

      // Deletar participantes do projeto
      const { error: participantsError } = await supabase
        .from('project_participants')
        .delete()
        .eq('project_id', projectId);

      if (participantsError) throw participantsError;

      // Finalmente, deletar o projeto
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectError) throw projectError;

      toast({
        title: "Sucesso!",
        description: `Projeto "${projectName}" foi excluído com sucesso.`,
      });

      // Navegar de volta ao dashboard
      navigate('/');
      
    } catch (error: any) {
      console.error('Erro ao deletar projeto:', error);
      toast({
        title: "Erro",
        description: `Erro ao excluir projeto: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Projeto
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Você tem certeza que deseja excluir o projeto <strong>"{projectName}"</strong>?
            </p>
            <p className="text-destructive font-medium">
              ⚠️ Esta ação não pode ser desfeita. Todos os materiais, comentários e participantes associados a este projeto também serão excluídos permanentemente.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};