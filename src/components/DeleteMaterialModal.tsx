import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

interface DeleteMaterialModalProps {
  materialId: string;
  materialName: string;
  onDeleted?: () => void;
  redirectAfterDelete?: boolean;
  projectId?: string;
}

export const DeleteMaterialModal = ({ materialId, materialName, onDeleted, redirectAfterDelete, projectId }: DeleteMaterialModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDelete = async () => {
    try {
      setLoading(true);

      // Primeiro, deletar todos os comentários do material
      const { error: commentsError } = await supabase
        .from('comments')
        .delete()
        .eq('material_id', materialId);

      if (commentsError) throw commentsError;

      // Deletar o material
      const { error: materialError } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialId);

      if (materialError) throw materialError;

      toast({
        title: "Sucesso!",
        description: `Material "${materialName}" foi excluído com sucesso.`,
      });

      // Redirecionar para Materials se solicitado
      if (redirectAfterDelete) {
        if (projectId) {
          navigate(`/project/${projectId}?section=materials`);
        } else {
          navigate('/materials');
        }
      }

      // Callback para atualizar a lista
      onDeleted?.();
      
    } catch (error: any) {
      console.error('Erro ao deletar material:', error);
      toast({
        title: "Erro",
        description: `Erro ao excluir material: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Você tem certeza que deseja excluir o material <strong>"{materialName}"</strong>?
            </p>
            <p className="text-destructive font-medium">
              ⚠️ Esta ação não pode ser desfeita. Todos os comentários associados a este material também serão excluídos permanentemente.
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