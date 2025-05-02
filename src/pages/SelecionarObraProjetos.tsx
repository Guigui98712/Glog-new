import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { listarObras } from '@/lib/api';

interface Obra {
  id: string;
  nome: string;
  endereco: string;
}

export default function SelecionarObraProjetos() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    carregarObras();
  }, []);

  const carregarObras = async () => {
    try {
      setLoading(true);
      const data = await listarObras();
      setObras(data || []);
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as obras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Selecionar Obra</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {obras.map((obra) => (
          <Card 
            key={obra.id}
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate(`/obras/${obra.id}/projetos`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{obra.nome}</CardTitle>
              <p className="text-sm text-gray-500">{obra.endereco}</p>
            </CardHeader>
          </Card>
        ))}
        {obras.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            Nenhuma obra encontrada
          </div>
        )}
      </div>
    </div>
  );
} 