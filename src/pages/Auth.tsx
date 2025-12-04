import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BackgroundShader from '@/components/ui/background-shader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ThinkMeoLogo } from "@/components/ThinkMeoLogo";
export default function Auth() {
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        error
      } = await signIn(formData.email, formData.password);
      if (error) {
        toast({
          title: 'Erro ao fazer login',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Login realizado com sucesso!',
          description: 'Redirecionando...'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro inesperado',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive'
      });
      return;
    }
    if (formData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 6 caracteres',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      // Verificar se o email está autorizado usando função segura
      const { data: authCheck, error: authCheckError } = await supabase
        .rpc('check_email_authorization', {
          user_email: formData.email
        })
        .single();

      if (authCheckError || !authCheck?.is_authorized) {
        toast({
          title: 'Email não autorizado',
          description: 'Este email não está autorizado para criar uma conta. Entre em contato com o administrador.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Criar conta
      const {
        error: signUpError
      } = await signUp(formData.email, formData.password, formData.fullName);
      if (signUpError) {
        toast({
          title: 'Erro ao criar conta',
          description: signUpError.message,
          variant: 'destructive'
        });
      } else {
        // Email será marcado como usado automaticamente pelo trigger handle_new_user
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Você já pode fazer login.'
        });

        // Limpar formulário e ir para aba de login
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          fullName: ''
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro inesperado',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  if (user) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>;
  }
  return <div className="min-h-screen w-full relative overflow-hidden">
    {/* Background Shader */}
    <BackgroundShader />

    {/* Theme Toggle - Top Right */}
    <div className="fixed top-6 right-6 z-50">
      <ThemeToggle variant="white" />
    </div>

    {/* Auth Card */}
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <Card className="w-full max-w-md auth-card-modern">
        {/* Logo dentro do Card */}
        <div className="text-center pt-1 pb-2.5">
          <ThinkMeoLogo className="mx-auto" size="xl" />
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
          </div>

          {/* Sign In Tab */}
          <TabsContent value="signin">
            <CardHeader className="space-y-1 pb-3 pt-1">
              <CardTitle className="text-xl font-brand text-center flex items-center justify-center gap-2">
                <span>Isso é um teste!</span>
                <span>Conecte-se ao</span>
                <ThinkMeoLogo size="sm" />
              </CardTitle>
              <CardDescription className="text-center">
                Entre para acessar sua inteligência de <br />marketing digital.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <Input id="signin-email" name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div>
                  <Input id="signin-password" name="password" type="password" placeholder="Senha" value={formData.password} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div className="flex justify-end -mt-1 mb-2">
                  <a
                    href="#"
                    className="text-xs text-foreground hover:underline"
                    onClick={e => {
                      e.preventDefault();
                      toast({
                        title: "Em breve",
                        description: "Funcionalidade de recuperação de senha será implementada em breve."
                      });
                    }}
                  >
                    Esqueceu sua senha?
                  </a>
                </div>
                <Button type="submit" className="w-full auth-button-gradient" disabled={loading}>
                  {loading ? <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </> : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup">
            <CardHeader className="space-y-1 pb-2 pt-1">
              <CardTitle className="text-xl text-black dark:text-foreground font-bold text-center flex items-center justify-center gap-2">
                <span>Junte-se ao</span>
                <ThinkMeoLogo size="sm" />
              </CardTitle>
              <CardDescription className="text-sm text-neutral-500 dark:text-muted-foreground text-center">
                Preencha os dados para se cadastrar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="signup-name" className="text-black dark:text-foreground text-sm font-semibold">
                    Nome completo
                  </Label>
                  <Input id="signup-name" name="fullName" type="text" placeholder="Seu nome completo" value={formData.fullName} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-black dark:text-foreground text-sm font-semibold">
                    Email
                  </Label>
                  <Input id="signup-email" name="email" type="email" placeholder="seu@email.com" value={formData.email} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password" className="text-black dark:text-foreground text-sm font-semibold">
                    Senha
                  </Label>
                  <Input id="signup-password" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-confirm-password" className="text-black dark:text-foreground text-sm font-semibold">
                    Confirmar senha
                  </Label>
                  <Input id="signup-confirm-password" name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleInputChange} required disabled={loading} className="auth-input" />
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-xs">
                  <span className="font-semibold text-foreground">Nota:</span>
                  <span className="text-muted-foreground"> Apenas emails previamente autorizados pelo administrador podem criar uma conta.</span>
                </div>
                <Button type="submit" className="w-full auth-button-gradient" disabled={loading}>
                  {loading ? <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </> : 'Criar conta'}
                </Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Institutional Text */}

    </div>
  </div>;
}