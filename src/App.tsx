import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Obras from "./pages/Obras";
import ObraDetalhes from "./pages/ObraDetalhes";
import DiarioObra from "./pages/DiarioObra";
import Relatorios from "./pages/Relatorios";
import Orcamentos from "./pages/Orcamentos";
import NovoOrcamento from "./pages/NovoOrcamento";
import ComparativoOrcamento from "./pages/ComparativoOrcamento";
import NotFound from "./pages/NotFound";
import SelecionarObraDiario from "./pages/SelecionarObraDiario";
import SelecionarObraRelatorio from "./pages/SelecionarObraRelatorio";
import PendenciasObra from "./pages/PendenciasObra";
import DefinicoesObra from "@/pages/DefinicoesObra";
import { Toaster } from "./components/ui/toaster";
import "./App.css";
import { supabase } from "@/lib/supabase";

// Componente para redirecionar com base no estado de autenticação
const RedirectBasedOnAuth = () => {
  const { user, loading } = useAuth();
  
  // Mostrar um indicador de carregamento enquanto verifica a autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Se o usuário já estiver autenticado, redirecionar para a página principal
  if (user) {
    return <Navigate to="/obras" replace />;
  }
  
  // Caso contrário, redirecionar para a página de login
  return <Navigate to="/login" replace />;
};

// Componente para gerenciar o histórico de navegação e o botão de voltar
const NavigationManager = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Armazena o histórico de navegação no localStorage
    const history = JSON.parse(localStorage.getItem('navigationHistory') || '[]');
    
    // Adiciona a localização atual ao histórico se for diferente da última
    if (history.length === 0 || history[history.length - 1] !== location.pathname) {
      history.push(location.pathname);
      localStorage.setItem('navigationHistory', JSON.stringify(history));
    }

    // Função para lidar com o botão de voltar do navegador
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      
      // Obtém o histórico atualizado
      const currentHistory = JSON.parse(localStorage.getItem('navigationHistory') || '[]');
      
      // Se houver mais de uma entrada no histórico, podemos voltar
      if (currentHistory.length > 1) {
        // Remove a entrada atual
        currentHistory.pop();
        
        // Obtém a última entrada do histórico
        const previousPath = currentHistory[currentHistory.length - 1];
        
        // Atualiza o histórico no localStorage
        localStorage.setItem('navigationHistory', JSON.stringify(currentHistory));
        
        // Navega para a rota anterior
        navigate(previousPath);
      } else {
        // Se estiver na página inicial, pergunte se o usuário deseja sair
        if (location.pathname === '/obras') {
          if (window.confirm('Deseja sair do aplicativo?')) {
            // Aqui você pode implementar uma lógica para "sair" do aplicativo
            // Como não podemos realmente fechar o aplicativo, podemos redirecionar para uma página específica
            navigate('/login');
          }
        }
      }
    };

    // Adiciona o listener para o evento popstate (botão de voltar)
    window.addEventListener('popstate', handlePopState);

    // Remove o listener quando o componente for desmontado
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location, navigate]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavigationManager />
        <Routes>
          {/* Redirecionar a rota raiz com base no estado de autenticação */}
          <Route path="/" element={<RedirectBasedOnAuth />} />
          
          {/* Rotas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Rotas protegidas que requerem autenticação */}
          <Route 
            path="/obras" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Obras />} />
            <Route path=":id" element={<ObraDetalhes />} />
            <Route path=":id/pendencias" element={<PendenciasObra />} />
            <Route path=":id/diario" element={<DiarioObra />} />
            <Route path=":id/relatorios" element={<Relatorios />} />
            <Route path=":id/definicoes" element={<DefinicoesObra />} />
          </Route>
          
          <Route 
            path="/diario" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SelecionarObraDiario />} />
          </Route>
          
          <Route 
            path="/relatorios" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SelecionarObraRelatorio />} />
          </Route>
          
          <Route 
            path="/orcamentos" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Orcamentos />} />
            <Route path="novo/:obraId" element={<NovoOrcamento />} />
            <Route path="editar/:id" element={<NovoOrcamento />} />
            <Route path=":id" element={<ComparativoOrcamento />} />
            <Route path="comparativo/:id" element={<ComparativoOrcamento />} />
          </Route>
          
          <Route 
            path="/404" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<NotFound />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
