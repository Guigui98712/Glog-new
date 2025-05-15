import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const RelatorioViewer = () => {
  const { id: obraId, relatorioId } = useParams<{ id: string, relatorioId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [relatorioHtml, setRelatorioHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelatorio = async () => {
      if (!obraId || !relatorioId) {
        toast({ title: 'Erro', description: 'IDs da obra ou relatório faltando.', variant: 'destructive' });
        navigate(`/obras/${obraId}/relatorios`); // Volta para a lista de relatórios
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('relatorios')
          .select('conteudo')
          .eq('id', relatorioId)
          .eq('obra_id', obraId)
          .single();

        if (error) throw error;

        if (data?.conteudo) {
          setRelatorioHtml(data.conteudo);
        } else {
          throw new Error('Conteúdo do relatório não encontrado.');
        }
      } catch (error: any) {
        console.error('Erro ao buscar relatório:', error);
        toast({
          title: 'Erro ao Carregar Relatório',
          description: error.message || 'Não foi possível carregar o conteúdo do relatório.',
          variant: 'destructive',
        });
        navigate(`/obras/${obraId}/relatorios`);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatorio();
  }, [obraId, relatorioId, navigate, toast]);

  return (
    <div className="relative h-screen w-screen bg-gray-100">
      {/* Botão Voltar Fixo */}
      <Button
        variant="secondary"
        size="sm"
        className="absolute top-4 left-4 z-10 shadow-md no-print"
        onClick={() => navigate(-1)} // Volta para a página anterior
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Conteúdo do Relatório em um Iframe */}
      {!loading && relatorioHtml && (
        <iframe
          srcDoc={relatorioHtml} // Carrega o HTML diretamente
          title="Visualização do Relatório"
          className="w-full h-full border-0 pt-16" // Adiciona padding-top para não sobrepor o botão
        />
      )}

      {!loading && !relatorioHtml && (
         <div className="absolute inset-0 flex items-center justify-center text-red-500">
          Erro ao carregar o relatório.
        </div>
      )}
    </div>
  );
};

export default RelatorioViewer; 