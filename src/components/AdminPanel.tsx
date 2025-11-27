import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Shield, Plus, Settings, Loader2, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreateUserModal } from "./CreateUserModal";
import { DeleteUserModal } from "./DeleteUserModal";
import { EditUserModal } from "./EditUserModal";
import { CreateCompanyModal } from "./CreateCompanyModal";
import { ManageCompanyModal } from "./ManageCompanyModal";
import { MigrateToGCSButton } from "./MigrateToGCSButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'client' | 'collaborator';
  company_id: string | null;
  company_name?: string;
  invitation_status?: string;
  invitation_sent_at?: string;
  is_authorized?: boolean;
  created_at?: string;
  used_at?: string;
}

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
  users_count?: number;
  projects_count?: number;
}

export const AdminPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompanies: 0,
    totalAdmins: 0,
  });
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Buscar usuários registrados (que têm user_id)
      // Admins podem ver todos os usuários
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          *,
          companies(name)
        `)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Buscar emails autorizados que ainda não foram usados (aguardando cadastro)
      // Admins podem ver todos os emails autorizados
      const { data: authorizedData, error: authorizedError } = await supabase
        .from('authorized_emails')
        .select(`
          *,
          companies(name)
        `)
        .is('used_at', null)
        .order('created_at', { ascending: false });

      if (authorizedError) throw authorizedError;

      // Buscar empresas
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;

      // Buscar contagens para cada empresa
      const companiesWithStats = await Promise.all(
        (companiesData || []).map(async (company) => {
          const { count: usersCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);

          const { count: projectsCount } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);

          return {
            ...company,
            users_count: usersCount || 0,
            projects_count: projectsCount || 0,
          };
        })
      );

      // Processar dados dos usuários registrados
      const processedUsers: User[] = (usersData || []).map(user => ({
        ...user,
        role: user.role as 'admin' | 'client' | 'collaborator',
        company_name: user.companies?.name || 'Think Company',
        is_authorized: false,
      }));

      // Processar dados dos emails autorizados (apenas os que realmente ainda não foram usados)
      const processedAuthorized: User[] = (authorizedData || [])
        .map(auth => ({
          id: auth.id,
          user_id: '', // Não tem user_id ainda
          email: auth.email,
          full_name: 'Aguardando cadastro',
          role: auth.role as 'admin' | 'client' | 'collaborator',
          company_id: auth.company_id,
          company_name: auth.companies?.name || 'Think Company',
          is_authorized: true,
          created_at: auth.created_at,
          used_at: auth.used_at,
        }));

      // Combinar usuários registrados e autorizados
      const allUsers = [...processedUsers, ...processedAuthorized];

      setUsers(allUsers);
      setCompanies(companiesWithStats);

      // Calcular estatísticas (apenas usuários registrados)
      setStats({
        totalUsers: processedUsers.length,
        totalCompanies: companiesWithStats.length,
        totalAdmins: processedUsers.filter(user => user.role === 'admin').length,
      });

    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar dados do painel administrativo",
      });
    } finally {
      setLoading(false);
    }
  };

  // Remoção do useEffect duplicado já que adicionei um novo

  const handleUserCreated = () => {
    loadData(); // Recarregar dados após criar usuário
  };

  // Função para sincronizar dados inconsistentes
  const syncInconsistentData = async () => {
    try {
      console.log('Iniciando sincronização de dados...');
      
      // Chamar a função do banco para sincronizar
      const { error } = await supabase.rpc('sync_profile_with_authorized_email');
      
      if (error) {
        console.warn('Erro ao sincronizar via RPC:', error);
      }
      
      console.log('Sincronização concluída');
    } catch (error) {
      console.error('Erro na sincronização:', error);
    }
  };

  // Executar sincronização automaticamente junto com o carregamento
  useEffect(() => {
    const initializeData = async () => {
      await syncInconsistentData();
      await loadData();
    };
    
    initializeData();
  }, []);

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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'collaborator':
        return 'Colaborador';
      case 'client':
        return 'Cliente';
      default:
        return role;
    }
  };

  const handleDeleteAuthorizedEmail = async (authorizedEmailId: string) => {
    try {
      const { error } = await supabase
        .from('authorized_emails')
        .delete()
        .eq('id', authorizedEmailId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Autorização de cadastro removida com sucesso",
      });

      loadData(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao deletar email autorizado:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao remover autorização de cadastro",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        </div>
        <MigrateToGCSButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-soft transition-shadow">
          <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Usuários
            </CardTitle>
            <Users className="h-4 w-4 text-primary ml-2" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-soft transition-shadow">
          <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Empresas Ativas
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary ml-2" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-soft transition-shadow">
          <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administradores
            </CardTitle>
            <Shield className="h-4 w-4 text-primary ml-2" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{stats.totalAdmins}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Usuários
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <CreateUserModal companies={companies} onUserCreated={handleUserCreated} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(showAllUsers ? users : users.slice(0, 4)).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.full_name}</div>
                  <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.company_name}</div>
                  {user.is_authorized && (
                    <div className="text-xs text-orange-600">
                      Aguardando cadastro • {user.created_at && new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {user.invitation_status && !user.is_authorized && (
                    <div className="text-xs text-muted-foreground">
                      Status: {user.user_id ? 'Ativo' : (user.invitation_status === 'pending' ? 'Convite enviado' : user.invitation_status)}
                      {user.invitation_sent_at && (
                        <span className="ml-1">
                          • {new Date(user.invitation_sent_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                  {user.is_authorized && (
                    <Badge variant="secondary" className="text-xs">
                      Autorizado
                    </Badge>
                  )}
                  {user.invitation_status === 'pending' && !user.is_authorized && !user.user_id && (
                    <Badge variant="secondary" className="text-xs">
                      Pendente
                    </Badge>
                  )}
                  {(user.invitation_status === 'accepted' || user.user_id) && !user.is_authorized && (
                    <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                      Ativo
                    </Badge>
                  )}
                  {user.is_authorized ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteAuthorizedEmail(user.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <EditUserModal user={user} companies={companies} onUserUpdated={handleUserCreated} />
                      <DeleteUserModal user={user} onUserDeleted={handleUserCreated} />
                    </>
                  )}
                </div>
              </div>
            ))}
            {users.length > 4 && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowAllUsers(!showAllUsers)}
              >
                {showAllUsers ? 'Mostrar menos' : `Ver todos os usuários (${users.length})`}
              </Button>
            )}
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Companies Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gerenciar Empresas
            </CardTitle>
            <CreateCompanyModal onCompanyCreated={loadData} />
          </CardHeader>
          <CardContent className="space-y-4">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-muted/20 rounded">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    {company.logo_url ? (
                      <AvatarImage src={company.logo_url} alt={company.name} />
                    ) : (
                      <AvatarFallback className="text-sm">
                        {company.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{company.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {company.users_count || 0} usuários • {company.projects_count || 0} projetos
                    </div>
                  </div>
                </div>
                <ManageCompanyModal 
                  company={company}
                  onCompanyUpdated={loadData}
                />
              </div>
            ))}
            {companies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma empresa encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};