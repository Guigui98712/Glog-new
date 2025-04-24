import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  console.log('[DEBUG] ProtectedRoute - Estado:', { user: !!user, loading });

  // Mostrar um indicador de carregamento enquanto verifica a autenticação
  if (loading) {
    console.log('[DEBUG] ProtectedRoute - Carregando autenticação');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirecionar para a página de login se o usuário não estiver autenticado
  if (!user) {
    console.log('[DEBUG] ProtectedRoute - Usuário não autenticado, redirecionando para login');
    return <Navigate to="/login" />;
  }

  console.log('[DEBUG] ProtectedRoute - Usuário autenticado, renderizando conteúdo');
  return <>{children}</>;
};

export default ProtectedRoute; 