import { useState } from "react";
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
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeleteUserModalProps {
  user: {
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
  };
  onUserDeleted?: () => void;
}

export const DeleteUserModal = ({ user, onUserDeleted }: DeleteUserModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Primeiro chamar edge function para deletar usuário da auth (enquanto o perfil ainda existe para verificação de admin)
      const { data, error: functionError } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: user.user_id
        }
      });

      if (functionError || !data?.success) {
        throw new Error(`Erro ao deletar usuário da auth: ${functionError?.message || data?.error || 'Erro desconhecido'}`);
      }

      // Depois limpar referências de materials que foram revisados por este usuário
      const { error: materialsError } = await supabase
        .from('materials')
        .update({ reviewed_by: null })
        .eq('reviewed_by', user.id);

      if (materialsError) {
        console.error('Erro ao limpar referências de materiais:', materialsError);
        // Não falhamos aqui pois o usuário já foi deletado do auth
      }

      // Por último, deletar o perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.user_id);

      if (profileError) {
        console.error('Erro ao deletar perfil:', profileError);
        // Não falhamos aqui pois o usuário já foi deletado do auth
      }
      
      toast({
        title: "Usuário excluído",
        description: `O usuário ${user.email} foi removido com sucesso.`
      });
      
      setOpen(false);
      
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao excluir usuário"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir o usuário <strong>{user.full_name}</strong> ({user.email})?
            </p>
            <p className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded-lg">
              <strong>Atenção:</strong> Esta ação não pode ser desfeita. O usuário será completamente removido do sistema.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Excluindo..." : "Excluir Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};