import { useState, useRef } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
  users_count?: number;
  projects_count?: number;
}

interface ManageCompanyModalProps {
  company: Company;
  onCompanyUpdated?: () => void;
}

export const ManageCompanyModal = ({ company, onCompanyUpdated }: ManageCompanyModalProps) => {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: company.name
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem",
      });
      return;
    }

    // Validar tamanho (max 50MB)
    const MAX_LOGO_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_LOGO_SIZE) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A imagem deve ter no máximo 50MB",
      });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return company.logo_url || null;

    try {
      console.log('Fazendo upload da logo para Google Cloud Storage:', logoFile.name);
      
      // Create FormData with file
      const formData = new FormData();
      formData.append('file', logoFile);
      formData.append('path', 'company-logos');

      // Upload through edge function (bypasses CORS)
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        'gcs-upload-file',
        {
          body: formData,
        }
      );

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      if (!uploadData?.publicUrl) {
        throw new Error('No public URL returned from upload');
      }

      console.log('Logo uploaded to GCS:', uploadData.publicUrl);
      return uploadData.publicUrl;
      
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);
      throw error;
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
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
      let logoUrl = company.logo_url;

      // Upload da logo se houver
      if (logoFile) {
        logoUrl = await uploadLogo();
      } else if (logoPreview === null && company.logo_url) {
        // Se o preview foi removido, deletar a logo do storage
        logoUrl = null;
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name.trim(),
          logo_url: logoUrl
        })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Empresa atualizada com sucesso",
      });

      setOpen(false);
      onCompanyUpdated?.();
    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao atualizar empresa",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // Verificar se há usuários ou projetos associados
    if ((company.users_count || 0) > 0 || (company.projects_count || 0) > 0) {
      toast({
        variant: "destructive",
        title: "Não é possível excluir",
        description: "Esta empresa possui usuários ou projetos associados. Remova-os primeiro.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Empresa removida com sucesso",
      });

      setDeleteDialogOpen(false);
      setOpen(false);
      onCompanyUpdated?.();
    } catch (error) {
      console.error('Erro ao remover empresa:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao remover empresa",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Gerenciar Empresa</DialogTitle>
            <DialogDescription className="text-sm">
              Edite os dados da empresa ou remova-a do sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Logo da Empresa</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Avatar className="h-16 w-16">
                    {logoPreview ? (
                      <AvatarImage src={logoPreview} alt="Logo da empresa" />
                    ) : (
                      <AvatarFallback className="text-lg">
                        {formData.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {logoPreview ? 'Trocar Logo' : 'Adicionar Logo'}
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveLogo}
                        className="h-7 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="name" className="text-sm">Nome da Empresa</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da empresa"
                  required
                  className="mt-1 h-8"
                />
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Estatísticas</Label>
                <div className="mt-1 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
                  {company.users_count || 0} usuários • {company.projects_count || 0} projetos
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading}
                size="sm"
                className="h-8 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remover
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                size="sm"
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                size="sm"
                className="h-8 text-xs"
              >
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a empresa "{company.name}"? Esta ação não pode ser desfeita.
              {((company.users_count || 0) > 0 || (company.projects_count || 0) > 0) && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
                  <strong>Atenção:</strong> Esta empresa possui {company.users_count || 0} usuários e {company.projects_count || 0} projetos associados. 
                  Você precisa remover ou transferir esses dados antes de excluir a empresa.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading || (company.users_count || 0) > 0 || (company.projects_count || 0) > 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};