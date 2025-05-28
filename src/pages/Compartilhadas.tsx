import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { listarObrasCompartilhadas, listarCompartilhamentosEnviados, excluirCompartilhamento } from "@/lib/api";

const Compartilhadas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compartilhamentosEnviados, setCompartilhamentosEnviados] = useState<any[]>([]);
  const [loadingEnviados, setLoadingEnviados] = useState(true);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

  useEffect(() => {
    carregarObrasCompartilhadas();
    carregarCompartilhamentosEnviados();
  }, []);

  const carregarObrasCompartilhadas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarObrasCompartilhadas();
      setObras(data || []);
    } catch (error) {
      setError('Não foi possível carregar as obras compartilhadas. Por favor, tente novamente.');
      toast({
        title: "Erro ao carregar obras compartilhadas",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarCompartilhamentosEnviados = async () => {
    try {
      setLoadingEnviados(true);
      const data = await listarCompartilhamentosEnviados();
      setCompartilhamentosEnviados(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar compartilhamentos enviados",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoadingEnviados(false);
    }
  };

  const handleVerDetalhes = (obra: any) => {
    navigate(`/obras/${obra.obra_id || obra.id}`);
  };

  const handleRemoverCompartilhamento = async (id: number) => {
    setRemovendoId(id);
    try {
      await excluirCompartilhamento(id);
      toast({ title: "Compartilhamento removido" });
      setCompartilhamentosEnviados(prev => prev.filter(c => c.id !== id));
    } catch (error: any) {
      toast({
        title: "Erro ao remover compartilhamento",
        description: error.message || "Não foi possível remover o compartilhamento.",
        variant: "destructive"
      });
    } finally {
      setRemovendoId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Obras Compartilhadas com Você</h1>
      {loading ? (
        <div>Carregando...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : obras.length === 0 ? (
        <div>Nenhuma obra compartilhada encontrada.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {obras.map((obra) => (
            <Card key={obra.obra_id || obra.id} className="p-4 cursor-pointer hover:shadow-lg" onClick={() => handleVerDetalhes(obra)}>
              <div className="font-semibold text-lg mb-2">{obra.nome}</div>
              <div className="text-sm text-gray-600 mb-2">{obra.endereco}</div>
              <Progress value={obra.progresso || 0} className="mb-2" />
              <div className="text-xs text-gray-500">Progresso: {obra.progresso || 0}%</div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-2">Obras que você compartilhou</h2>
        {loadingEnviados ? (
          <div>Carregando...</div>
        ) : compartilhamentosEnviados.length === 0 ? (
          <div>Você ainda não compartilhou nenhuma obra.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              compartilhamentosEnviados.reduce((acc, c) => {
                const obraId = c.obra_id;
                if (!acc[obraId]) acc[obraId] = { obra: c.obras, compartilhamentos: [] };
                acc[obraId].compartilhamentos.push(c);
                return acc;
              }, {} as Record<string, { obra: any, compartilhamentos: any[] }>)
            ).map(([obraId, { obra, compartilhamentos }]) => (
              <Card key={obraId} className="p-4">
                <div className="font-semibold text-lg mb-2">{obra?.nome || 'Obra'}</div>
                <div className="text-sm text-gray-600 mb-2">{obra?.endereco}</div>
                <div className="mb-2 font-medium">Compartilhado com:</div>
                <ul className="mb-2">
                  {compartilhamentos.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-1">
                      <span>{c.colaborador_email}</span>
                      <Button size="sm" variant="destructive" onClick={() => handleRemoverCompartilhamento(c.id)} disabled={removendoId === c.id}>
                        {removendoId === c.id ? "Removendo..." : "Remover"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compartilhadas; 