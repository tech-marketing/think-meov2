import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface EditUserModalProps {
  user: {
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    company_id?: string | null;
    allowed_companies?: string[];
  };
  companies: Array<{ id: string; name: string }>;
  onUserUpdated?: () => void;
}

interface FormData {
  full_name: string;
  role: string;
  company_id: string;
  allowed_companies: string[];
}

export const EditUserModal = ({ user, companies, onUserUpdated }: EditUserModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    full_name: user.full_name,
    role: user.role,
    company_id: user.company_id || "",
    allowed_companies: user.allowed_companies || [],
  });

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.role) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios"
      });
      return;
    }

    if (formData.role === 'collaborator' && formData.allowed_companies.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione pelo menos uma empresa para colaboradores"
      });
      return;
    }

    if (formData.role === 'client' && formData.allowed_companies.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione pelo menos uma empresa para clientes"
      });
      return;
    }

    setLoading(true);

    try {
      // Preparar dados para atualização
      const updateData: any = {
        full_name: formData.full_name,
        role: formData.role,
      };

      // Definir empresa e empresas permitidas baseado no role
      if (formData.role === 'admin') {
        // Admins mantêm a empresa atual para acesso completo aos dados
        updateData.allowed_companies = [];
      } else if (formData.role === 'collaborator') {
        updateData.company_id = null;
        updateData.allowed_companies = formData.allowed_companies;
      } else if (formData.role === 'client') {
        updateData.company_id = null;
        updateData.allowed_companies = formData.allowed_companies;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.user_id);

      if (error) {
        throw new Error(`Erro ao atualizar usuário: ${error.message}`);
      }

      toast({
        title: "Usuário atualizado!",
        description: `As informações de ${user.email} foram atualizadas com sucesso.`
      });
      
      setOpen(false);
      
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao atualizar usuário"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompanyToggle = (companyId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        allowed_companies: [...prev.allowed_companies, companyId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        allowed_companies: prev.allowed_companies.filter(id => id !== companyId)
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
            <strong>Email:</strong> {user.email}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="collaborator">Colaborador</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === "collaborator" && (
            <div className="space-y-2">
              <Label>Empresas (múltipla escolha)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                {companies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`company-${company.id}`}
                      checked={formData.allowed_companies.includes(company.id)}
                      onCheckedChange={(checked) => handleCompanyToggle(company.id, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`company-${company.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {company.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.role === "client" && (
            <div className="space-y-2">
              <Label>Empresas (múltipla escolha)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                {companies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`company-client-${company.id}`}
                      checked={formData.allowed_companies.includes(company.id)}
                      onCheckedChange={(checked) => handleCompanyToggle(company.id, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`company-client-${company.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {company.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};