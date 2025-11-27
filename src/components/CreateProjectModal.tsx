import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
}

interface Company {
  id: string;
  name: string;
}

export const CreateProjectModal = ({ open, onOpenChange, onProjectCreated }: CreateProjectModalProps) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    company_id: "",
    due_date: undefined as Date | undefined,
  });

  const { profile } = useAuth();

  // Auto-select user's company when modal opens
  useEffect(() => {
    if (open && profile?.company_id && !formData.company_id) {
      setFormData(prev => ({ ...prev, company_id: profile.company_id! }));
    }
  }, [open, profile?.company_id, formData.company_id]);

  // Carregar empresas quando o modal abrir
  useEffect(() => {
    if (open) {
      loadCompanies();
    }
  }, [open]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
      toast.error("Erro ao carregar empresas");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.id) {
      toast.error("Erro de autenticação. Faça login novamente.");
      return;
    }
    
    if (!formData.name.trim() || !formData.company_id) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Check authentication before inserting
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { error } = await supabase
        .from("projects")
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          company_id: formData.company_id,
          created_by: profile.id,
          due_date: formData.due_date ? formData.due_date.toISOString() : null,
          status: "active"
        });

      if (error) {
        if (error.code === '42501') {
          toast.error("Erro de permissão. Verifique se você está logado e tem permissão para criar projetos.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Projeto criado com sucesso!");
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        company_id: "",
        due_date: undefined,
      });
      
      onOpenChange(false);
      onProjectCreated?.();

      // Atualizar página para refletir mudanças
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      toast.error("Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Projeto</DialogTitle>
          <DialogDescription>
            Preencha as informações para criar um novo projeto
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Projeto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Campanha Black Friday"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa *</Label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o objetivo do projeto..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Projeto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};