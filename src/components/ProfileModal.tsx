import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Building, Shield, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { profile } = useAuth();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'collaborator': return 'Colaborador';
      case 'client': return 'Cliente';
      default: return role;
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'collaborator': return 'default';
      case 'client': return 'secondary';
      default: return 'outline';
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Meu Perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Foto de Perfil e Informações Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <Avatar className="h-20 w-20 flex-shrink-0">
                  <AvatarImage 
                    src={profile.avatar_url} 
                    alt="Foto de perfil" 
                    className="object-cover"
                  />
                  <AvatarFallback className="text-xl">
                    {profile.full_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Informações */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={profile.full_name || ''}
                        disabled
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          @
                        </span>
                        <Input
                          id="username"
                          value={(profile as any)?.username || ''}
                          disabled
                          placeholder="seu.username"
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profile.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações da conta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações da Conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Função</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Badge variant={getRoleVariant(profile.role)}>
                      {getRoleLabel(profile.role)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Think Company</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Membro desde</Label>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fechar */}
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};