import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  // Mostrar um indicador de carregamento enquanto verifica a autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirecionar para a página de login se o usuário não estiver autenticado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Renderizar o conteúdo protegido se o usuário estiver autenticado
  return children;
};

export default ProtectedRoute; 