import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export default function Debug() {
  const { user, loading: authLoading } = useAuth();
  const [supabaseStatus, setSupabaseStatus] = useState<"checking" | "connected" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('obras').select('id').limit(1);
        if (error) {
          console.error("Erro na conexão Supabase:", error);
          setSupabaseStatus("error");
          setErrorMessage(error.message);
        } else {
          setSupabaseStatus("connected");
          setErrorMessage(null);
        }

        // Coletar informações de diagnóstico
        setDiagnosticInfo({
          userAgent: navigator.userAgent,
          url: window.location.href,
          screen: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error("Erro ao verificar conexão:", e);
        setSupabaseStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "Erro desconhecido");
      }
    };

    checkConnection();
  }, []);

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold">Página de Diagnóstico</h1>

      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-lg font-medium mb-2">Status da Aplicação</h2>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Autenticação:</span>
            <span className={`px-2 py-1 rounded text-xs ${
              authLoading ? "bg-yellow-100 text-yellow-800" : 
              user ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
              {authLoading ? "Verificando..." : user ? "Autenticado" : "Não Autenticado"}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>API Supabase:</span>
            <span className={`px-2 py-1 rounded text-xs ${
              supabaseStatus === "checking" ? "bg-yellow-100 text-yellow-800" : 
              supabaseStatus === "connected" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
              {supabaseStatus === "checking" ? "Verificando..." : 
               supabaseStatus === "connected" ? "Conectado" : "Erro de Conexão"}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Ações</h2>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
          <Button variant="outline" onClick={() => localStorage.clear()}>
            Limpar LocalStorage
          </Button>
          <Button variant="outline" onClick={() => sessionStorage.clear()}>
            Limpar SessionStorage
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Link to="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2">
            Ir para Home
          </Link>
          
          <Link to="/login" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            Ir para Login
          </Link>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-lg font-medium mb-2">Informações de Diagnóstico</h2>
        <pre className="text-xs overflow-auto bg-gray-100 p-3 rounded max-h-60">
          {JSON.stringify(diagnosticInfo, null, 2)}
        </pre>
      </div>
    </div>
  );
} 