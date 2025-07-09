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

  // Função utilitária para limpar as tags <html>, <head> e <body> do HTML salvo
  function extrairConteudoRelatorio(html: string): string {
    // Remove <html>, </html>, <head>...</head>, <body>, </body>
    return html
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '');
  }

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
          srcDoc={`<html><head><style>
            html,body{min-height:100vh;height:auto;width:100vw;box-sizing:border-box;}
            body{margin:0;padding:32px 0 32px 0;font-family:'Segoe UI',sans-serif;background:#f8fafc;box-sizing:border-box;overflow-y:auto;max-width:100vw;}
            *{box-sizing:border-box;}
            .container{min-height:100vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 2px 16px #0001;padding:32px 24px;max-width:900px;margin:0 auto;}
            h1,h2,h3{color:#1e293b;margin-top:0;margin-bottom:0.5em;}
            h1{font-size:2.2rem;font-weight:700;}
            h2{font-size:1.5rem;font-weight:600;}
            h3{font-size:1.2rem;font-weight:500;}
            p,li,td,th,span,div{font-size:1.08rem;line-height:1.7;color:#222;}
            .foto-container{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;}
            .foto-container img{max-width:220px;max-height:160px;object-fit:cover;border-radius:10px;box-shadow:0 1px 8px #0002;margin:0 auto;}
            img{max-width:100%;height:auto;display:block;}
            table{max-width:100%;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px #0001;}
            th{background:#f1f5f9;font-weight:600;}
            td,th{padding:10px 8px;}
            .page-break{page-break-before:always;}
          </style></head><body>${extrairConteudoRelatorio(relatorioHtml)}</body></html>`}
          title="Visualização do Relatório"
          className="w-full h-full border-0 pt-16"
          style={{ minHeight: '100vh', height: '100vh' }}
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