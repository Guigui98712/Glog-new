import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";
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
import SelecionarObraProjetos from "./pages/SelecionarObraProjetos";
import PendenciasObra from "./pages/PendenciasObra";
import DefinicoesObra from "@/pages/DefinicoesObra";
import { Toaster } from "./components/ui/toaster";
import "./App.css";
import { supabase } from "@/lib/supabase";
import DemandaObra from './pages/DemandaObra';
import { DemandaRelatorios } from "./pages/DemandaRelatorios";
import Projetos from "./pages/Projetos";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import RelatorioViewer from "./pages/RelatorioViewer";
import TestSpellChecker from "./pages/TestSpellChecker";
import TestNativeSpellCheck from "./pages/TestNativeSpellCheck";
import TestSmartSpellChecker from "./pages/TestSmartSpellChecker";
import Debug from "./pages/Debug";

// Componente para capturar erros
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[APP ERROR]", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
          <div className="p-6 bg-white rounded-lg shadow-lg max-w-md w-full">
            <h1 className="text-xl font-bold text-red-600 mb-4">Ocorreu um erro na aplicação</h1>
            <p className="mb-2">Por favor, recarregue a página e tente novamente.</p>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40 mb-4">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

    // Adiciona o listener para o evento popstate (botão de voltar) para Web
    window.addEventListener('popstate', handlePopState);

    // Adiciona o listener do botão voltar para Android nativo
    if (Capacitor.isNativePlatform()) {
      const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        console.log("[DEBUG] Botão voltar pressionado no Android", { canGoBack });
        
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
        } else if (location.pathname === '/obras') {
          // Perguntar se o usuário deseja sair (não fechamos o app diretamente)
          if (window.confirm('Deseja sair do aplicativo?')) {
            // Redirecionar para o login em vez de fechar o app
            navigate('/login');
          }
        }
      });
      
      // Limpeza do listener ao desmontar
      return () => {
        window.removeEventListener('popstate', handlePopState);
        backButtonListener.remove();
      };
    }

    // Limpeza do listener ao desmontar (apenas para web)
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location, navigate]);

  return null;
};

function App() {
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    console.log("[APP] Componente App montado");
    
    // Verificar conexão com Supabase
    const checkSupabaseConnection = async () => {
      try {
        const { data, error } = await supabase.from('obras').select('id').limit(1);
        console.log("[APP] Teste de conexão Supabase:", error ? "Falhou" : "Sucesso");
        if (error) console.error("[APP] Erro de conexão:", error);
      } catch (e) {
        console.error("[APP] Erro ao testar conexão Supabase:", e);
      }
      setInitialized(true);
    };
    
    checkSupabaseConnection();
    
    return () => {
      console.log("[APP] Componente App desmontado");
    };
  }, []);
  
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-2">Inicializando aplicação...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <NavigationManager />
        <Routes>
          {/* Redirecionar a rota raiz com base no estado de autenticação */}
          <Route path="/" element={<RedirectBasedOnAuth />} />
          
          {/* Rotas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/debug" element={<Debug />} />
          
          {/* Páginas de teste do corretor ortográfico */}
          <Route path="/test-spellchecker" element={<TestSpellChecker />} />
          <Route path="/test-native-spellcheck" element={<TestNativeSpellCheck />} />
          <Route path="/test-smart-spellchecker" element={<TestSmartSpellChecker />} />
          
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
            <Route path=":id/relatorios/:relatorioId/view" element={<RelatorioViewer />} />
            <Route path=":id/definicoes" element={<DefinicoesObra />} />
            <Route path=":id/demanda" element={<DemandaObra />} />
            <Route path=":id/demanda/relatorios" element={<DemandaRelatorios />} />
            <Route path=":id/projetos" element={<Projetos />} />
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
            path="/projetos" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SelecionarObraProjetos />} />
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
      </>
    </ErrorBoundary>
  );
}

export default App;
