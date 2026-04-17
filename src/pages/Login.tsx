import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hapticFeedback, HapticType } from '@/lib/haptics';
import useDevice from '@/hooks/useDevice';
import { Checkbox } from '@/components/ui/checkbox';

type ResetStep = 'email' | 'code' | 'password';

type PasswordRecoveryCooldownResponse = {
  allowed: boolean;
  wait_seconds: number;
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const isRecoveryRpcAvailableRef = useRef(true);
  
  const {
    signIn,
    signUp,
    sendPasswordRecoveryCode,
    verifyPasswordRecoveryCode,
    updatePassword,
    setPersistentLogin,
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const device = useDevice();

  useEffect(() => {
    if (user && !loading) {
      console.log('[LOGIN] Usuário já autenticado, redirecionando para /obras');
      navigate('/obras');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (setPersistentLogin) {
      setPersistentLogin(rememberMe);
    }
  }, [rememberMe, setPersistentLogin]);

  useEffect(() => {
    if (!isResetDialogOpen) {
      return;
    }

    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isResetDialogOpen, resendCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (device.isTouchDevice) {
      hapticFeedback(HapticType.MEDIUM);
    }
    
    setIsLoading(true);

    try {
      if (isRegister) {
        // Cadastro
        if (!name.trim()) {
          toast({
            title: "Campo obrigatório",
            description: "Por favor, informe seu nome completo.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        if (!email.trim() || !email.includes('@')) {
          toast({
            title: "Email inválido",
            description: "Por favor, informe um endereço de email válido.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        if (password.length < 6) {
          toast({
            title: "Senha muito curta",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        if (password !== confirmPassword) {
          toast({
            title: "Senhas não conferem",
            description: "A senha e a confirmação de senha devem ser iguais.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        const { error, user } = await signUp(email, password, name);
        
        if (error) {
          console.error('[LOGIN] Signup error:', error);
          
          // Mensagens de erro personalizadas
          if (error.message?.includes('email already')) {
            toast({
              title: "Email já cadastrado",
              description: "Este email já está sendo usado por outra conta. Tente fazer login ou use outro email.",
              variant: "destructive"
            });
          } else if (error.message?.includes('password')) {
            toast({
              title: "Senha inválida",
              description: "A senha deve ter pelo menos 6 caracteres e incluir letras e números.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Erro no cadastro",
              description: error.message || "Não foi possível criar sua conta. Verifique suas informações e tente novamente.",
              variant: "destructive"
            });
          }
        } else if (user) {
          toast({
            title: "Conta criada com sucesso! 🎉",
            description: "Sua conta foi criada e você já está logado. Bem-vindo ao sistema!",
          });
          navigate('/obras');
        }
      } else {
        // Login
        console.log('[LOGIN] Attempting login with:', email);
        
        if (!email.trim() || !email.includes('@')) {
          toast({
            title: "Email inválido",
            description: "Por favor, informe um endereço de email válido.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        if (!password.trim()) {
          toast({
            title: "Senha obrigatória",
            description: "Por favor, informe sua senha.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        const { error, success } = await signIn(email, password);
        
        if (error) {
          console.error('[LOGIN] Login error:', error);
          
          // Mensagens de erro personalizadas
          if (error.message?.includes('Invalid login')) {
            toast({
              title: "Credenciais inválidas",
              description: "Email ou senha incorretos. Verifique suas informações e tente novamente.",
              variant: "destructive"
            });
          } else if (error.message?.includes('Email not confirmed')) {
            toast({
              title: "Email não confirmado",
              description: "Por favor, verifique sua caixa de entrada e confirme seu email antes de fazer login.",
              variant: "destructive"
            });
          } else if (error.message?.includes('too many requests')) {
            toast({
              title: "Muitas tentativas",
              description: "Você fez muitas tentativas de login. Por favor, aguarde alguns minutos antes de tentar novamente.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Erro no login",
              description: error.message || "Não foi possível fazer login. Verifique sua conexão e tente novamente.",
              variant: "destructive"
            });
          }
        } else if (success) {
          console.log('[LOGIN] Login successful, navigating to /obras');
          toast({
            title: "Login bem-sucedido! 👋",
            description: "Você foi conectado com sucesso. Bem-vindo de volta!",
          });
          navigate('/obras');
        } else {
          console.error('[LOGIN] Login failed without error');
          toast({
            title: "Falha no login",
            description: "Não foi possível fazer login. Verifique suas credenciais e tente novamente.",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('[LOGIN] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro inesperado. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetRecoveryDialogState = () => {
    setResetStep('email');
    setResetEmail('');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResendCountdown(0);
    setIsResetting(false);
  };

  const closeResetDialog = () => {
    setIsResetDialogOpen(false);
    resetRecoveryDialogState();
  };

  const checkRecoveryCooldown = async (emailToCheck: string) => {
    if (!isRecoveryRpcAvailableRef.current) {
      return { allowed: true, waitSeconds: 50 };
    }

    const { data, error } = await supabase.rpc('check_password_recovery_resend', {
      p_email: emailToCheck,
      p_cooldown_seconds: 50,
    });

    if (error) {
      const message = String(error.message || '').toLowerCase();
      const code = String((error as any).code || '').toLowerCase();

      // Fallback para ambientes sem a RPC aplicada ou cache do PostgREST desatualizado.
      if (
        message.includes('404') ||
        message.includes('not found') ||
        code === '404' ||
        code === 'pgrst202'
      ) {
        isRecoveryRpcAvailableRef.current = false;
        console.warn('[LOGIN] RPC check_password_recovery_resend indisponível. Usando cooldown local.');
        return { allowed: true, waitSeconds: 50 };
      }

      // Não bloqueia recuperação por erro de banco (ex: digest/pgcrypto).
      console.warn('[LOGIN] Falha na RPC de cooldown. Usando cooldown local.', error);
      return { allowed: true, waitSeconds: 50 };
    }

    const normalized = Array.isArray(data) ? data[0] : data;
    const result = normalized as PasswordRecoveryCooldownResponse | null;

    if (!result) {
      return { allowed: true, waitSeconds: 0 };
    }

    return {
      allowed: Boolean(result.allowed),
      waitSeconds: Number(result.wait_seconds || 0),
    };
  };

  const handleSendRecoveryCode = async () => {
    const emailToRecover = resetEmail.trim().toLowerCase();

    if (!emailToRecover) {
      toast({
        title: "Erro",
        description: "Por favor, informe seu email.",
        variant: "destructive"
      });
      return;
    }

    if (!emailToRecover.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Informe um email válido para recuperar sua senha.",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      const cooldown = await checkRecoveryCooldown(emailToRecover);

      if (!cooldown.allowed) {
        const waitTime = Math.max(1, cooldown.waitSeconds);
        setResendCountdown(waitTime);
        setResetStep('code');
        toast({
          title: "Aguarde para reenviar",
          description: `Você poderá solicitar um novo código em ${waitTime}s.`,
          variant: "destructive"
        });
        return;
      }

      const { error, success } = await sendPasswordRecoveryCode(emailToRecover);
      
      if (error) {
        toast({
          title: "Erro na recuperação de senha",
          description: error.message || "Não foi possível enviar o email de recuperação. Verifique se o email está correto.",
          variant: "destructive"
        });
      } else if (success) {
        setResetEmail(emailToRecover);
        toast({
          title: "Email enviado com sucesso! ✉️",
          description: "Enviamos um código de recuperação. Digite o código recebido para continuar.",
        });
        setResetStep('code');
        setResendCountdown(Math.max(0, cooldown.waitSeconds || 50));
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    const code = resetCode.trim();

    if (!code) {
      toast({
        title: "Código obrigatório",
        description: "Digite o código de recuperação enviado para o seu email.",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      const { error, success } = await verifyPasswordRecoveryCode(resetEmail.trim(), code);

      if (error || !success) {
        toast({
          title: "Código inválido",
          description: error?.message || "O código informado é inválido ou expirou. Solicite um novo código.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Código validado",
        description: "Agora defina sua nova senha.",
      });
      setResetStep('password');
    } catch (error: any) {
      toast({
        title: "Erro ao validar código",
        description: error?.message || "Não foi possível validar o código agora.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleUpdateRecoveredPassword = async () => {
    if (resetNewPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A senha e a confirmação devem ser idênticas.",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      const { error, success } = await updatePassword(resetNewPassword);

      if (error || !success) {
        toast({
          title: "Falha ao redefinir senha",
          description: error?.message || "Não foi possível atualizar a senha. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Senha redefinida com sucesso",
        description: "Você já pode entrar com a nova senha.",
      });

      closeResetDialog();
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error?.message || "Não foi possível concluir a redefinição de senha.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || isResetting) {
      return;
    }
    await handleSendRecoveryCode();
  };

  const toggleRegister = () => {
    if (device.isTouchDevice) {
      hapticFeedback(HapticType.LIGHT);
    }
    setIsRegister(!isRegister);
    // Limpar os campos ao alternar entre login e cadastro
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 safe-all">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">G-Log</CardTitle>
          <CardDescription className="text-center">
            {isRegister ? 'Crie sua conta para continuar' : 'Entre com sua conta para continuar'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  spellCheck={true}
                  autoCorrect="on"
                  lang="pt-BR"
                  autoCapitalize="words"
                  inputMode="text"
                  autoComplete="name"
                  disabled={isLoading}
                  className="min-h-[44px]"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-keyboard-profile="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                autoCorrect="off"
                disabled={isLoading}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                inputMode="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                disabled={isLoading}
                className="min-h-[44px]"
              />
            </div>
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  className="min-h-[44px]"
                />
              </div>
            )}
            {!isRegister && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="rememberMe" 
                  checked={rememberMe} 
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Manter conectado
                </label>
              </div>
            )}
            {!isRegister && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isLoading}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              loading={isLoading}
              hapticType={HapticType.MEDIUM}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aguarde...
                </>
              ) : isRegister ? 'Cadastrar' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={toggleRegister}
            hapticType={HapticType.LIGHT}
          >
            {isRegister ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Cadastre-se'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={isResetDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeResetDialog();
            return;
          }
          setIsResetDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              {resetStep === 'email' && 'Digite seu email para receber o código de recuperação.'}
              {resetStep === 'code' && 'Digite o código enviado para seu email para validar a recuperação.'}
              {resetStep === 'password' && 'Digite e confirme sua nova senha.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {resetStep === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  data-keyboard-profile="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoCorrect="off"
                  disabled={isResetting}
                  className="min-h-[44px]"
                />
              </div>
            )}

            {resetStep === 'code' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Código de recuperação</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoCorrect="off"
                    disabled={isResetting}
                    placeholder="Digite o código recebido"
                    className="min-h-[44px]"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enviado para: {resetEmail}
                </p>
              </>
            )}

            {resetStep === 'password' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password">Nova senha</Label>
                  <Input
                    id="reset-new-password"
                    type="password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isResetting}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="reset-confirm-password"
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={isResetting}
                    className="min-h-[44px]"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeResetDialog}
              disabled={isResetting}
              className="min-h-[44px]"
              hapticType={HapticType.LIGHT}
            >
              Cancelar
            </Button>

            {resetStep === 'email' && (
              <Button 
                onClick={handleSendRecoveryCode}
                disabled={isResetting}
                loading={isResetting}
                className="min-h-[44px]"
                hapticType={HapticType.MEDIUM}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : 'Enviar código'}
              </Button>
            )}

            {resetStep === 'code' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleResendCode}
                  disabled={isResetting || resendCountdown > 0}
                  className="min-h-[44px]"
                  hapticType={HapticType.LIGHT}
                >
                  {resendCountdown > 0 ? `Reenviar (${resendCountdown}s)` : 'Reenviar código'}
                </Button>
                <Button 
                  onClick={handleVerifyRecoveryCode}
                  disabled={isResetting}
                  loading={isResetting}
                  className="min-h-[44px]"
                  hapticType={HapticType.MEDIUM}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : 'Validar código'}
                </Button>
              </>
            )}

            {resetStep === 'password' && (
              <Button 
                onClick={handleUpdateRecoveredPassword}
                disabled={isResetting}
                loading={isResetting}
                className="min-h-[44px]"
                hapticType={HapticType.MEDIUM}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : 'Redefinir senha'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login; 