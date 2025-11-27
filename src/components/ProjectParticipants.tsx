import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  UserMinus, 
  Crown, 
  User, 
  Eye,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Participant {
  id: string;
  user_id: string;
  role: 'owner' | 'collaborator' | 'viewer';
  full_name: string;
  email: string;
  avatar_url?: string | null;
  added_at: string;
}

interface ProjectParticipantsProps {
  projectId: string;
}

export const ProjectParticipants = ({ projectId }: ProjectParticipantsProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'collaborator' | 'viewer'>('collaborator');
  const [isOwner, setIsOwner] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const loadParticipants = async () => {
    try {
      setLoading(true);

      // Buscar participantes do projeto
      const { data: participantsData, error: participantsError } = await supabase
        .from('project_participants')
        .select('id, user_id, role, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (participantsError) throw participantsError;

      // Buscar perfis dos participantes
      const participantProfiles = await Promise.all(
        (participantsData || []).map(async (participant) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('user_id', participant.user_id)
            .maybeSingle();
          
          return {
            ...participant,
            profile
          };
        })
      );

      // Buscar dados do projeto para verificar o owner
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectData) throw new Error('Projeto não encontrado');

      // Verificar se o usuário atual é o owner
      setIsOwner(projectData.created_by === profile?.id);

      // Processar participantes
      const processedParticipants: Participant[] = participantProfiles.map(participant => ({
        id: participant.id,
        user_id: participant.user_id,
        role: participant.role as 'owner' | 'collaborator' | 'viewer',
        full_name: participant.profile?.full_name || 'Nome não encontrado',
        email: participant.profile?.email || 'Email não encontrado',
        avatar_url: participant.profile?.avatar_url,
        added_at: participant.created_at
      }));

      // Adicionar o criador do projeto como owner se não estiver na lista
      if (projectData.created_by) {
        const creatorExists = processedParticipants.some(p => p.user_id === projectData.created_by);
        
        if (!creatorExists) {
          const { data: creatorProfile, error: creatorError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', projectData.created_by)
            .maybeSingle();

          if (!creatorError && creatorProfile) {
            processedParticipants.unshift({
              id: 'owner',
              user_id: creatorProfile.id,
              role: 'owner',
              full_name: creatorProfile.full_name,
              email: creatorProfile.email,
              avatar_url: creatorProfile.avatar_url,
              added_at: new Date().toISOString()
            });
          }
        }
      }

      setParticipants(processedParticipants);

    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar participantes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = async () => {
    if (!searchEmail.trim()) {
      toast({
        title: "Erro",
        description: "Digite um email válido",
        variant: "destructive"
      });
      return;
    }

    try {
      // Buscar usuário pelo email
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email')
        .eq('email', searchEmail.trim())
        .maybeSingle();

      if (userError) {
        console.error('Error fetching profile:', userError);
        toast({
          title: "Erro",
          description: "Erro ao buscar usuário",
          variant: "destructive"
        });
        return;
      }

      if (!userProfile) {
        toast({
          title: "Erro",
          description: "Usuário não encontrado. O usuário precisa estar registrado no sistema.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se já é participante usando o user_id
      const isAlreadyParticipant = participants.some(p => p.user_id === userProfile.user_id);
      if (isAlreadyParticipant) {
        toast({
          title: "Erro",
          description: "Usuário já é participante do projeto",
          variant: "destructive"
        });
        return;
      }

      // Adicionar participante usando user_id correto
      const { error: insertError } = await supabase
        .from('project_participants')
        .insert({
          project_id: projectId,
          user_id: userProfile.user_id, // Usar user_id em vez de id
          role: selectedRole,
          added_by: profile?.id
        });

      if (insertError) throw insertError;

      // Enviar notificação ao participante adicionado
      if (profile?.user_id && userProfile.user_id !== profile.user_id) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .maybeSingle();

        if (!projectError && projectData) {
          await supabase
            .from('notifications')
            .insert({
              user_id: userProfile.user_id,
              project_id: projectId,
              type: 'project_invite',
              title: 'Você foi adicionado ao projeto',
              message: `Você foi adicionado ao projeto: "${projectData.name}"! Toque para ver!`
            });
        }
      }

      toast({
        title: "Sucesso",
        description: "Participante adicionado com sucesso"
      });

      setSearchEmail('');
      setShowAddModal(false);
      loadParticipants();

    } catch (error) {
      console.error('Erro ao adicionar participante:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar participante",
        variant: "destructive"
      });
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('project_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Participante removido com sucesso"
      });

      loadParticipants();

    } catch (error) {
      console.error('Erro ao remover participante:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover participante",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadParticipants();
  }, [projectId]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3" />;
      case 'collaborator':
        return <User className="h-3 w-3" />;
      case 'viewer':
        return <Eye className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietário';
      case 'collaborator':
        return 'Colaborador';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  const getRoleVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'collaborator':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="w-24 h-3 bg-muted rounded" />
              <div className="w-16 h-2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {participants.length} participante{participants.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {isOwner && (
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Participante
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Participante</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email do usuário</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={selectedRole} onValueChange={(value: 'collaborator' | 'viewer') => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborator">Colaborador - Pode enviar e revisar</SelectItem>
                      <SelectItem value="viewer">Visualizador - Apenas visualizar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addParticipant} className="w-full">
                  Adicionar Participante
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Lista de participantes */}
      <div className="space-y-3">
        {participants.map((participant) => (
          <div key={participant.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                {participant.avatar_url ? (
                  <AvatarImage src={participant.avatar_url} alt={participant.full_name} />
                ) : (
                  <AvatarFallback className="text-xs">
                    {participant.full_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{participant.full_name}</p>
                <div className="flex items-center space-x-2">
                  <Badge variant={getRoleVariant(participant.role)} className="text-xs">
                    {getRoleIcon(participant.role)}
                    <span className="ml-1">{getRoleLabel(participant.role)}</span>
                  </Badge>
                </div>
              </div>
            </div>
            
            {isOwner && participant.role !== 'owner' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeParticipant(participant.id)}
                className="text-destructive hover:text-destructive"
              >
                <UserMinus className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        
        {participants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum participante encontrado
          </p>
        )}
      </div>
    </div>
  );
};