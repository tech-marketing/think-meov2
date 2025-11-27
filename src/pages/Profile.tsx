import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
const Profile = () => {
  const {
    profile,
    loading
  } = useAuth();
  const {
    toast
  } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [username, setUsername] = useState((profile as any)?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar estados quando o profile mudar
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername((profile as any)?.username || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);
  const handleAvatarUpdate = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };
  const handleSave = async () => {
    if (!profile?.id) return;

    // Validar username
    if (username) {
      const usernameRegex = /^[a-z0-9._]+$/;
      if (!usernameRegex.test(username)) {
        toast({
          variant: "destructive",
          title: "Username inválido",
          description: "Use apenas letras minúsculas, números, pontos e underscores"
        });
        return;
      }
      if (username.length < 3 || username.length > 30) {
        toast({
          variant: "destructive",
          title: "Username inválido",
          description: "O username deve ter entre 3 e 30 caracteres"
        });
        return;
      }

      // Verificar se username já existe
      if (username !== (profile as any)?.username) {
        const {
          data: existingUser
        } = await supabase.from('profiles').select('id').eq('username', username).neq('id', profile.id).single();
        if (existingUser) {
          toast({
            variant: "destructive",
            title: "Username indisponível",
            description: "Este username já está sendo usado"
          });
          return;
        }
      }
    }
    try {
      setIsSaving(true);
      const {
        error
      } = await supabase.from('profiles').update({
        full_name: fullName,
        username: username || null,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      if (error) throw error;
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso"
      });
      setIsEditing(false);

      // Refresh page to update auth context
      window.location.reload();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar informações do perfil"
      });
    } finally {
      setIsSaving(false);
    }
  };
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'collaborator':
        return 'Colaborador';
      case 'client':
        return 'Cliente';
      default:
        return role;
    }
  };
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'collaborator':
        return 'secondary';
      default:
        return 'outline';
    }
  };
  if (loading) {
    return <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="bg-muted/30 rounded-lg p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>;
  }
  if (!profile) {
    return <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="bg-muted/30 rounded-lg p-8">
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Perfil não encontrado</p>
          </div>
        </div>
      </div>;
  }
  return <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" />
          Informações do Perfil
        </h1>
      </div>

      {/* Profile Section */}
      <div className="bg-muted/30 rounded-lg p-8 space-y-6">
        {/* Avatar and Basic Info */}
        <div className="flex items-start gap-6">
          <AvatarUpload currentAvatarUrl={avatarUrl} onAvatarUpdate={handleAvatarUpdate} />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold">{profile.full_name}</h2>
              <Badge variant="default" className="bg-primary hover:bg-primary">
                {getRoleLabel(profile.role)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-sm">{profile.email}</span>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 pt-4">
          {/* Three Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Nome Completo
              </Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} disabled={!isEditing} placeholder="Digite seu nome completo" className="bg-background" />
            </div>

            {/* Email - Read Only */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <div className="h-10 px-3 py-2 bg-background/50 rounded-md border border-input text-sm flex items-center text-muted-foreground">
                {profile.email}
              </div>
            </div>

            {/* Função - Read Only */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Função</Label>
              <div className="h-10 px-3 py-2 bg-background/50 rounded-md border border-input flex items-center gap-2">
                
                <span className="text-sm">{getRoleLabel(profile.role)}</span>
              </div>
            </div>
          </div>

          {/* Username - Full Width */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Nome de Usuário
            </Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} disabled={!isEditing} placeholder="seu.username" className="bg-background" />
            <p className="text-xs text-muted-foreground">
              Letras, números, pontos e underscores (3-30 caracteres)
            </p>
          </div>

          {/* Action Button */}
          {!isEditing ? <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90">
              Editar Perfil
            </Button> : <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button variant="outline" onClick={() => {
            setIsEditing(false);
            setFullName(profile.full_name || "");
            setUsername((profile as any)?.username || "");
          }} disabled={isSaving}>
                Cancelar
              </Button>
            </div>}
        </div>
      </div>
    </div>;
};
export default Profile;