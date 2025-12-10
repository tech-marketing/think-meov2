import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BackgroundShader from '@/components/ui/background-shader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ThinkMeoLogo } from "@/components/ThinkMeoLogo";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if we have a valid session from the password reset link
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao verificar sessão:', error);
          setSessionError('Erro ao verificar link. Tente novamente.');
          setVerifying(false);
          return;
        }

        if (session?.user) {
          setSessionValid(true);
          setUserEmail(session.user.email || null);
        } else {
          // Listen for auth state changes (when user clicks the link)
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log('Auth event:', event);
              if (event === 'PASSWORD_RECOVERY' && session?.user) {
                setSessionValid(true);
                setUserEmail(session.user.email || null);
                setVerifying(false);
              } else if (event === 'SIGNED_IN' && session?.user) {
                // Some browsers trigger SIGNED_IN instead of PASSWORD_RECOVERY
                setSessionValid(true);
                setUserEmail(session.user.email || null);
                setVerifying(false);
              }
            }
          );

          // Set a timeout - if no session after 3 seconds, show error
          setTimeout(() => {
            setVerifying(false);
          }, 3000);

          return () => {
            subscription.unsubscribe();
          };
        }
      } catch (error) {
        console.error('Erro:', error);
        setSessionError('Erro ao processar link.');
      } finally {
        setVerifying(false);
      }
    };

    checkSession();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 12) return 'A senha deve ter pelo menos 12 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra maiúscula';
    if (!/[a-z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra minúscula';
    if (!/[0-9]/.test(pwd)) return 'A senha deve conter pelo menos um número';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'A senha deve conter pelo menos um caractere especial';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive'
      });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast({
        title: 'Senha fraca',
        description: passwordError,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Use Supabase native updateUser to change password
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: 'Senha atualizada!',
        description: 'Sua senha foi alterada com sucesso.'
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message || 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while verifying
  if (verifying) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden">
        <BackgroundShader />
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle variant="white" />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md auth-card-modern">
            <div className="text-center pt-1 pb-2.5">
              <ThinkMeoLogo size="sm" className="justify-center" />
            </div>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Verificando link...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error if session is invalid
  if (!sessionValid) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden">
        <BackgroundShader />
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle variant="white" />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md auth-card-modern">
            <div className="text-center pt-1 pb-2.5">
              <ThinkMeoLogo size="sm" className="justify-center" />
            </div>
            <CardHeader className="space-y-1 pb-3 pt-1">
              <CardTitle className="text-xl font-brand text-center text-destructive flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Link Inválido
              </CardTitle>
              <CardDescription className="text-center">
                {sessionError || 'Este link de redefinição de senha é inválido ou expirou.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground text-sm text-center">
                Por favor, solicite um novo link de redefinição de senha.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/auth')}
                className="mt-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <BackgroundShader />
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle variant="white" />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md auth-card-modern">
          <div className="text-center pt-1 pb-2.5">
            <ThinkMeoLogo size="sm" className="justify-center" />
          </div>
          
          {success ? (
            <>
              <CardHeader className="space-y-1 pb-3 pt-1">
                <CardTitle className="text-xl font-brand text-center text-green-600 flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Senha Atualizada!
                </CardTitle>
                <CardDescription className="text-center">
                  Sua senha foi alterada com sucesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground text-sm text-center">
                  Você será redirecionado para a página de login em instantes...
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="mt-2"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Ir para login agora
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-3 pt-1">
                <CardTitle className="text-xl font-brand text-center">
                  Redefinir Senha
                </CardTitle>
                <CardDescription className="text-center">
                  {userEmail ? (
                    <>Criando nova senha para <strong>{userEmail}</strong></>
                  ) : (
                    'Digite sua nova senha abaixo'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="auth-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="auth-input"
                    />
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-foreground">A senha deve conter:</p>
                    <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
                      <li>Mínimo de 12 caracteres</li>
                      <li>Letra maiúscula (A-Z)</li>
                      <li>Letra minúscula (a-z)</li>
                      <li>Número (0-9)</li>
                      <li>Caractere especial (!@#$%...)</li>
                    </ul>
                  </div>
                  <Button
                    type="submit"
                    className="w-full auth-button-gradient"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : 'Atualizar senha'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate('/auth')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao login
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
