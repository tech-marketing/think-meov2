import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateCompanyModalProps {
  onCompanyCreated?: () => void;
}

export const CreateCompanyModal = ({ onCompanyCreated }: CreateCompanyModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome da empresa é obrigatório",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('companies')
        .insert([{
          name: formData.name.trim()
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Empresa criada com sucesso",
      });

      setFormData({ name: "" });
      setOpen(false);
      onCompanyCreated?.();
    } catch (error) {
      console.error('Erro ao criar empresa:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao criar empresa",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Empresa</DialogTitle>
          <DialogDescription>
            Preencha os dados da nova empresa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="Digite o nome da empresa"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};