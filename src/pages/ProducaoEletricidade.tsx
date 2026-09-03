import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, ArrowLeft, ClipboardList, Check, X, Pencil, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface EletricaTarefa {
  id: string;
  nome: string;
  valor: number;
  metragemPrevista: number;
  ordem: number;
}

interface EletricaRegistro {
  id: string;
  data: string;
  eletricistaId: string;
  tarefaId: string | null;
  ehDiaria: boolean;
  fatorDiaria: number;
  valor: number | null;
  dataInicio: string;
  dataFim?: string;
  metragem: number | null;
  observacao?: string;
}

interface Eletricista {
  id: string;
  nome: string;
  ativo: boolean;
  valorDiaria: number;
}

const formatQuantidade = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
};

const normalizarDataISO = (valor?: string | null) => {
  return valor ? valor.slice(0, 10) : '';
};

const pertenceAoMes = (dataIso: string, mesReferencia: Date) => {
  return normalizarDataISO(dataIso).slice(0, 7) === format(mesReferencia, 'yyyy-MM');
};

const ProducaoEletricidade = () => {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [obraNome, setObraNome] = useState('Obra');
  const [loading, setLoading] = useState(true);

  const [eletricistas, setEletricistas] = useState<Eletricista[]>([]);
  const [tarefas, setTarefas] = useState<EletricaTarefa[]>([]);
  const [registros, setRegistros] = useState<EletricaRegistro[]>([]);

  const [showGerenciarEletricistas, setShowGerenciarEletricistas] = useState(false);
  const [showGerenciarTarefas, setShowGerenciarTarefas] = useState(false);
  const [showLancarDialog, setShowLancarDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mesReferencia, setMesReferencia] = useState<Date>(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [tabelaEletricistaId, setTabelaEletricistaId] = useState<string>('all');

  const [novaTarefa, setNovaTarefa] = useState('');
  const [novoValorTarefa, setNovoValorTarefa] = useState('');
  const [novaMetragemPrevista, setNovaMetragemPrevista] = useState('');
  const [editandoTarefa, setEditandoTarefa] = useState<{
    id: string;
    nome: string;
    valor: string;
    metragemPrevista: string;
  } | null>(null);

  const [formTarefaId, setFormTarefaId] = useState('');
  const [formEletricistaId, setFormEletricistaId] = useState('');
  const [formEhDiaria, setFormEhDiaria] = useState(false);
  const [formFatorDiaria, setFormFatorDiaria] = useState<1 | 0.5>(1);
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  const [formMetragem, setFormMetragem] = useState('');
  const [formObservacao, setFormObservacao] = useState('');

  const [novoEletricista, setNovoEletricista] = useState('');
  const [editandoEletricista, setEditandoEletricista] = useState<{ id: string; nome: string; valorDiaria: string } | null>(null);
  const [salvandoValorDiariaResumo, setSalvandoValorDiariaResumo] = useState(false);
  const [editandoRegistro, setEditandoRegistro] = useState<{
    id: string;
    eletricistaId: string;
    tarefaId: string;
    ehDiaria: boolean;
    fatorDiaria: 1 | 0.5;
    valor: string;
    dataInicio: string;
    dataFim: string;
    metragem: string;
    observacao: string;
  } | null>(null);

  const carregarDados = async () => {
    if (!obraId) {
      return;
    }

    setLoading(true);
    try {
      const [obraResp, eletricistasResp, tarefasResp, registrosResp] = await Promise.all([
        supabase.from('obras').select('nome').eq('id', Number(obraId)).single(),
        supabase
          .from('producao_eletrica_eletricistas')
          .select('id, nome, ativo, valor_diaria')
          .eq('obra_id', Number(obraId))
          .order('nome', { ascending: true }),
        supabase
          .from('producao_eletrica_tarefas')
          .select('id, nome, valor, metragem_prevista, ordem')
          .eq('obra_id', Number(obraId))
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('producao_eletrica_registros')
          .select('id, data, eletricista_id, tarefa_id, eh_diaria, fator_diaria, valor, data_inicio, data_fim, metragem, observacao')
          .eq('obra_id', Number(obraId))
          .order('data', { ascending: false }),
      ]);

      if (obraResp.error) throw obraResp.error;
      if (eletricistasResp.error) throw eletricistasResp.error;
      if (tarefasResp.error) throw tarefasResp.error;
      if (registrosResp.error) throw registrosResp.error;

      setObraNome(obraResp.data?.nome || 'Obra');

      setEletricistas(
        (eletricistasResp.data || []).map((e) => ({
          id: e.id,
          nome: e.nome,
          ativo: Boolean(e.ativo),
          valorDiaria: Number(e.valor_diaria || 0),
        }))
      );

      setTarefas(
        (tarefasResp.data || []).map((t) => ({
          id: t.id,
          nome: t.nome,
          valor: Number(t.valor || 0),
          metragemPrevista: Number(t.metragem_prevista || 0),
          ordem: Number(t.ordem || 0),
        }))
      );

      setRegistros(
        (registrosResp.data || []).map((r) => ({
          id: r.id,
          data: normalizarDataISO(r.data),
          eletricistaId: r.eletricista_id,
          tarefaId: r.tarefa_id || null,
          ehDiaria: Boolean(r.eh_diaria),
          fatorDiaria: Number(r.fator_diaria || 1) === 0.5 ? 0.5 : 1,
          valor: r.valor === null || r.valor === undefined ? null : Number(r.valor),
          dataInicio: normalizarDataISO(r.data_inicio),
          dataFim: normalizarDataISO(r.data_fim) || undefined,
          metragem: r.metragem === null || r.metragem === undefined ? null : Number(r.metragem),
          observacao: r.observacao || '',
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar produção elétrica:', error);
      toast({
        title: 'Erro ao carregar produção elétrica',
        description: 'Verifique se as tabelas da elétrica já foram criadas no banco.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [obraId]);

  const tarefasPorId = useMemo(() => {
    return tarefas.reduce<Record<string, EletricaTarefa>>((acc, tarefa) => {
      acc[tarefa.id] = tarefa;
      return acc;
    }, {});
  }, [tarefas]);

  const eletricistasPorId = useMemo(() => {
    return eletricistas.reduce<Record<string, Eletricista>>((acc, eletricista) => {
      acc[eletricista.id] = eletricista;
      return acc;
    }, {});
  }, [eletricistas]);

  const eletricistasAtivos = useMemo(() => {
    return eletricistas.filter((e) => e.ativo);
  }, [eletricistas]);

  const eletricistasTabelaDisponiveis = useMemo(() => {
    const idsComDadosNoMes = new Set(
      registros
        .filter((r) => pertenceAoMes(r.data, mesReferencia))
        .map((r) => r.eletricistaId)
    );

    return eletricistas
      .filter((e) => e.ativo || idsComDadosNoMes.has(e.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [eletricistas, registros, mesReferencia]);

  useEffect(() => {
    if (tabelaEletricistaId === 'all') {
      return;
    }

    const existe = eletricistasTabelaDisponiveis.some((e) => e.id === tabelaEletricistaId);
    if (!existe) {
      setTabelaEletricistaId('all');
    }
  }, [eletricistasTabelaDisponiveis, tabelaEletricistaId]);

  const todosNaTabelaIds = ['all', ...eletricistasTabelaDisponiveis.map((e) => e.id)];
  const idxEletricistaAtual = todosNaTabelaIds.indexOf(tabelaEletricistaId);

  const irEletricistaAnterior = () => {
    const prevIdx = (idxEletricistaAtual - 1 + todosNaTabelaIds.length) % todosNaTabelaIds.length;
    setTabelaEletricistaId(todosNaTabelaIds[prevIdx]);
  };

  const irProximoEletricista = () => {
    const nextIdx = (idxEletricistaAtual + 1) % todosNaTabelaIds.length;
    setTabelaEletricistaId(todosNaTabelaIds[nextIdx]);
  };

  const irMesAnterior = () => {
    setMesReferencia((prev) => subMonths(prev, 1));
  };

  const irProximoMes = () => {
    setMesReferencia((prev) => addMonths(prev, 1));
  };

  const eletricistaTabelaAtual = eletricistasTabelaDisponiveis.find((e) => e.id === tabelaEletricistaId);
  const tabelaTitulo = tabelaEletricistaId === 'all'
    ? 'Toda a Equipe'
    : (eletricistaTabelaAtual?.nome || 'Eletricista');

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') {
      return '';
    }

    const dataStr = format(date, 'yyyy-MM-dd');
    const temRegistro = registros.some((r) => r.data === dataStr);
    return temRegistro ? 'producao-dia' : '';
  };

  const resumoMensal = useMemo(() => {
    const inicioMesIso = format(startOfMonth(mesReferencia), 'yyyy-MM-dd');
    const fimMesIso = format(endOfMonth(mesReferencia), 'yyyy-MM-dd');
    const registrosBase = tabelaEletricistaId === 'all'
      ? registros
      : registros.filter((r) => r.eletricistaId === tabelaEletricistaId);

    const registrosProducao = registrosBase.filter((r) => !r.ehDiaria && r.tarefaId);

    return tarefas.map((tarefa) => {
      const registrosTarefa = registrosProducao
        .filter((r) => r.tarefaId === tarefa.id)
        .sort((a, b) => a.data.localeCompare(b.data));

      const registrosNoMes = registrosTarefa.filter((r) => {
        return pertenceAoMes(r.data, mesReferencia);
      });

      const metragemMes = registrosNoMes.reduce((acc, r) => acc + (r.metragem || 0), 0);
      const metragemAcumuladaAteMes = registrosTarefa
        .filter((r) => normalizarDataISO(r.data) <= fimMesIso)
        .reduce((acc, r) => acc + (r.metragem || 0), 0);

      const dataFinalManual = registrosTarefa
        .map((r) => r.dataFim)
        .filter(Boolean)
        .sort((a, b) => (a as string).localeCompare(b as string))[0] || null;

      const percentualFeito = tarefa.metragemPrevista > 0
        ? Math.min(100, (metragemAcumuladaAteMes / tarefa.metragemPrevista) * 100)
        : 0;

      const dataInicio = registrosTarefa.length > 0
        ? registrosTarefa
            .map((r) => r.dataInicio)
            .sort((a, b) => a.localeCompare(b))[0]
        : null;

      let dataFinal: string | null = null;
      if (dataFinalManual) {
        dataFinal = dataFinalManual;
      } else if (tarefa.metragemPrevista > 0) {
        let acumulado = 0;
        for (const registro of registrosTarefa) {
          acumulado += (registro.metragem || 0);
          if (acumulado >= tarefa.metragemPrevista) {
            dataFinal = registro.data;
            break;
          }
        }
      }

      const aPagar = tarefa.valor * (percentualFeito / 100);

      const dataInicioIso = dataInicio ? normalizarDataISO(dataInicio) : '';
      const dataFinalIso = dataFinal ? normalizarDataISO(dataFinal) : '';
      const exibirNoMes = (() => {
        if (!dataInicioIso) {
          return true;
        }

        if (dataInicioIso > fimMesIso) {
          return false;
        }

        if (!dataFinalIso) {
          return true;
        }

        return dataFinalIso >= inicioMesIso;
      })();

      return {
        tarefa,
        metragemMes,
        percentualFeito,
        dataInicio,
        dataFinal,
        aPagar,
        exibirNoMes,
      };
    }).filter((item) => item.exibirNoMes);
  }, [tarefas, registros, mesReferencia, tabelaEletricistaId]);

  const totalPagarMes = useMemo(() => {
    return resumoMensal.reduce((acc, item) => acc + item.aPagar, 0);
  }, [resumoMensal]);

  const diariasMensais = useMemo(() => {
    return registros
      .filter((r) => {
        if (!r.ehDiaria) {
          return false;
        }

        if (tabelaEletricistaId !== 'all' && r.eletricistaId !== tabelaEletricistaId) {
          return false;
        }

        return pertenceAoMes(r.data, mesReferencia);
      })
      .sort((a, b) => {
        if (a.data === b.data) {
          const nomeA = eletricistasPorId[a.eletricistaId]?.nome || '';
          const nomeB = eletricistasPorId[b.eletricistaId]?.nome || '';
          return nomeA.localeCompare(nomeB, 'pt-BR');
        }
        return a.data.localeCompare(b.data);
      });
  }, [registros, mesReferencia, tabelaEletricistaId, eletricistasPorId]);

  const totalDiariasQuantidadeMes = diariasMensais.reduce((acc, registro) => acc + (registro.fatorDiaria || 1), 0);

  const [valorDiariaResumoEditavel, setValorDiariaResumoEditavel] = useState('0');

  useEffect(() => {
    if (diariasMensais.length === 0) {
      setValorDiariaResumoEditavel('0');
      return;
    }

    if (tabelaEletricistaId !== 'all') {
      setValorDiariaResumoEditavel(String(eletricistasPorId[tabelaEletricistaId]?.valorDiaria || 0));
      return;
    }

    const totalBasePonderada = diariasMensais.reduce((acc, registro) => {
      return acc + ((registro.valor ?? eletricistasPorId[registro.eletricistaId]?.valorDiaria ?? 0) * (registro.fatorDiaria || 1));
    }, 0);
    const valorBaseMedio = totalDiariasQuantidadeMes > 0
      ? (totalBasePonderada / totalDiariasQuantidadeMes)
      : 0;
    setValorDiariaResumoEditavel(String(valorBaseMedio || 0));
  }, [diariasMensais, eletricistasPorId, tabelaEletricistaId]);

  const valorDiariaResumoNumerico = Number(valorDiariaResumoEditavel.replace(',', '.'));

  const totalDiariasMes = useMemo(() => {
    const valorBase = Number.isFinite(valorDiariaResumoNumerico) ? valorDiariaResumoNumerico : 0;
    return totalDiariasQuantidadeMes * valorBase;
  }, [totalDiariasQuantidadeMes, valorDiariaResumoNumerico]);

  const totalGeralMes = useMemo(() => {
    const totalDiariasBase = Number.isFinite(valorDiariaResumoNumerico) ? valorDiariaResumoNumerico : 0;
    return totalPagarMes + (totalDiariasQuantidadeMes * totalDiariasBase);
  }, [totalPagarMes, totalDiariasQuantidadeMes, valorDiariaResumoNumerico]);

  const handleSalvarValorDiariaResumo = async () => {
    if (!obraId || salvandoValorDiariaResumo) {
      return;
    }

    const valor = Number(valorDiariaResumoEditavel.replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor de diária maior ou igual a zero.',
        variant: 'destructive',
      });
      return;
    }

    setSalvandoValorDiariaResumo(true);
    try {
      const inicioMes = startOfMonth(mesReferencia);
      const fimMes = endOfMonth(mesReferencia);

      const registrosDiariasDoMes = registros.filter((registro) => {
        if (!registro.ehDiaria) {
          return false;
        }

        if (tabelaEletricistaId !== 'all' && registro.eletricistaId !== tabelaEletricistaId) {
          return false;
        }

        const dataRegistro = parseISO(registro.data);
        return dataRegistro >= inicioMes && dataRegistro <= fimMes;
      });

      if (registrosDiariasDoMes.length === 0) {
        if (tabelaEletricistaId !== 'all') {
          const { error } = await supabase
            .from('producao_eletrica_eletricistas')
            .update({ valor_diaria: valor })
            .eq('id', tabelaEletricistaId)
            .eq('obra_id', Number(obraId));

          if (error) throw error;

          setEletricistas((prev) => prev.map((eletricista) => (
            eletricista.id === tabelaEletricistaId
              ? { ...eletricista, valorDiaria: valor }
              : eletricista
          )));
        }

        toast({
          title: 'Valor salvo',
          description: 'O valor foi atualizado para o resumo atual.',
        });
        return;
      }

      const ids = registrosDiariasDoMes.map((registro) => registro.id);
      const { error } = await supabase
        .from('producao_eletrica_registros')
        .update({ valor })
        .in('id', ids)
        .eq('obra_id', Number(obraId));

      if (error) {
        throw error;
      }

      setRegistros((prev) => prev.map((registro) => (
        ids.includes(registro.id)
          ? { ...registro, valor }
          : registro
      )));

      if (tabelaEletricistaId !== 'all') {
        const { error: encError } = await supabase
          .from('producao_eletrica_eletricistas')
          .update({ valor_diaria: valor })
          .eq('id', tabelaEletricistaId)
          .eq('obra_id', Number(obraId));

        if (encError) {
          throw encError;
        }

        setEletricistas((prev) => prev.map((eletricista) => (
          eletricista.id === tabelaEletricistaId
            ? { ...eletricista, valorDiaria: valor }
            : eletricista
        )));
      }

      toast({
        title: 'Valor salvo',
        description: 'O valor das diárias foi gravado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao salvar valor de diária:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível gravar o valor das diárias.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoValorDiariaResumo(false);
    }
  };

  const registrosDataSelecionada = useMemo(() => {
    if (!selectedDate) {
      return [] as EletricaRegistro[];
    }

    const dataStr = format(selectedDate, 'yyyy-MM-dd');
    return registros
      .filter((r) => r.data === dataStr)
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  }, [selectedDate, registros]);

  const dataInicioJaRegistrada = useMemo(() => {
    if (!formEletricistaId || !formTarefaId) {
      return null;
    }

    const primeiraData = registros
      .filter((r) => !r.ehDiaria && r.eletricistaId === formEletricistaId && r.tarefaId === formTarefaId)
      .map((r) => r.dataInicio)
      .sort((a, b) => a.localeCompare(b))[0];

    return primeiraData || null;
  }, [registros, formEletricistaId, formTarefaId]);

  const calcularMetragemRestante = (
    eletricistaId: string,
    tarefaId: string,
    registroIgnoradoId?: string
  ) => {
    const tarefa = tarefasPorId[tarefaId];
    if (!tarefa || tarefa.metragemPrevista <= 0) {
      return null;
    }

    const metragemAcumulada = registros
      .filter((r) => !r.ehDiaria && r.eletricistaId === eletricistaId && r.tarefaId === tarefaId && r.id !== registroIgnoradoId)
      .reduce((acc, r) => acc + (r.metragem || 0), 0);

    const restante = Math.max(0, tarefa.metragemPrevista - metragemAcumulada);

    return {
      restante,
      metragemPrevista: tarefa.metragemPrevista,
      metragemAcumulada,
    };
  };

  useEffect(() => {
    if (formEhDiaria && selectedDate) {
      setFormDataInicio(format(selectedDate, 'yyyy-MM-dd'));
      return;
    }

    if (dataInicioJaRegistrada) {
      setFormDataInicio(dataInicioJaRegistrada);
      return;
    }

    if (selectedDate) {
      setFormDataInicio(format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [dataInicioJaRegistrada, selectedDate, formEhDiaria]);

  const handleAbrirLancamento = (data: Date) => {
    setSelectedDate(data);
    setFormTarefaId('');
    setFormEletricistaId('');
    setFormEhDiaria(tarefas.length === 0);
    setFormFatorDiaria(1);
    setFormDataInicio(format(data, 'yyyy-MM-dd'));
    setFormDataFim('');
    setFormMetragem('');
    setFormObservacao('');
    setShowLancarDialog(true);
  };

  const handleAdicionarEletricista = async () => {
    if (!obraId) {
      return;
    }

    const nome = novoEletricista.trim();
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do eletricista.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('producao_eletrica_eletricistas')
      .insert({ obra_id: Number(obraId), nome, ativo: true, valor_diaria: 0 })
      .select('id, nome, ativo, valor_diaria')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao adicionar eletricista',
        description: error?.message || 'Não foi possível salvar o eletricista.',
        variant: 'destructive',
      });
      return;
    }

    setEletricistas((prev) => [...prev, {
      id: data.id,
      nome: data.nome,
      ativo: Boolean(data.ativo),
      valorDiaria: Number(data.valor_diaria || 0),
    }]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setNovoEletricista('');
  };

  const handleSalvarEdicaoEletricista = async () => {
    if (!obraId || !editandoEletricista) {
      return;
    }

    const nome = editandoEletricista.nome.trim();
    const valorDiaria = Number(editandoEletricista.valorDiaria.replace(',', '.'));
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do eletricista.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(valorDiaria) || valorDiaria < 0) {
      toast({
        title: 'Valor de diária inválido',
        description: 'Informe um valor de diária maior ou igual a zero.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_eletrica_eletricistas')
      .update({ nome, valor_diaria: valorDiaria })
      .eq('id', editandoEletricista.id)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao editar eletricista',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setEletricistas((prev) => prev
      .map((e) => (e.id === editandoEletricista.id ? { ...e, nome, valorDiaria } : e))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setEditandoEletricista(null);
  };

  const handleExcluirEletricista = async (eletricistaId: string) => {
    if (!obraId) {
      return;
    }

    const possuiHistorico = registros.some((r) => r.eletricistaId === eletricistaId);

    if (possuiHistorico) {
      const { error } = await supabase
        .from('producao_eletrica_eletricistas')
        .update({ ativo: false })
        .eq('id', eletricistaId)
        .eq('obra_id', Number(obraId));

      if (error) {
        toast({
          title: 'Erro ao inativar eletricista',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setEletricistas((prev) => prev.map((e) => (e.id === eletricistaId ? { ...e, ativo: false } : e)));
      toast({
        title: 'Eletricista inativado',
        description: 'O histórico foi mantido para os relatórios.',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_eletrica_eletricistas')
      .delete()
      .eq('id', eletricistaId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir eletricista',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setEletricistas((prev) => prev.filter((e) => e.id !== eletricistaId));
  };

  const handleAdicionarTarefa = async () => {
    if (!obraId) {
      return;
    }

    const nome = novaTarefa.trim();
    const valor = Number(novoValorTarefa.replace(',', '.'));
    const metragemPrevista = Number(novaMetragemPrevista.replace(',', '.'));

    if (!nome || !Number.isFinite(valor) || valor < 0 || !Number.isFinite(metragemPrevista) || metragemPrevista < 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Informe nome, valor e metragem prevista válidos.',
        variant: 'destructive',
      });
      return;
    }

    const proximaOrdem = tarefas.length === 0 ? 1 : Math.max(...tarefas.map((t) => t.ordem)) + 1;

    const { data, error } = await supabase
      .from('producao_eletrica_tarefas')
      .insert({
        obra_id: Number(obraId),
        nome,
        valor,
        metragem_prevista: metragemPrevista,
        ordem: proximaOrdem,
      })
      .select('id, nome, valor, metragem_prevista, ordem')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao adicionar tarefa',
        description: error?.message || 'Não foi possível salvar a tarefa.',
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) => [
      ...prev,
      {
        id: data.id,
        nome: data.nome,
        valor: Number(data.valor || 0),
        metragemPrevista: Number(data.metragem_prevista || 0),
        ordem: Number(data.ordem || 0),
      },
    ].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')));

    setNovaTarefa('');
    setNovoValorTarefa('');
    setNovaMetragemPrevista('');
  };

  const handleSalvarEdicaoTarefa = async () => {
    if (!editandoTarefa || !obraId) {
      return;
    }

    const nome = editandoTarefa.nome.trim();
    const valor = Number(editandoTarefa.valor.replace(',', '.'));
    const metragemPrevista = Number(editandoTarefa.metragemPrevista.replace(',', '.'));

    if (!nome || !Number.isFinite(valor) || valor < 0 || !Number.isFinite(metragemPrevista) || metragemPrevista < 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Revise nome, valor e metragem prevista.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_eletrica_tarefas')
      .update({ nome, valor, metragem_prevista: metragemPrevista })
      .eq('id', editandoTarefa.id)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao editar tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) => prev.map((t) =>
      t.id === editandoTarefa.id
        ? { ...t, nome, valor, metragemPrevista }
        : t
    ));
    setEditandoTarefa(null);
  };

  const handleExcluirTarefa = async (tarefaId: string) => {
    if (!obraId) {
      return;
    }

    const existeRegistro = registros.some((r) => r.tarefaId === tarefaId);
    if (existeRegistro) {
      toast({
        title: 'Não é possível excluir',
        description: 'A tarefa já possui lançamentos de elétrica.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_eletrica_tarefas')
      .delete()
      .eq('id', tarefaId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) => prev.filter((t) => t.id !== tarefaId));
  };

  const handleSalvarLancamento = async () => {
    if (!obraId || !selectedDate) {
      return;
    }

    const metragemTexto = formMetragem.trim();
    const metragemCalculada = metragemTexto === '' ? null : Number(metragemTexto.replace(',', '.'));
    const dataLancamento = format(selectedDate, 'yyyy-MM-dd');

    const dataInicioParaLancamento = formEhDiaria
      ? dataLancamento
      : (dataInicioJaRegistrada || formDataInicio);
    const tarefaSelecionada = !formEhDiaria ? tarefasPorId[formTarefaId] : null;
    const finalizandoTarefa = !formEhDiaria && Boolean(formDataFim);
    const valorDiaria = eletricistasPorId[formEletricistaId]?.valorDiaria || 0;

    let metragem = formEhDiaria ? null : metragemCalculada;

    if (finalizandoTarefa) {
      const restanteInfo = calcularMetragemRestante(formEletricistaId, formTarefaId);
      if (!restanteInfo) {
        toast({
          title: 'Metragem prevista obrigatória',
          description: 'Para finalizar automaticamente, a tarefa precisa ter metragem prevista maior que zero.',
          variant: 'destructive',
        });
        return;
      }
      metragem = restanteInfo.restante > 0 ? restanteInfo.restante : null;
    }

    if (!formEletricistaId || !dataInicioParaLancamento || (!formEhDiaria && !formTarefaId)) {
      toast({
        title: 'Campos obrigatórios',
        description: formEhDiaria
          ? 'Selecione o eletricista.'
          : 'Selecione eletricista, tarefa e data de início.',
        variant: 'destructive',
      });
      return;
    }

    if (metragem !== null && (!Number.isFinite(metragem) || metragem <= 0)) {
      toast({
        title: 'Metragem inválida',
        description: 'Quando informada, a metragem precisa ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!formEhDiaria && !tarefaSelecionada) {
      toast({
        title: 'Serviço inválido',
        description: 'Selecione uma tarefa válida para lançar a produção.',
        variant: 'destructive',
      });
      return;
    }

    if (!formEhDiaria && formDataFim && formDataFim < dataInicioParaLancamento) {
      toast({
        title: 'Data de finalização inválida',
        description: 'A data de finalização não pode ser anterior à data de início.',
        variant: 'destructive',
      });
      return;
    }

    const fatorDiaria = formEhDiaria ? formFatorDiaria : 1;

    const { data, error } = await supabase
      .from('producao_eletrica_registros')
      .insert({
        obra_id: Number(obraId),
        data: dataLancamento,
        eletricista_id: formEletricistaId,
        tarefa_id: formEhDiaria ? null : formTarefaId,
        eh_diaria: formEhDiaria,
        fator_diaria: formEhDiaria ? fatorDiaria : 1,
        valor: formEhDiaria ? valorDiaria : null,
        data_inicio: dataInicioParaLancamento,
        data_fim: formEhDiaria ? null : (formDataFim || null),
        metragem,
        observacao: formObservacao.trim() || null,
      })
      .select('id, data, eletricista_id, tarefa_id, eh_diaria, fator_diaria, valor, data_inicio, data_fim, metragem, observacao')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao salvar lançamento',
        description: error?.message || 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) => [
      {
        id: data.id,
        data: normalizarDataISO(data.data),
        eletricistaId: data.eletricista_id,
        tarefaId: data.tarefa_id || null,
        ehDiaria: Boolean(data.eh_diaria),
        fatorDiaria: Number(data.fator_diaria || 1) === 0.5 ? 0.5 : 1,
        valor: data.valor === null || data.valor === undefined ? null : Number(data.valor),
        dataInicio: normalizarDataISO(data.data_inicio),
        dataFim: normalizarDataISO(data.data_fim) || undefined,
        metragem: data.metragem === null || data.metragem === undefined ? null : Number(data.metragem),
        observacao: data.observacao || '',
      },
      ...prev,
    ]);

    setFormDataFim('');
    setFormMetragem('');
    setFormObservacao('');
    setFormFatorDiaria(1);

    toast({
      title: 'Lançamento salvo',
      description: 'Lançamento registrado com sucesso.',
    });
  };

  const handleIniciarEdicaoRegistro = (registro: EletricaRegistro) => {
    setEditandoRegistro({
      id: registro.id,
      eletricistaId: registro.eletricistaId,
      tarefaId: registro.tarefaId || '',
      ehDiaria: registro.ehDiaria,
      fatorDiaria: registro.fatorDiaria === 0.5 ? 0.5 : 1,
      valor: registro.valor === null || registro.valor === undefined ? '' : String(registro.valor),
      dataInicio: registro.dataInicio,
      dataFim: registro.dataFim || '',
      metragem: registro.metragem === null ? '' : String(registro.metragem),
      observacao: registro.observacao || '',
    });
  };

  const handleSalvarEdicaoRegistro = async () => {
        const registroOriginal = registros.find((r) => r.id === editandoRegistro.id);
        if (!registroOriginal) {
          return;
        }

        const podeEditarDataInicio = registroOriginal.data === registroOriginal.dataInicio;
        if (!podeEditarDataInicio && editandoRegistro.dataInicio !== registroOriginal.dataInicio) {
          toast({
            title: 'Início bloqueado',
            description: 'Para alterar o início, edite o lançamento no dia em que a tarefa foi iniciada.',
            variant: 'destructive',
          });
          return;
        }

    if (!obraId || !editandoRegistro) {
      return;
    }

    const dataInicioParaSalvar = editandoRegistro.ehDiaria ? registroOriginal.data : editandoRegistro.dataInicio;
    const metragemTexto = editandoRegistro.metragem.trim();
    const metragemCalculada = metragemTexto === '' ? null : Number(metragemTexto.replace(',', '.'));
    const valorDiaria = eletricistasPorId[editandoRegistro.eletricistaId]?.valorDiaria || 0;
    const finalizandoTarefa = !editandoRegistro.ehDiaria && Boolean(editandoRegistro.dataFim);
    let metragem = editandoRegistro.ehDiaria ? null : metragemCalculada;

    if (finalizandoTarefa) {
      const restanteInfo = calcularMetragemRestante(editandoRegistro.eletricistaId, editandoRegistro.tarefaId, editandoRegistro.id);
      if (!restanteInfo) {
        toast({
          title: 'Metragem prevista obrigatória',
          description: 'Para finalizar automaticamente, a tarefa precisa ter metragem prevista maior que zero.',
          variant: 'destructive',
        });
        return;
      }
      metragem = restanteInfo.restante > 0 ? restanteInfo.restante : null;
    }

    const dataFim = editandoRegistro.ehDiaria ? '' : editandoRegistro.dataFim;

    if (!editandoRegistro.eletricistaId || !dataInicioParaSalvar || (!editandoRegistro.ehDiaria && !editandoRegistro.tarefaId)) {
      toast({
        title: 'Campos obrigatórios',
        description: editandoRegistro.ehDiaria
          ? 'Selecione o eletricista.'
          : 'Selecione eletricista, serviço e data de início.',
        variant: 'destructive',
      });
      return;
    }

    if (metragem !== null && (!Number.isFinite(metragem) || metragem <= 0)) {
      toast({
        title: 'Metragem inválida',
        description: 'Quando informada, a metragem precisa ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!editandoRegistro.ehDiaria && dataFim && dataFim < dataInicioParaSalvar) {
      toast({
        title: 'Data de finalização inválida',
        description: 'A data de finalização não pode ser anterior à data de início.',
        variant: 'destructive',
      });
      return;
    }

    const fatorDiaria = editandoRegistro.ehDiaria ? editandoRegistro.fatorDiaria : 1;

    const { data, error } = await supabase
      .from('producao_eletrica_registros')
      .update({
        eletricista_id: editandoRegistro.eletricistaId,
        tarefa_id: editandoRegistro.ehDiaria ? null : editandoRegistro.tarefaId,
        eh_diaria: editandoRegistro.ehDiaria,
        fator_diaria: editandoRegistro.ehDiaria ? fatorDiaria : 1,
        valor: editandoRegistro.ehDiaria ? valorDiaria : null,
        data_inicio: dataInicioParaSalvar,
        data_fim: editandoRegistro.ehDiaria ? null : (dataFim || null),
        metragem,
        observacao: editandoRegistro.observacao.trim() || null,
      })
      .eq('id', editandoRegistro.id)
      .eq('obra_id', Number(obraId))
      .select('id, data, eletricista_id, tarefa_id, eh_diaria, fator_diaria, valor, data_inicio, data_fim, metragem, observacao')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao editar lançamento',
        description: error?.message || 'Não foi possível atualizar o lançamento.',
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) => prev.map((registro) =>
      registro.id === data.id
        ? {
            ...registro,
            eletricistaId: data.eletricista_id,
            tarefaId: data.tarefa_id || null,
            ehDiaria: Boolean(data.eh_diaria),
            fatorDiaria: Number(data.fator_diaria || 1) === 0.5 ? 0.5 : 1,
            valor: data.valor === null || data.valor === undefined ? null : Number(data.valor),
            dataInicio: normalizarDataISO(data.data_inicio),
            dataFim: normalizarDataISO(data.data_fim) || undefined,
            metragem: data.metragem === null || data.metragem === undefined ? null : Number(data.metragem),
            observacao: data.observacao || '',
          }
        : registro
    ));

    setEditandoRegistro(null);
    toast({
      title: 'Lançamento atualizado',
      description: 'As alterações foram salvas com sucesso.',
    });
  };

  const handleExcluirRegistro = async (registroId: string) => {
    if (!obraId) {
      return;
    }

    const { error } = await supabase
      .from('producao_eletrica_registros')
      .delete()
      .eq('id', registroId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir lançamento',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) => prev.filter((r) => r.id !== registroId));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 flex items-center justify-center min-h-[220px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="ml-3 text-sm text-muted-foreground">Carregando produção elétrica...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-start gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Produção Elétrica</h1>
            <p className="text-sm text-muted-foreground">{obraNome}</p>
          </div>
          <Button className="h-9 w-full sm:w-auto" variant="outline" onClick={() => navigate(`/obras/${obraId}/producao`)}>
            Pedreiros
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para obra
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarEletricistas(true)}>
            <Users className="h-4 w-4 mr-2" />
            Gerenciar eletricistas
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarTarefas(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Gerenciar tarefas
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground mb-3">
          Clique em um dia do calendário para lançar produção da tarefa ou marcar diária.
        </p>
        <div className="w-full flex justify-center">
          <Calendar
            locale="pt-BR"
            className="producao-calendar"
            onClickDay={handleAbrirLancamento}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (!activeStartDate) {
                return;
              }

              setMesReferencia(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1));
            }}
            tileClassName={tileClassName}
          />
        </div>
      </Card>

      <Dialog open={showGerenciarEletricistas} onOpenChange={setShowGerenciarEletricistas}>
        <DialogContent className="w-[95vw] max-w-lg h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar eletricistas</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <Input
                placeholder="Nome do eletricista"
                value={novoEletricista}
                onChange={(e) => setNovoEletricista(e.target.value)}
              />
              <Button className="w-full sm:w-auto" type="button" onClick={handleAdicionarEletricista}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {eletricistasAtivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum eletricista cadastrado.</p>
              ) : (
                eletricistasAtivos.map((eletricista) =>
                  editandoEletricista?.id === eletricista.id ? (
                    <div key={eletricista.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] items-center gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoEletricista.nome}
                        onChange={(e) => setEditandoEletricista({ ...editandoEletricista, nome: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarEdicaoEletricista(); if (e.key === 'Escape') setEditandoEletricista(null); }}
                        className="h-8"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editandoEletricista.valorDiaria}
                        onChange={(e) => setEditandoEletricista({ ...editandoEletricista, valorDiaria: e.target.value })}
                        className="h-8"
                      />
                      <Button variant="ghost" size="icon" onClick={handleSalvarEdicaoEletricista}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoEletricista(null)}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div key={eletricista.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                      <div>
                        <p className="break-words">{eletricista.nome}</p>
                        <p className="text-xs text-muted-foreground">Diária: {formatCurrency(eletricista.valorDiaria)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoEletricista({
                            id: eletricista.id,
                            nome: eletricista.nome,
                            valorDiaria: String(eletricista.valorDiaria),
                          })}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExcluirEletricista(eletricista.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-4 md:p-6 space-y-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-700 text-white text-center py-2 px-4">
            <p className="font-bold text-sm md:text-base uppercase tracking-wide">
              Relatório de Produção Elétrica {format(mesReferencia, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()} - {obraNome.toUpperCase()}
            </p>
          </div>
          <div className="bg-gray-200 text-center py-2 px-4">
            <p className="font-bold text-sm sm:text-base md:text-lg uppercase tracking-wide break-words leading-snug">{tabelaTitulo}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-center sm:justify-between lg:flex-row">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Button variant="outline" size="icon" onClick={irMesAnterior}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[8.5rem] sm:min-w-[10rem] text-center capitalize">
              {format(mesReferencia, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={irProximoMes}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:min-w-[20rem] sm:w-auto">
            <Button variant="outline" size="icon" onClick={irEletricistaAnterior} disabled={eletricistasTabelaDisponiveis.length === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={tabelaEletricistaId} onValueChange={setTabelaEletricistaId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a equipe</SelectItem>
                {eletricistasTabelaDisponiveis.map((eletricista) => (
                  <SelectItem key={eletricista.id} value={eletricista.id}>
                    {eletricista.nome}{!eletricista.ativo ? ' (histórico)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={irProximoEletricista} disabled={eletricistasTabelaDisponiveis.length === 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border -mx-1 sm:mx-0">
          <table className="min-w-[960px] w-full table-fixed text-xs sm:text-sm border-collapse whitespace-nowrap">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="px-3 py-2 text-left font-bold uppercase text-xs border border-gray-500">Serviço</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">Valor</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">% feito</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">Dia início</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">Dia final</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">Metragem (mês)</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-gray-500">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {resumoMensal.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    Cadastre tarefas de elétrica para começar.
                  </td>
                </tr>
              ) : (
                resumoMensal.map((item, idx) => (
                  <tr key={item.tarefa.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border border-gray-200 font-semibold uppercase text-xs">{item.tarefa.nome}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs">{formatCurrency(item.tarefa.valor)}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs font-semibold">
                      {item.tarefa.metragemPrevista > 0 ? `${item.percentualFeito.toFixed(1).replace('.', ',')}%` : '-'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs">
                      {item.dataInicio ? format(parseISO(item.dataInicio), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs">
                      {item.dataFinal ? format(parseISO(item.dataFinal), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs font-semibold">
                      {item.metragemMes > 0 ? formatQuantidade(item.metragemMes) : '0'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs font-semibold bg-gray-100">
                      {item.aPagar > 0 ? formatCurrency(item.aPagar) : 'R$ -'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {(resumoMensal.length > 0 || diariasMensais.length > 0) && (
              <tfoot>
                <tr className="bg-gray-700 text-white">
                  <td className="px-3 py-2 border border-gray-500 text-left font-bold uppercase text-xs" colSpan={6}>Total produção</td>
                  <td className="px-3 py-2 border border-gray-500 text-center font-bold text-xs">{formatCurrency(totalPagarMes)}</td>
                </tr>
                <tr className="bg-slate-600 text-white">
                  <td className="px-3 py-2 border border-slate-500 text-left font-bold uppercase text-xs">Diárias</td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 w-full max-w-[96px] mx-auto text-center bg-white text-slate-900"
                      value={valorDiariaResumoEditavel}
                      onChange={(e) => setValorDiariaResumoEditavel(e.target.value)}
                      onBlur={handleSalvarValorDiariaResumo}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSalvarValorDiariaResumo();
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">{totalDiariasQuantidadeMes}</td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">-</td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">-</td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">-</td>
                  <td className="px-3 py-2 border border-slate-500 text-center font-bold text-xs">{formatCurrency(totalDiariasMes)}</td>
                </tr>
                <tr className="bg-primary text-primary-foreground">
                  <td className="px-3 py-2 border border-primary/80 text-left font-bold uppercase text-xs" colSpan={6}>Total geral a pagar</td>
                  <td className="px-3 py-2 border border-primary/80 text-center font-bold text-xs">{formatCurrency(totalGeralMes)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="overflow-x-auto rounded-lg border -mx-1 sm:mx-0">
          <table className="min-w-[640px] w-full text-xs sm:text-sm border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-600 text-white">
                <th className="px-3 py-2 text-left font-bold uppercase text-xs border border-slate-500">Diárias no mês</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-xs border border-slate-500">Data</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-xs border border-slate-500">Eletricista</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-xs border border-slate-500">Observação</th>
              </tr>
            </thead>
            <tbody>
              {diariasMensais.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-6">
                    Sem diárias lançadas neste mês.
                  </td>
                </tr>
              ) : (
                diariasMensais.map((registro, idx) => (
                  <tr key={registro.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 border border-gray-200 text-xs font-semibold">
                      {registro.fatorDiaria === 0.5 ? 'MEIA DIÁRIA' : 'DIÁRIA'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-xs">
                      {format(parseISO(registro.data), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-xs">
                      {eletricistasPorId[registro.eletricistaId]?.nome || 'Eletricista removido'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-xs">
                      {registro.observacao || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showGerenciarTarefas} onOpenChange={setShowGerenciarTarefas}>
        <DialogContent className="w-[95vw] max-w-2xl h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Tarefas de elétrica</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2">
              <Input
                placeholder="Nome da tarefa"
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
              />
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Valor R$"
                value={novoValorTarefa}
                onChange={(e) => setNovoValorTarefa(e.target.value)}
              />
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Metragem total"
                value={novaMetragemPrevista}
                onChange={(e) => setNovaMetragemPrevista(e.target.value)}
              />
              <Button type="button" onClick={handleAdicionarTarefa}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {tarefas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              ) : (
                tarefas.map((tarefa) =>
                  editandoTarefa?.id === tarefa.id ? (
                    <div key={tarefa.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto_auto] gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoTarefa.nome}
                        onChange={(e) => setEditandoTarefa({ ...editandoTarefa, nome: e.target.value })}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editandoTarefa.valor}
                        onChange={(e) => setEditandoTarefa({ ...editandoTarefa, valor: e.target.value })}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editandoTarefa.metragemPrevista}
                        onChange={(e) => setEditandoTarefa({ ...editandoTarefa, metragemPrevista: e.target.value })}
                      />
                      <Button variant="ghost" size="icon" onClick={handleSalvarEdicaoTarefa}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoTarefa(null)}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div key={tarefa.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                      <div>
                        <p className="font-medium break-words">{tarefa.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Valor: {formatCurrency(tarefa.valor)} | Metragem total: {formatQuantidade(tarefa.metragemPrevista)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoTarefa({
                            id: tarefa.id,
                            nome: tarefa.nome,
                            valor: String(tarefa.valor),
                            metragemPrevista: String(tarefa.metragemPrevista),
                          })}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExcluirTarefa(tarefa.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLancarDialog} onOpenChange={setShowLancarDialog}>
        <DialogContent className="w-[95vw] max-w-2xl h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Lançar produção elétrica - {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
            {eletricistasAtivos.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para lançar, primeiro cadastre pelo menos 1 eletricista.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowGerenciarEletricistas(true)}>
                    Gerenciar eletricistas
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="mb-1 block">Tipo de lançamento</Label>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!formEhDiaria}
                        disabled={tarefas.length === 0}
                        onChange={() => setFormEhDiaria(false)}
                      />
                      Produção
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formEhDiaria && formFatorDiaria === 1}
                        onChange={() => {
                          setFormEhDiaria(true);
                          setFormTarefaId('');
                          setFormDataFim('');
                          setFormMetragem('');
                          setFormFatorDiaria(1);
                        }}
                      />
                      Diária
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formEhDiaria && formFatorDiaria === 0.5}
                        onChange={() => {
                          setFormEhDiaria(true);
                          setFormFatorDiaria(0.5);
                        }}
                      />
                      Meia diária
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Eletricista</Label>
                  <Select value={formEletricistaId} onValueChange={setFormEletricistaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {eletricistasAtivos.map((eletricista) => (
                        <SelectItem key={eletricista.id} value={eletricista.id}>
                          {eletricista.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Serviço</Label>
                  <Select value={formTarefaId} onValueChange={setFormTarefaId} disabled={formEhDiaria || tarefas.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={formEhDiaria ? 'Não se aplica para diária' : (tarefas.length === 0 ? 'Cadastre tarefas para produção' : 'Selecione')} />
                    </SelectTrigger>
                    <SelectContent>
                      {tarefas.map((tarefa) => (
                        <SelectItem key={tarefa.id} value={tarefa.id}>
                          {tarefa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Início da tarefa</Label>
                  <Input
                    type="date"
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    disabled={formEhDiaria || Boolean(dataInicioJaRegistrada)}
                  />
                  {!formEhDiaria && dataInicioJaRegistrada && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tarefa já iniciada em {format(parseISO(dataInicioJaRegistrada), 'dd/MM/yyyy')}. Para alterar, edite o lançamento desse dia.
                    </p>
                  )}
                  {formEhDiaria && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Para diária, o início será o próprio dia do lançamento.
                    </p>
                  )}
                </div>

                <div>
                  <Label>Finalizar tarefa (opcional)</Label>
                  <Input
                    type="date"
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    disabled={formEhDiaria}
                  />
                </div>

                <div>
                  <Label>Metragem feita (opcional)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formMetragem}
                    onChange={(e) => setFormMetragem(e.target.value)}
                    placeholder="Ex.: 12,5"
                    disabled={formEhDiaria || Boolean(formDataFim)}
                  />
                  {!formEhDiaria && formDataFim && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Com data final informada, a metragem deste lançamento será preenchida automaticamente com o restante da tarefa.
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <Label>Observação</Label>
                  <Input
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                {tarefas.length === 0 && (
                  <div className="sm:col-span-2 text-xs text-muted-foreground">
                    Sem tarefas cadastradas: você pode lançar apenas diária. Para produção, cadastre tarefas em "Gerenciar tarefas".
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button className="w-full sm:w-auto" onClick={handleSalvarLancamento} disabled={eletricistasAtivos.length === 0 || (!formEhDiaria && tarefas.length === 0)}>
                Salvar lançamento
              </Button>
            </div>

            <div className="border-t pt-4 min-h-0 flex flex-col">
              <h3 className="font-semibold mb-3">Lançamentos do dia</h3>
              <div className="space-y-2 min-h-0 max-h-56 overflow-y-auto pr-1">
                {registrosDataSelecionada.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum lançamento nesta data.</p>
                ) : (
                  registrosDataSelecionada.map((registro) => (
                    editandoRegistro?.id === registro.id ? (
                      <div key={registro.id} className="border rounded-md px-3 py-3 bg-blue-50 space-y-3">
                        <div>
                          <Label className="text-xs mb-1 block">Tipo de lançamento</Label>
                          <div className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={!editandoRegistro.ehDiaria}
                                onChange={() => setEditandoRegistro((prev) => prev ? { ...prev, ehDiaria: false } : prev)}
                              />
                              Produção
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={editandoRegistro.ehDiaria && editandoRegistro.fatorDiaria === 1}
                                onChange={() => setEditandoRegistro((prev) => prev ? {
                                  ...prev,
                                  ehDiaria: true,
                                  tarefaId: '',
                                  dataFim: '',
                                  metragem: '',
                                  valor: prev.valor || '',
                                  fatorDiaria: 1,
                                } : prev)}
                              />
                              Diária
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                checked={editandoRegistro.ehDiaria && editandoRegistro.fatorDiaria === 0.5}
                                onChange={() => setEditandoRegistro((prev) => prev ? {
                                  ...prev,
                                  ehDiaria: true,
                                  tarefaId: '',
                                  dataFim: '',
                                  metragem: '',
                                  valor: prev.valor || '',
                                  fatorDiaria: 0.5,
                                } : prev)}
                              />
                              Meia diária
                            </label>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Eletricista</Label>
                            <Select
                              value={editandoRegistro.eletricistaId}
                              onValueChange={(value) => setEditandoRegistro((prev) => prev ? { ...prev, eletricistaId: value } : prev)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {eletricistas.map((eletricista) => (
                                  <SelectItem key={eletricista.id} value={eletricista.id}>
                                    {eletricista.nome}{!eletricista.ativo ? ' (histórico)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Serviço</Label>
                            <Select
                              value={editandoRegistro.tarefaId}
                              onValueChange={(value) => setEditandoRegistro((prev) => prev ? { ...prev, tarefaId: value } : prev)}
                              disabled={editandoRegistro.ehDiaria}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={editandoRegistro.ehDiaria ? 'Não se aplica para diária' : 'Selecione'} />
                              </SelectTrigger>
                              <SelectContent>
                                {tarefas.map((tarefa) => (
                                  <SelectItem key={tarefa.id} value={tarefa.id}>
                                    {tarefa.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Início</Label>
                            {(() => {
                              const registroOriginal = registros.find((r) => r.id === editandoRegistro.id);
                              const podeEditar = editandoRegistro.ehDiaria
                                ? false
                                : (registroOriginal ? registroOriginal.data === registroOriginal.dataInicio : true);
                              return (
                            <Input
                              type="date"
                              value={editandoRegistro.dataInicio}
                              onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, dataInicio: e.target.value } : prev)}
                              disabled={!podeEditar}
                            />
                              );
                            })()}
                            {(() => {
                              const registroOriginal = registros.find((r) => r.id === editandoRegistro.id);
                              const podeEditar = editandoRegistro.ehDiaria
                                ? false
                                : (registroOriginal ? registroOriginal.data === registroOriginal.dataInicio : true);
                              if (podeEditar) {
                                return null;
                              }
                              if (editandoRegistro.ehDiaria) {
                                return (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Em diária, o início segue a data do lançamento.
                                  </p>
                                );
                              }
                              return (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Para alterar o início, edite o lançamento no dia {format(parseISO(registroOriginal!.dataInicio), 'dd/MM/yyyy')}.
                                </p>
                              );
                            })()}
                          </div>

                          <div>
                            <Label className="text-xs">Final</Label>
                            <Input
                              type="date"
                              value={editandoRegistro.dataFim}
                              onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, dataFim: e.target.value } : prev)}
                              disabled={editandoRegistro.ehDiaria}
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Metragem (opcional)</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={editandoRegistro.metragem}
                              onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, metragem: e.target.value } : prev)}
                              disabled={editandoRegistro.ehDiaria || Boolean(editandoRegistro.dataFim)}
                            />
                            {!editandoRegistro.ehDiaria && editandoRegistro.dataFim && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Com data final informada, a metragem será ajustada automaticamente para o restante da tarefa.
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="text-xs">Observação</Label>
                            <Input
                              value={editandoRegistro.observacao}
                              onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, observacao: e.target.value } : prev)}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditandoRegistro(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={handleSalvarEdicaoRegistro}>
                            <Check className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div key={registro.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium break-words">
                            {eletricistasPorId[registro.eletricistaId]?.nome || 'Eletricista removido'} - {registro.ehDiaria ? 'DIÁRIA' : (tarefasPorId[registro.tarefaId || '']?.nome || 'Serviço removido')}
                          </p>
                          <p className="text-sm text-muted-foreground break-words">
                            Início: {format(parseISO(registro.dataInicio), 'dd/MM/yyyy')}
                            {!registro.ehDiaria && registro.dataFim ? ` | Final: ${format(parseISO(registro.dataFim), 'dd/MM/yyyy')}` : ''}
                            {!registro.ehDiaria ? ` | Metragem: ${registro.metragem ? formatQuantidade(registro.metragem) : '-'}` : ''}
                          </p>
                          {registro.observacao && (
                            <p className="text-xs text-muted-foreground break-words">Obs: {registro.observacao}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          <Button variant="ghost" size="icon" onClick={() => handleIniciarEdicaoRegistro(registro)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleExcluirRegistro(registro.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    )
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProducaoEletricidade;
