import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Função para extrair todos os possíveis tokens da URL
  const extractTokensFromUrl = () => {
    const url = window.location.href;
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    
    // Tokens possíveis
    const accessToken = hashParams.get('access_token');
    const token = searchParams.get('token') || hashParams.get('token');
    const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
    
    // Log dos parâmetros para fins de depuração
    console.log('[RESET] URL completa:', url);
    console.log('[RESET] URL hash completo:', hash);
    console.log('[RESET] URL search params:', location.search);
    console.log('[RESET] URL pathname:', location.pathname);
    console.log('[RESET] Hash params:', Object.fromEntries(hashParams.entries()));
    console.log('[RESET] Tokens encontrados:', { 
      accessToken: !!accessToken, 
      token: !!token, 
      refreshToken: !!refreshToken 
    });
    
    return { accessToken, token, refreshToken };
  };

  useEffect(() => {
    const setupSession = async () => {
      setIsLoading(true); // Iniciar carregamento
      try {
        // Extrair tokens da URL - A função já existe e faz logs
        extractTokensFromUrl();
        
        // Monitorar mudanças de estado de autenticação especificamente para recuperação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[RESET] onAuthStateChange Event:', event, 'Session:', !!session);
          
          if (event === "PASSWORD_RECOVERY") {
            console.log('[RESET] Evento PASSWORD_RECOVERY recebido, token é válido.');
            setHasValidToken(true);
            setTokenError(false);
            setIsLoading(false); // Parar carregamento
            
            // Atualizar estado da sessão localmente se necessário, mas já deve estar pelo evento
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            console.log('[RESET] Sessão atual após PASSWORD_RECOVERY:', !!currentSession);
            
            // Desinscrever após receber o evento para evitar execuções múltiplas
            if (subscription) {
              subscription.unsubscribe();
              console.log('[RESET] Desinscrito do onAuthStateChange.');
            }
          } else {
            // Se outro evento ocorrer (ex: SIGNED_OUT), pode indicar problema
            console.log('[RESET] Evento inesperado recebido:', event);
          }
        });

        // Verificar se a sessão já foi estabelecida pelo clique no link
        // O listener acima deve capturar o evento `PASSWORD_RECOVERY`
        // Se após um tempo não capturar, pode ser um link inválido
        console.log('[RESET] Aguardando evento PASSWORD_RECOVERY...');
        
        // Adiciona um timeout para caso o evento não chegue (link inválido/expirado)
        const timeoutId = setTimeout(() => {
          if (!hasValidToken && !isLoading) { // Verificar também se não está mais carregando
            console.log('[RESET] Timeout (120s): Evento PASSWORD_RECOVERY não recebido. Marcando como erro.');
            setTokenError(true);
            setHasValidToken(false);
            setIsLoading(false); // Garantir que o loading pare
            if (subscription) {
              subscription.unsubscribe();
              console.log('[RESET] Desinscrito do onAuthStateChange devido a timeout.');
            }
          }
        }, 120000); // Aguarda 120 segundos

        // Limpeza do useEffect
        return () => {
          clearTimeout(timeoutId);
          if (subscription) {
            subscription.unsubscribe();
            console.log('[RESET] Desinscrito do onAuthStateChange na limpeza do useEffect.');
          }
        };

      } catch (error) {
        console.error('[RESET] Erro ao configurar sessão:', error);
        setTokenError(true);
        setHasValidToken(false);
        setIsLoading(false); // Parar carregamento
      }
    };
    
    setupSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez na montagem

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Senhas diferentes",
        description: "As senhas digitadas não coincidem. Por favor, verifique e tente novamente.",
        variant: "destructive"
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres para maior segurança.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('[RESET] Tentando atualizar senha');
      
      // Atualizar a senha
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      console.log('[RESET] Resultado da atualização:', { error });
      
      if (error) {
        toast({
          title: "Falha na redefinição",
          description: error.message || "Não foi possível redefinir sua senha. O link pode ter expirado.",
          variant: "destructive"
        });
      } else {
        setIsSuccess(true);
        toast({
          title: "Senha redefinida com sucesso! 🔒",
          description: "Sua senha foi atualizada. Você será redirecionado para a página de login em instantes.",
        });
        
        // Redirecionar para a página de login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error: any) {
      console.error('[RESET] Erro ao atualizar senha:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, informe um endereço de email válido.",
        variant: "destructive"
      });
      return;
    }
    
    setIsRecoveryLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: redirectUrl,
      });
      
      if (error) {
        toast({
          title: "Erro ao solicitar recuperação",
          description: error.message || "Não foi possível enviar o email de recuperação. Verifique se o email está correto.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email enviado com sucesso! ✉️",
          description: "Verifique sua caixa de entrada para instruções sobre como redefinir sua senha. Se não encontrar, verifique também a pasta de spam.",
        });
        setIsRecoveryDialogOpen(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro inesperado. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Sessão Inválida</CardTitle>
            <CardDescription className="text-center">
              Não foi possível encontrar uma sessão válida para redefinir sua senha.
              O link pode ter expirado ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4 py-4">
              <RefreshCw className="h-12 w-12 text-red-500" />
              <p className="text-center text-sm">
                Por favor, solicite um novo link de recuperação de senha.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              onClick={() => setIsRecoveryDialogOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Solicitar novo link
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Voltar para o login
            </Button>
          </CardFooter>
        </Card>

        <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Recuperar senha</DialogTitle>
              <DialogDescription>
                Digite seu email para receber um novo link de recuperação de senha.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestNewLink}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    disabled={isRecoveryLoading}
                    placeholder="Digite seu email"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsRecoveryDialogOpen(false)}
                  disabled={isRecoveryLoading}
                  type="button"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={isRecoveryLoading}
                >
                  {isRecoveryLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : 'Enviar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!hasValidToken && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Verificando Link</CardTitle>
            <CardDescription className="text-center">
              Estamos verificando a validade do seu link de recuperação de senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Redefinir Senha</CardTitle>
          <CardDescription className="text-center">
            {isSuccess 
              ? "Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login em instantes." 
              : "Digite sua nova senha abaixo para recuperar o acesso à sua conta."}
          </CardDescription>
        </CardHeader>
        {!isSuccess && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aguarde...
                  </>
                ) : 'Redefinir Senha'}
              </Button>
            </form>
          </CardContent>
        )}
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Voltar para o login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResetPassword; 