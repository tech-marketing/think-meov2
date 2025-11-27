import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'client' | 'collaborator';
  company_id: string | null;
  allowed_companies: string[];
  first_login_required?: boolean;
  invitation_status?: string;
  invitation_sent_at?: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: () => Promise<{ error: any }>;
  updateProfileData: (updates: Partial<Profile>) => Promise<{ error: any }>;
  forceProfileRefresh: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  

  const fetchProfile = async (userId: string, retryCount: number = 0) => {
    try {
      console.log(`Fetching profile for user: ${userId} (attempt ${retryCount + 1})`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar perfil",
          description: "Não foi possível carregar os dados do usuário.",
        });
        return;
      }

      if (!data) {
        console.warn(`No profile found for user: ${userId} (attempt ${retryCount + 1})`);
        
        // Retry up to 3 times with delay for new signups
        if (retryCount < 3) {
          console.log(`Retrying profile fetch in 2 seconds...`);
          setTimeout(() => {
            fetchProfile(userId, retryCount + 1);
          }, 2000);
          return;
        }
        
        // Profile should have been created by trigger, but let's handle this case
        toast({
          variant: "destructive",
          title: "Perfil não encontrado",
          description: "Tente fazer logout e login novamente.",
        });
        return;
      }

      console.log('Profile fetched successfully:', {
        id: data.id,
        email: data.email,
        role: data.role,
        company_id: data.company_id,
        allowed_companies: data.allowed_companies
      });
      
      setProfile({ 
        ...data,
        role: data.role as 'admin' | 'client' | 'collaborator',
        allowed_companies: (data.allowed_companies as string[]) || []
      });
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Falha ao buscar perfil do usuário.",
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch to avoid blocking auth state change
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        const errorMessage = error.message === 'Email not confirmed' 
          ? 'Verifique seu email para confirmar a conta ou desabilite a confirmação nas configurações do Supabase.'
          : error.message;
          
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: errorMessage,
        });
      } else {
        toast({
          title: "Login realizado",
          description: "Bem-vindo de volta!",
        });
      }
      
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message,
        });
      } else {
        toast({
          title: "Cadastro realizado",
          description: "Verifique seu email para confirmar a conta.",
        });
      }
      
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async () => {
    try {
      if (!user) throw new Error('No user found');
      
      // Refresh profile data
      await fetchProfile(user.id);
      
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateProfileData = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error('No user found');
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh profile data
      await fetchProfile(user.id);
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      return { error: null };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
      return { error };
    }
  };

  const forceProfileRefresh = async () => {
    try {
      if (!user) throw new Error('No user found');
      
      console.log('Force refreshing profile for user:', user.id);
      
      // Clear current profile to show loading state
      setProfile(null);
      
      // Force fetch with no retry logic (immediate)
      await fetchProfile(user.id, 0);
      
      return { error: null };
    } catch (error) {
      console.error('Error in forceProfileRefresh:', error);
      return { error };
    }
  };


  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateProfileData,
    forceProfileRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};