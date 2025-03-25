import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { hapticFeedback, HapticType } from '@/lib/haptics';
import useDevice from '@/hooks/useDevice';
import { Checkbox } from '@/components/ui/checkbox';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const { signIn, signUp, resetPassword, setPersistentLogin, user, loading } = useAuth();
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

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe seu email.",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      const { error, success } = await resetPassword(resetEmail);
      
      if (error) {
        toast({
          title: "Erro na recuperação de senha",
          description: error.message || "Não foi possível enviar o email de recuperação. Verifique se o email está correto.",
          variant: "destructive"
        });
      } else if (success) {
        toast({
          title: "Email enviado com sucesso! ✉️",
          description: "Verifique sua caixa de entrada para instruções sobre como redefinir sua senha. Se não encontrar, verifique também a pasta de spam.",
        });
        setIsResetDialogOpen(false);
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
                  lang="pt-BR"
                  autoCapitalize="words"
                  disabled={isLoading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isLoading}
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
                disabled={isLoading}
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

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber instruções de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Digite seu email"
                disabled={isResetting}
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsResetDialogOpen(false)}
              disabled={isResetting}
              className="min-h-[44px]"
              hapticType={HapticType.LIGHT}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleResetPassword} 
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
              ) : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login; 