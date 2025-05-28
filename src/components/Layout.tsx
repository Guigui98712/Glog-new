import React, { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Building2, Calculator, RefreshCw, LogOut, User, Menu, X, ChevronLeft, FolderKanban, Share as ShareIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ConstructionLogo from "./ConstructionLogo";
import useDevice from "@/hooks/useDevice";
import { hapticFeedback, HapticType } from "@/lib/haptics";
import { NotificationsIndicator } from "@/components/ui/NotificationsIndicator";
import { NotificationsDialog } from "@/components/dialogs/NotificationsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const device = useDevice();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Determinar o título da página atual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/obras')) return 'Obras';
    if (path.startsWith('/orcamentos')) return 'Orçamentos';
    if (path.startsWith('/diario')) return 'Diário de Obra';
    if (path.startsWith('/relatorios')) return 'Relatórios';
    if (path.startsWith('/projetos')) return 'Projetos';
    return 'G-Log';
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Efeito para controlar a visibilidade do header ao rolar
  useEffect(() => {
    if (!device.isMobile) return;

    const handleScroll = () => {
      const currentScrollTop = window.scrollY;
      if (currentScrollTop > lastScrollTop && currentScrollTop > 60) {
        // Rolando para baixo
        setIsHeaderVisible(false);
      } else {
        // Rolando para cima
        setIsHeaderVisible(true);
      }
      setLastScrollTop(currentScrollTop);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollTop, device.isMobile]);

  // Fechar menu móvel quando mudar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      setIsCheckingConnection(true);
      setError(null);
      
      // Verificar se as variáveis de ambiente estão definidas
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        setError('Variáveis de ambiente do Supabase não definidas. Verifique o arquivo .env.local');
        return;
      }
      
      console.log('Verificando conexão com Supabase...');
      console.log('URL:', supabaseUrl);
      
      // Tentar fazer uma consulta simples
      const { data, error } = await supabase.from('obras').select('id').limit(1);
      
      if (error) {
        console.error('Erro na consulta ao Supabase:', error);
        
        if (error.code === 'PGRST301') {
          setError('Erro de CORS. Verifique a configuração do CORS no Supabase.');
        } else if (error.code === '42P01') {
          setError('Tabela não encontrada. Verifique se as tabelas foram criadas no Supabase.');
        } else {
          setError(`Erro ao conectar com o banco de dados: ${error.message}`);
        }
        return;
      }
      
      console.log('Conexão com Supabase OK');
      setError(null);
    } catch (err: any) {
      console.error('Erro na conexão com Supabase:', err);
      setError(`Erro ao conectar com o banco de dados: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      setIsCheckingConnection(false);
    }
  };

  const menuItems = [
    { icon: Building2, label: "Obras", path: "/obras" },
    { icon: ShareIcon, label: "Compartilhadas", path: "/compartilhadas" },
    { icon: Calculator, label: "Orçamentos", path: "/orcamentos" },
    { icon: FolderKanban, label: "Projetos", path: "/projetos" }
  ];

  const handleLogout = async () => {
    if (device.isTouchDevice) {
      hapticFeedback(HapticType.MEDIUM);
    }
    await signOut();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    if (device.isTouchDevice) {
      hapticFeedback(HapticType.LIGHT);
    }
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Obter o nome do usuário
  const userName = user?.user_metadata?.name || user?.email || 'Usuário';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-600 mb-4 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Erro de Conexão</h2>
          <p>{error}</p>
        </div>
        <button 
          onClick={checkConnection}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark flex items-center min-h-[44px]"
          disabled={isCheckingConnection}
        >
          {isCheckingConnection ? (
            <>
              <RefreshCw className="animate-spin mr-2 h-4 w-4" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </>
          )}
        </button>
        <div className="mt-4 text-sm text-gray-600 max-w-md text-center">
          <p>Verifique se:</p>
          <ul className="list-disc list-inside mt-2 text-left">
            <li>O Supabase está online e acessível</li>
            <li>As variáveis de ambiente estão configuradas corretamente</li>
            <li>O CORS está configurado para permitir requisições de localhost:8083</li>
            <li>As tabelas foram criadas no banco de dados</li>
          </ul>
        </div>
      </div>
    );
  }

  // Verificar se estamos em uma rota de detalhes para mostrar botão de voltar em dispositivos móveis
  const isDetailRoute = location.pathname.includes('/obra/') || 
                        location.pathname.includes('/orcamento/') ||
                        location.pathname.includes('/relatorio/');

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header com gradiente e sombra */}
      <header 
        className={`bg-gradient-to-r from-blue-600 to-blue-800 shadow-md fixed top-0 left-0 right-0 z-50 safe-top transition-transform duration-300 ${
          !isHeaderVisible && device.isMobile ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          <div className="flex items-center">
            {device.isMobile && isDetailRoute ? (
              <button 
                onClick={() => navigate(-1)}
                className="mr-2 text-white p-2 rounded-full hover:bg-white/10 active:bg-white/20 touch-target"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <Link to="/obras" className="flex items-center">
                {device.isMobile ? (
                  <ConstructionLogo size="sm" variant="icon" darkMode={true} />
                ) : (
                  <ConstructionLogo size="md" variant="full" darkMode={true} />
                )}
              </Link>
            )}
            
            {device.isMobile && (
              <h1 className="text-white font-medium ml-2 truncate max-w-[150px]">
                {getPageTitle()}
              </h1>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Indicador de notificações */}
            <NotificationsIndicator 
              onClick={() => setNotificationsOpen(true)} 
              className="text-white" 
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40"
                  hapticType={HapticType.LIGHT}
                >
                  <User className="h-5 w-5 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || 'Usuário'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <button 
              className="md:hidden text-white focus:outline-none p-2 rounded-full hover:bg-white/10 active:bg-white/20 touch-target"
              onClick={toggleMobileMenu}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Diálogo de notificações */}
      <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />

      {/* Menu móvel com animação */}
      <div 
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
        }`} 
        onClick={toggleMobileMenu}
      >
        <div 
          className={`absolute top-16 right-0 w-64 bg-white h-[calc(100%-4rem)] overflow-y-auto shadow-lg safe-bottom transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`} 
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200">
            <ConstructionLogo size="sm" variant="full" />
          </div>
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-md transition-colors touch-target ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                  }`}
                  onClick={() => {
                    if (device.isTouchDevice) {
                      hapticFeedback(HapticType.LIGHT);
                    }
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="border-t border-gray-200 my-2 pt-2">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-3 rounded-md transition-colors text-red-600 w-full text-left hover:bg-gray-100 active:bg-gray-200 touch-target"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      <div className="flex pt-16">
        {/* Sidebar para desktop */}
        <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 pt-16 hidden md:block">
          <div className="p-4 border-b border-gray-200">
            <ConstructionLogo size="sm" variant="full" />
          </div>
          <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100%-5rem)]">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Conteúdo principal */}
        <main className={`flex-1 ${device.isMobile ? 'w-full' : 'md:ml-64'} p-4 md:p-6 pt-6 pb-20 smooth-scroll`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;