import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se o usuário chegou aqui através de um link de redefinição de senha
    const hash = window.location.hash;
    if (!hash || !hash.includes('type=recovery')) {
      toast({
        title: "Link inválido",
        description: "O link de redefinição de senha é inválido ou expirou. Solicite um novo link na página de login.",
        variant: "destructive"
      });
      navigate('/login');
    }
  }, [navigate, toast]);

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
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
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
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

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