import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { buscarObra } from '@/lib/api';
import { toast } from 'sonner';
import { Device } from '@capacitor/device';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface HistoricoItem {
  demanda_item_id: number | null;
  categoria: string | null;
  empresa: string | null;
  valor: number | null;
}

interface HistoricoItemSemEmpresa {
  demanda_item_id: number | null;
  categoria: string | null;
  valor: number | null;
}

interface ItemEmpresaAtual {
  id: number;
  empresa: string | null;
}

interface TotalLinha {
  nome: string;
  total: number;
}

const MARCADOR_RELATORIO_MENSAL = 'DEMANDA_MENSAL_EXCEL';
const CATEGORIA_SEM_NOME = 'Sem categoria';
const EMPRESA_SEM_NOME = 'Sem empresa';

const normalizarCategoria = (categoria?: string | null) => {
  const nome = (categoria || '').trim();
  return nome || CATEGORIA_SEM_NOME;
};

const normalizarEmpresa = (empresa?: string | null) => {
  const nome = (empresa || '').trim();
  return nome || EMPRESA_SEM_NOME;
};

const erroColunaEmpresaAusente = (message: string) => {
  const mensagem = message.toLowerCase();
  return mensagem.includes('column') && mensagem.includes('empresa') && mensagem.includes('demanda_itens_historico_pago');
};

const erroTabelaHistoricoAusente = (message: string) => {
  const mensagem = message.toLowerCase();
  return (mensagem.includes('relation') || mensagem.includes('table')) && mensagem.includes('demanda_itens_historico_pago');
};

const agregarTotais = (linhas: Array<{ nome: string; valor: number }>) => {
  const mapa = new Map<string, number>();

  linhas.forEach((linha) => {
    const atual = mapa.get(linha.nome) || 0;
    mapa.set(linha.nome, atual + linha.valor);
  });

  return Array.from(mapa.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export default function DemandaTotais() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [obraNome, setObraNome] = useState('');
  const [totaisCategoria, setTotaisCategoria] = useState<TotalLinha[]>([]);
  const [totaisEmpresa, setTotaisEmpresa] = useState<TotalLinha[]>([]);
  const [dataUltimoFechamentoExcel, setDataUltimoFechamentoExcel] = useState<string | null>(null);

  const totalGeralCategoria = useMemo(
    () => totaisCategoria.reduce((acc, item) => acc + item.total, 0),
    [totaisCategoria]
  );

  const carregarTotais = async () => {
    if (!id || Number.isNaN(Number(id))) {
      toast.error('ID da obra invalido');
      navigate('/obras');
      return;
    }

    try {
      setLoading(true);

      const obra = await buscarObra(Number(id));
      if (!obra) {
        throw new Error('Obra nao encontrada');
      }
      setObraNome(obra.nome || `Obra ${id}`);

      const { data: fechamentoData, error: fechamentoError } = await supabase
        .from('relatorios')
        .select('created_at')
        .eq('obra_id', Number(id))
        .eq('tipo', 'demanda')
        .ilike('conteudo', `%${MARCADOR_RELATORIO_MENSAL}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fechamentoError) {
        throw new Error(`Erro ao carregar fechamento Excel: ${fechamentoError.message}`);
      }

      const ultimoFechamentoExcel = fechamentoData && fechamentoData.length > 0
        ? String(fechamentoData[0].created_at)
        : null;

      setDataUltimoFechamentoExcel(ultimoFechamentoExcel);

      if (!ultimoFechamentoExcel) {
        // Sem fechamento mensal em Excel ainda, o acumulado fechado deve ficar zerado.
        setTotaisCategoria([]);
        setTotaisEmpresa([]);
        return;
      }

      let historico: HistoricoItem[] = [];

      const { data: historicoData, error: historicoError } = await supabase
        .from('demanda_itens_historico_pago')
        .select('demanda_item_id, categoria, empresa, valor')
        .eq('obra_id', Number(id))
        .lte('entrou_em_pago_em', ultimoFechamentoExcel);

      if (historicoError) {
        if (erroColunaEmpresaAusente(historicoError.message)) {
          const { data: historicoSemEmpresaData, error: historicoSemEmpresaError } = await supabase
            .from('demanda_itens_historico_pago')
            .select('demanda_item_id, categoria, valor')
            .eq('obra_id', Number(id))
            .lte('entrou_em_pago_em', ultimoFechamentoExcel);

          if (historicoSemEmpresaError) {
            throw new Error(`Erro ao carregar historico: ${historicoSemEmpresaError.message}`);
          }

          historico = ((historicoSemEmpresaData || []) as HistoricoItemSemEmpresa[]).map((item) => ({
            ...item,
            empresa: null,
          }));
        } else if (erroTabelaHistoricoAusente(historicoError.message)) {
          // Permite acompanhamento sem histórico legado; nesse caso considera apenas o status pago atual.
          historico = [];
        } else {
          throw new Error(`Erro ao carregar historico: ${historicoError.message}`);
        }
      } else {
        historico = (historicoData || []) as HistoricoItem[];
      }

      const { data: itensEmpresaData, error: itensEmpresaError } = await supabase
        .from('demanda_itens')
        .select('id, empresa')
        .eq('obra_id', Number(id));

      if (itensEmpresaError) {
        throw new Error(`Erro ao carregar empresas dos itens: ${itensEmpresaError.message}`);
      }

      const mapaEmpresaPorItemId = new Map<number, string | null>();
      (itensEmpresaData as ItemEmpresaAtual[] | null || []).forEach((item) => {
        mapaEmpresaPorItemId.set(item.id, item.empresa || null);
      });

      const entradasCombinadas = historico
        .map((item) => ({
          demandaItemId: item.demanda_item_id,
          categoria: normalizarCategoria(item.categoria),
          empresa: normalizarEmpresa(
            item.empresa
            ?? (item.demanda_item_id ? mapaEmpresaPorItemId.get(item.demanda_item_id) || null : null)
          ),
          valor: Number(item.valor ?? 0),
        }))
        .filter((item) => item.valor > 0);

      const totalPorCategoria = agregarTotais(
        entradasCombinadas.map((item) => ({ nome: item.categoria, valor: item.valor }))
      );

      const totalPorEmpresa = agregarTotais(
        entradasCombinadas.map((item) => ({ nome: item.empresa, valor: item.valor }))
      );

      setTotaisCategoria(totalPorCategoria);
      setTotaisEmpresa(totalPorEmpresa);
    } catch (error) {
      console.error('Erro ao carregar totais de demanda:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar totais de demanda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarTotais();
  }, [id]);

  const baixarExcelTotais = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const agora = new Date();

      const abaCategorias = workbook.addWorksheet('Total por Categoria');
      abaCategorias.columns = [
        { key: 'nome', width: 36 },
        { key: 'total', width: 20 },
      ];
      abaCategorias.addRow(['Categoria', 'Total (R$)']);
      totaisCategoria.forEach((linha) => {
        abaCategorias.addRow([linha.nome, linha.total]);
      });
      abaCategorias.addRow(['TOTAL GERAL', totalGeralCategoria]);

      for (let i = 2; i <= abaCategorias.rowCount; i += 1) {
        abaCategorias.getCell(`B${i}`).numFmt = 'R$ #,##0.00';
      }

      const abaEmpresas = workbook.addWorksheet('Total por Empresa');
      abaEmpresas.columns = [
        { key: 'nome', width: 36 },
        { key: 'total', width: 20 },
      ];
      abaEmpresas.addRow(['Empresa', 'Total (R$)']);
      totaisEmpresa.forEach((linha) => {
        abaEmpresas.addRow([linha.nome, linha.total]);
      });
      abaEmpresas.addRow(['TOTAL GERAL', totalGeralCategoria]);

      for (let i = 2; i <= abaEmpresas.rowCount; i += 1) {
        abaEmpresas.getCell(`B${i}`).numFmt = 'R$ #,##0.00';
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `demanda_total_obra_${(obraNome || `obra_${id}`).replace(/\s+/g, '_').toLowerCase()}_${format(agora, 'dd-MM-yyyy')}.xlsx`;

      const deviceInfo = await Device.getInfo();
      const isMobile = deviceInfo.platform !== 'web';

      if (isMobile) {
        const base64 = arrayBufferToBase64(buffer as ArrayBuffer);
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `Total de demanda - ${obraNome}`,
          text: `Totais acumulados de demanda da obra ${obraNome}.`,
          url: result.uri,
          dialogTitle: 'Compartilhar totais de demanda',
        });
      } else {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }

      toast.success('Relatorio de totais gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao baixar totais em Excel:', error);
      toast.error('Erro ao gerar arquivo Excel de totais.');
    }
  };

  return (
    <div className="container mx-auto py-6 px-3 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/obras/${id}/demanda`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">Totais da Demanda: {obraNome}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={carregarTotais}>
            Atualizar
          </Button>
          <Button variant="outline" onClick={baixarExcelTotais}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Carregando totais...</div>
      ) : (
        <>
          <Card className="p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              {dataUltimoFechamentoExcel
                ? `Considerando apenas valores ja enviados para o Excel ate ${format(new Date(dataUltimoFechamentoExcel), 'dd/MM/yyyy HH:mm')}.`
                : 'Nenhum fechamento de Excel encontrado ainda. Os totais serao exibidos apos o primeiro fechamento.'}
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 overflow-x-auto">
              <h2 className="text-lg font-semibold mb-3">Total por Categoria</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Categoria</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totaisCategoria.map((linha) => (
                    <tr key={linha.nome} className="border-b last:border-b-0">
                      <td className="py-2">{linha.nome}</td>
                      <td className="py-2 text-right">R$ {linha.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">TOTAL GERAL</td>
                    <td className="py-2 text-right">R$ {totalGeralCategoria.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card className="p-4 overflow-x-auto">
              <h2 className="text-lg font-semibold mb-3">Total por Empresa</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Empresa</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totaisEmpresa.map((linha) => (
                    <tr key={linha.nome} className="border-b last:border-b-0">
                      <td className="py-2">{linha.nome}</td>
                      <td className="py-2 text-right">R$ {linha.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">TOTAL GERAL</td>
                    <td className="py-2 text-right">R$ {totalGeralCategoria.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}