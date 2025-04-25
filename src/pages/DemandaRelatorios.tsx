import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Trash2, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function DemandaRelatorios() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [obraNome, setObraNome] = useState('');
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      carregarDados();
    }
  }, [id]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar nome da obra
      const { data: obra, error: obraError } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', id)
        .single();

      if (obraError) throw obraError;
      setObraNome(obra.nome);

      // Carregar relatórios
      const { data: relatoriosData, error: relatoriosError } = await supabase
        .from('relatorios')
        .select('*')
        .eq('obra_id', id)
        .eq('tipo', 'demanda')
        .order('created_at', { ascending: false });

      if (relatoriosError) throw relatoriosError;
      setRelatorios(relatoriosData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar relatórios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVisualizarRelatorio = (relatorio: any) => {
    try {
      // Criar uma nova janela para o PDF
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        throw new Error('Não foi possível abrir uma nova janela. Verifique se o bloqueador de pop-ups está desativado.');
      }
      
      // Escrever o conteúdo HTML na nova janela
      printWindow.document.write(relatorio.conteudo);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Erro ao visualizar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao visualizar o relatório",
        variant: "destructive"
      });
    }
  };

  const handleDownloadPDF = async (relatorio: any) => {
    try {
      // Criar um elemento temporário para o conteúdo
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = relatorio.conteudo;
      document.body.appendChild(tempDiv);

      // Configurar o PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Configurações do html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: tempDiv.scrollWidth,
        windowHeight: tempDiv.scrollHeight
      });

      // Converter canvas para imagem
      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      // Calcular dimensões mantendo proporção
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Adicionar páginas conforme necessário
      let heightLeft = imgHeight;
      let position = 0;
      let page = 1;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);

      while (heightLeft >= pageHeight) {
        position = -pageHeight * page;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        page++;
      }

      // Salvar o PDF
      pdf.save(`relatorio_demanda_${format(parseISO(relatorio.data_inicio), 'dd-MM-yyyy')}.pdf`);

      // Remover o elemento temporário
      document.body.removeChild(tempDiv);

      toast({
        title: "Sucesso",
        description: "PDF baixado com sucesso"
      });

    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar o PDF",
        variant: "destructive"
      });
    }
  };

  const handleExcluirRelatorio = async (relatorioId: number) => {
    try {
      const { error } = await supabase
        .from('relatorios')
        .delete()
        .eq('id', relatorioId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Relatório excluído com sucesso"
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir o relatório",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-2 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(`/obras/${id}/demanda`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Relatórios de Demanda: {obraNome}</h1>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <Card className="p-6">
          <div className="space-y-4">
            {relatorios.length === 0 ? (
              <p className="text-muted-foreground">Nenhum relatório encontrado</p>
            ) : (
              relatorios.map((relatorio) => (
                <div
                  key={relatorio.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      Relatório de {format(parseISO(relatorio.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Gerado em: {format(parseISO(relatorio.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVisualizarRelatorio(relatorio)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(relatorio)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExcluirRelatorio(relatorio.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
} 