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
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

interface CreateUserModalProps {
  onUserCreated?: () => void;
  companies: Array<{ id: string; name: string }>;
}

interface FormData {
  email: string;
  role: string;
  companyId: string;
  companyIds: string[];
}

export const CreateUserModal = ({ onUserCreated, companies }: CreateUserModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: "",
    role: "client",
    companyId: "",
    companyIds: [],
  });

  const { toast } = useToast();
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.role) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios"
      });
      return;
    }

    if (formData.role === 'collaborator' && formData.companyIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione pelo menos uma empresa para colaboradores"
      });
      return;
    }

    if (formData.role === 'client' && formData.companyIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione pelo menos uma empresa para clientes"
      });
      return;
    }

    setLoading(true);

    try {
      // Preparar dados da autorização
    const authData: any = {
      email: formData.email.toLowerCase().trim(),
      role: formData.role,
      created_by: profile?.id,
    };

      // Definir empresa e empresas permitidas baseado no role
      if (formData.role === 'admin') {
        authData.company_id = null;
        authData.allowed_companies = [];
      } else if (formData.role === 'collaborator') {
        authData.company_id = null;
        authData.allowed_companies = formData.companyIds;
      } else if (formData.role === 'client') {
        authData.company_id = null;
        authData.allowed_companies = formData.companyIds;
      }

      // Verificar se o email já existe na autorização
      const { data: existingEmail } = await supabase
        .from('authorized_emails')
        .select('id, used_at, email')
        .eq('email', formData.email)
        .maybeSingle();

      // Verificar se existe perfil correspondente
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email)
        .maybeSingle();

      if (existingEmail) {
        if (existingEmail.used_at && existingProfile) {
          // Email usado e perfil existe - não pode re-autorizar
          throw new Error('Este email já está registrado no sistema.');
        } else if (existingEmail.used_at && !existingProfile) {
          // Email marcado como usado mas sem perfil - permitir re-autorização
          console.log('Email órfão detectado, permitindo re-autorização para:', formData.email);
          
          // Atualizar autorização existente
          const { error: updateError } = await supabase
            .from('authorized_emails')
            .update({
              role: authData.role,
              company_id: authData.company_id,
              allowed_companies: authData.allowed_companies,
              used_at: null, // Resetar para permitir novo cadastro
              created_by: authData.created_by
            })
            .eq('id', existingEmail.id);

          if (updateError) {
            throw new Error(`Erro ao atualizar autorização: ${updateError.message}`);
          }

          toast({
            title: "Email re-autorizado!",
            description: `O email ${formData.email} foi re-autorizado e pode se cadastrar novamente na plataforma.`
          });
          
          setOpen(false);
          setFormData({
            email: "",
            role: "client",
            companyId: "",
            companyIds: [],
          });
          
          if (onUserCreated) {
            onUserCreated();
          }
          return;
          
        } else if (!existingEmail.used_at) {
          // Email autorizado mas não usado - atualizar
          const { error: updateError } = await supabase
            .from('authorized_emails')
            .update({
              role: authData.role,
              company_id: authData.company_id,
              allowed_companies: authData.allowed_companies,
              created_by: authData.created_by
            })
            .eq('id', existingEmail.id);

          if (updateError) {
            throw new Error(`Erro ao atualizar autorização: ${updateError.message}`);
          }

          toast({
            title: "Autorização atualizada!",
            description: `A autorização para ${formData.email} foi atualizada.`
          });
          
          setOpen(false);
          setFormData({
            email: "",
            role: "client", 
            companyId: "",
            companyIds: [],
          });
          
          if (onUserCreated) {
            onUserCreated();
          }
          return;
        }
      }

      // Inserir autorização de email
      const { error } = await supabase
        .from('authorized_emails')
        .insert(authData);

      if (error) {
        throw new Error(`Erro ao autorizar email: ${error.message}`);
      }

      toast({
        title: "Email autorizado!",
        description: `O email ${formData.email} agora pode se cadastrar na plataforma.`
      });
      
      setOpen(false);
      setFormData({
        email: "",
        role: "client",
        companyId: "",
        companyIds: [],
      });
      
      if (onUserCreated) {
        onUserCreated();
      }
    } catch (error: any) {
      console.error('Error authorizing email:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao autorizar email"
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
        companyIds: [...prev.companyIds, companyId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        companyIds: prev.companyIds.filter(id => id !== companyId)
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          Autorizar Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Autorizar Email para Cadastro</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
            <strong>Como funciona:</strong> Você está autorizando este email a se cadastrar na plataforma. O usuário poderá então acessar a página de login e criar sua própria conta.
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email do usuário</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Digite o email do usuário"
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
                      checked={formData.companyIds.includes(company.id)}
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
                      checked={formData.companyIds.includes(company.id)}
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
              {loading ? "Autorizando..." : "Autorizar Email"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};