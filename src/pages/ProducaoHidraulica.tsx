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
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface HidraulicaTarefa {
  id: string;
  nome: string;
  valor: number;
  metragemPrevista: number;
  ordem: number;
}

interface HidraulicaRegistro {
  id: string;
  data: string;
  encanadorId: string;
  tarefaId: string;
  dataInicio: string;
  dataFim?: string;
  metragem: number | null;
  observacao?: string;
}

interface Encanador {
  id: string;
  nome: string;
  ativo: boolean;
}

const formatQuantidade = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
};

const ProducaoHidraulica = () => {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [obraNome, setObraNome] = useState('Obra');
  const [loading, setLoading] = useState(true);

  const [encanadores, setEncanadores] = useState<Encanador[]>([]);
  const [tarefas, setTarefas] = useState<HidraulicaTarefa[]>([]);
  const [registros, setRegistros] = useState<HidraulicaRegistro[]>([]);

  const [showGerenciarEncanadores, setShowGerenciarEncanadores] = useState(false);
  const [showGerenciarTarefas, setShowGerenciarTarefas] = useState(false);
  const [showLancarDialog, setShowLancarDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mesReferencia, setMesReferencia] = useState<Date>(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [tabelaEncanadorId, setTabelaEncanadorId] = useState<string>('all');

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
  const [formEncanadorId, setFormEncanadorId] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  const [formMetragem, setFormMetragem] = useState('');
  const [formObservacao, setFormObservacao] = useState('');

  const [novoEncanador, setNovoEncanador] = useState('');
  const [editandoEncanador, setEditandoEncanador] = useState<{ id: string; nome: string } | null>(null);
  const [editandoRegistro, setEditandoRegistro] = useState<{
    id: string;
    encanadorId: string;
    tarefaId: string;
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
      const [obraResp, encanadoresResp, tarefasResp, registrosResp] = await Promise.all([
        supabase.from('obras').select('nome').eq('id', Number(obraId)).single(),
        supabase
          .from('producao_hidraulica_encanadores')
          .select('id, nome, ativo')
          .eq('obra_id', Number(obraId))
          .order('nome', { ascending: true }),
        supabase
          .from('producao_hidraulica_tarefas')
          .select('id, nome, valor, metragem_prevista, ordem')
          .eq('obra_id', Number(obraId))
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('producao_hidraulica_registros')
          .select('id, data, encanador_id, tarefa_id, data_inicio, data_fim, metragem, observacao')
          .eq('obra_id', Number(obraId))
          .order('data', { ascending: false }),
      ]);

      if (obraResp.error) throw obraResp.error;
      if (encanadoresResp.error) throw encanadoresResp.error;
      if (tarefasResp.error) throw tarefasResp.error;
      if (registrosResp.error) throw registrosResp.error;

      setObraNome(obraResp.data?.nome || 'Obra');

      setEncanadores(
        (encanadoresResp.data || []).map((e) => ({
          id: e.id,
          nome: e.nome,
          ativo: Boolean(e.ativo),
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
          data: r.data,
          encanadorId: r.encanador_id,
          tarefaId: r.tarefa_id,
          dataInicio: r.data_inicio,
          dataFim: r.data_fim || undefined,
          metragem: r.metragem === null || r.metragem === undefined ? null : Number(r.metragem),
          observacao: r.observacao || '',
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar produção hidráulica:', error);
      toast({
        title: 'Erro ao carregar produção hidráulica',
        description: 'Verifique se as tabelas da hidráulica já foram criadas no banco.',
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
    return tarefas.reduce<Record<string, HidraulicaTarefa>>((acc, tarefa) => {
      acc[tarefa.id] = tarefa;
      return acc;
    }, {});
  }, [tarefas]);

  const encanadoresPorId = useMemo(() => {
    return encanadores.reduce<Record<string, Encanador>>((acc, encanador) => {
      acc[encanador.id] = encanador;
      return acc;
    }, {});
  }, [encanadores]);

  const encanadoresAtivos = useMemo(() => {
    return encanadores.filter((e) => e.ativo);
  }, [encanadores]);

  const encanadoresTabelaDisponiveis = useMemo(() => {
    const inicioMes = startOfMonth(mesReferencia);
    const fimMes = endOfMonth(mesReferencia);

    const idsComDadosNoMes = new Set(
      registros
        .filter((r) => {
          const d = parseISO(r.data);
          return d >= inicioMes && d <= fimMes;
        })
        .map((r) => r.encanadorId)
    );

    return encanadores
      .filter((e) => e.ativo || idsComDadosNoMes.has(e.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [encanadores, registros, mesReferencia]);

  useEffect(() => {
    if (tabelaEncanadorId === 'all') {
      return;
    }

    const existe = encanadoresTabelaDisponiveis.some((e) => e.id === tabelaEncanadorId);
    if (!existe) {
      setTabelaEncanadorId('all');
    }
  }, [encanadoresTabelaDisponiveis, tabelaEncanadorId]);

  const todosNaTabelaIds = ['all', ...encanadoresTabelaDisponiveis.map((e) => e.id)];
  const idxEncanadorAtual = todosNaTabelaIds.indexOf(tabelaEncanadorId);

  const irEncanadorAnterior = () => {
    const prevIdx = (idxEncanadorAtual - 1 + todosNaTabelaIds.length) % todosNaTabelaIds.length;
    setTabelaEncanadorId(todosNaTabelaIds[prevIdx]);
  };

  const irProximoEncanador = () => {
    const nextIdx = (idxEncanadorAtual + 1) % todosNaTabelaIds.length;
    setTabelaEncanadorId(todosNaTabelaIds[nextIdx]);
  };

  const encanadorTabelaAtual = encanadoresTabelaDisponiveis.find((e) => e.id === tabelaEncanadorId);
  const tabelaTitulo = tabelaEncanadorId === 'all'
    ? 'Toda a Equipe'
    : (encanadorTabelaAtual?.nome || 'Encanador');

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') {
      return '';
    }

    const dataStr = format(date, 'yyyy-MM-dd');
    const temRegistro = registros.some((r) => r.data === dataStr);
    return temRegistro ? 'producao-dia' : '';
  };

  const resumoMensal = useMemo(() => {
    const inicioMes = startOfMonth(mesReferencia);
    const fimMes = endOfMonth(mesReferencia);
    const registrosBase = tabelaEncanadorId === 'all'
      ? registros
      : registros.filter((r) => r.encanadorId === tabelaEncanadorId);

    return tarefas.map((tarefa) => {
      const registrosTarefa = registrosBase
        .filter((r) => r.tarefaId === tarefa.id)
        .sort((a, b) => a.data.localeCompare(b.data));

      const registrosNoMes = registrosTarefa.filter((r) => {
        const d = parseISO(r.data);
        return d >= inicioMes && d <= fimMes;
      });

      const metragemMes = registrosNoMes.reduce((acc, r) => acc + (r.metragem || 0), 0);
      const metragemAcumuladaAteMes = registrosTarefa
        .filter((r) => parseISO(r.data) <= fimMes)
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

      return {
        tarefa,
        metragemMes,
        percentualFeito,
        dataInicio,
        dataFinal,
        aPagar,
      };
    });
  }, [tarefas, registros, mesReferencia, tabelaEncanadorId]);

  const totalPagarMes = useMemo(() => {
    return resumoMensal.reduce((acc, item) => acc + item.aPagar, 0);
  }, [resumoMensal]);

  const registrosDataSelecionada = useMemo(() => {
    if (!selectedDate) {
      return [] as HidraulicaRegistro[];
    }

    const dataStr = format(selectedDate, 'yyyy-MM-dd');
    return registros
      .filter((r) => r.data === dataStr)
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  }, [selectedDate, registros]);

  const dataInicioJaRegistrada = useMemo(() => {
    if (!formEncanadorId || !formTarefaId) {
      return null;
    }

    const primeiraData = registros
      .filter((r) => r.encanadorId === formEncanadorId && r.tarefaId === formTarefaId)
      .map((r) => r.dataInicio)
      .sort((a, b) => a.localeCompare(b))[0];

    return primeiraData || null;
  }, [registros, formEncanadorId, formTarefaId]);

  useEffect(() => {
    if (dataInicioJaRegistrada) {
      setFormDataInicio(dataInicioJaRegistrada);
      return;
    }

    if (selectedDate) {
      setFormDataInicio(format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [dataInicioJaRegistrada, selectedDate]);

  const handleAbrirLancamento = (data: Date) => {
    setSelectedDate(data);
    setFormTarefaId('');
    setFormEncanadorId('');
    setFormDataInicio(format(data, 'yyyy-MM-dd'));
    setFormDataFim('');
    setFormMetragem('');
    setFormObservacao('');
    setShowLancarDialog(true);
  };

  const handleAdicionarEncanador = async () => {
    if (!obraId) {
      return;
    }

    const nome = novoEncanador.trim();
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do encanador.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('producao_hidraulica_encanadores')
      .insert({ obra_id: Number(obraId), nome, ativo: true })
      .select('id, nome, ativo')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao adicionar encanador',
        description: error?.message || 'Não foi possível salvar o encanador.',
        variant: 'destructive',
      });
      return;
    }

    setEncanadores((prev) => [...prev, { id: data.id, nome: data.nome, ativo: Boolean(data.ativo) }]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setNovoEncanador('');
  };

  const handleSalvarEdicaoEncanador = async () => {
    if (!obraId || !editandoEncanador) {
      return;
    }

    const nome = editandoEncanador.nome.trim();
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do encanador.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_hidraulica_encanadores')
      .update({ nome })
      .eq('id', editandoEncanador.id)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao editar encanador',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setEncanadores((prev) => prev
      .map((e) => (e.id === editandoEncanador.id ? { ...e, nome } : e))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setEditandoEncanador(null);
  };

  const handleExcluirEncanador = async (encanadorId: string) => {
    if (!obraId) {
      return;
    }

    const possuiHistorico = registros.some((r) => r.encanadorId === encanadorId);

    if (possuiHistorico) {
      const { error } = await supabase
        .from('producao_hidraulica_encanadores')
        .update({ ativo: false })
        .eq('id', encanadorId)
        .eq('obra_id', Number(obraId));

      if (error) {
        toast({
          title: 'Erro ao inativar encanador',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setEncanadores((prev) => prev.map((e) => (e.id === encanadorId ? { ...e, ativo: false } : e)));
      toast({
        title: 'Encanador inativado',
        description: 'O histórico foi mantido para os relatórios.',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_hidraulica_encanadores')
      .delete()
      .eq('id', encanadorId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir encanador',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setEncanadores((prev) => prev.filter((e) => e.id !== encanadorId));
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
      .from('producao_hidraulica_tarefas')
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
      .from('producao_hidraulica_tarefas')
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
        description: 'A tarefa já possui lançamentos de hidráulica.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('producao_hidraulica_tarefas')
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
    const metragem = metragemTexto === '' ? null : Number(metragemTexto.replace(',', '.'));

    const dataInicioParaLancamento = dataInicioJaRegistrada || formDataInicio;

    if (!formEncanadorId || !formTarefaId || !dataInicioParaLancamento) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione encanador, tarefa e data de início.',
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

    if (formDataFim && formDataFim < dataInicioParaLancamento) {
      toast({
        title: 'Data de finalização inválida',
        description: 'A data de finalização não pode ser anterior à data de início.',
        variant: 'destructive',
      });
      return;
    }

    const dataLancamento = format(selectedDate, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('producao_hidraulica_registros')
      .insert({
        obra_id: Number(obraId),
        data: dataLancamento,
        encanador_id: formEncanadorId,
        tarefa_id: formTarefaId,
        data_inicio: dataInicioParaLancamento,
        data_fim: formDataFim || null,
        metragem,
        observacao: formObservacao.trim() || null,
      })
      .select('id, data, encanador_id, tarefa_id, data_inicio, data_fim, metragem, observacao')
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
        data: data.data,
        encanadorId: data.encanador_id,
        tarefaId: data.tarefa_id,
        dataInicio: data.data_inicio,
        dataFim: data.data_fim || undefined,
        metragem: data.metragem === null || data.metragem === undefined ? null : Number(data.metragem),
        observacao: data.observacao || '',
      },
      ...prev,
    ]);

    setFormDataFim('');
    setFormMetragem('');
    setFormObservacao('');

    toast({
      title: 'Lançamento salvo',
      description: 'Lançamento registrado com sucesso.',
    });
  };

  const handleIniciarEdicaoRegistro = (registro: HidraulicaRegistro) => {
    setEditandoRegistro({
      id: registro.id,
      encanadorId: registro.encanadorId,
      tarefaId: registro.tarefaId,
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

    const metragemTexto = editandoRegistro.metragem.trim();
    const metragem = metragemTexto === '' ? null : Number(metragemTexto.replace(',', '.'));

    if (!editandoRegistro.encanadorId || !editandoRegistro.tarefaId || !editandoRegistro.dataInicio) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione encanador, serviço e data de início.',
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

    if (editandoRegistro.dataFim && editandoRegistro.dataFim < editandoRegistro.dataInicio) {
      toast({
        title: 'Data de finalização inválida',
        description: 'A data de finalização não pode ser anterior à data de início.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('producao_hidraulica_registros')
      .update({
        encanador_id: editandoRegistro.encanadorId,
        tarefa_id: editandoRegistro.tarefaId,
        data_inicio: editandoRegistro.dataInicio,
        data_fim: editandoRegistro.dataFim || null,
        metragem,
        observacao: editandoRegistro.observacao.trim() || null,
      })
      .eq('id', editandoRegistro.id)
      .eq('obra_id', Number(obraId))
      .select('id, data, encanador_id, tarefa_id, data_inicio, data_fim, metragem, observacao')
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
            encanadorId: data.encanador_id,
            tarefaId: data.tarefa_id,
            dataInicio: data.data_inicio,
            dataFim: data.data_fim || undefined,
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
      .from('producao_hidraulica_registros')
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
          <p className="ml-3 text-sm text-muted-foreground">Carregando produção hidráulica...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Produção Hidráulica</h1>
            <p className="text-sm text-muted-foreground">{obraNome}</p>
          </div>
          <Button className="h-9" variant="outline" onClick={() => navigate(`/obras/${obraId}/producao`)}>
            Pedreiros
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para obra
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarEncanadores(true)}>
            <Users className="h-4 w-4 mr-2" />
            Gerenciar encanadores
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarTarefas(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Gerenciar tarefas
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground mb-3">
          Clique em um dia do calendário para lançar início, finalização e metragem da tarefa.
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

      <Dialog open={showGerenciarEncanadores} onOpenChange={setShowGerenciarEncanadores}>
        <DialogContent className="w-[95vw] max-w-lg h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar encanadores</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nome do encanador"
                value={novoEncanador}
                onChange={(e) => setNovoEncanador(e.target.value)}
              />
              <Button className="w-full sm:w-auto" type="button" onClick={handleAdicionarEncanador}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {encanadoresAtivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum encanador cadastrado.</p>
              ) : (
                encanadoresAtivos.map((encanador) =>
                  editandoEncanador?.id === encanador.id ? (
                    <div key={encanador.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoEncanador.nome}
                        onChange={(e) => setEditandoEncanador({ ...editandoEncanador, nome: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarEdicaoEncanador(); if (e.key === 'Escape') setEditandoEncanador(null); }}
                        className="h-8"
                      />
                      <Button variant="ghost" size="icon" onClick={handleSalvarEdicaoEncanador}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoEncanador(null)}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div key={encanador.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                      <span className="break-words">{encanador.nome}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoEncanador({ id: encanador.id, nome: encanador.nome })}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExcluirEncanador(encanador.id)}>
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
              Relatório de Produção Hidráulica {format(mesReferencia, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()} - {obraNome.toUpperCase()}
            </p>
          </div>
          <div className="bg-gray-200 text-center py-2 px-4">
            <p className="font-bold text-lg uppercase tracking-widest">{tabelaTitulo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={irEncanadorAnterior} disabled={encanadoresTabelaDisponiveis.length === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={tabelaEncanadorId} onValueChange={setTabelaEncanadorId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda a equipe</SelectItem>
              {encanadoresTabelaDisponiveis.map((encanador) => (
                <SelectItem key={encanador.id} value={encanador.id}>
                  {encanador.nome}{!encanador.ativo ? ' (histórico)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={irProximoEncanador} disabled={encanadoresTabelaDisponiveis.length === 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs sm:text-sm border-collapse whitespace-nowrap">
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
                    Cadastre tarefas de hidráulica para começar.
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
            {resumoMensal.length > 0 && (
              <tfoot>
                <tr className="bg-gray-700 text-white">
                  <td className="px-3 py-2 border border-gray-500 text-center font-bold uppercase text-xs" colSpan={6}>Total</td>
                  <td className="px-3 py-2 border border-gray-500 text-center font-bold text-xs">{formatCurrency(totalPagarMes)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Dialog open={showGerenciarTarefas} onOpenChange={setShowGerenciarTarefas}>
        <DialogContent className="w-[95vw] max-w-2xl h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Tarefas de hidráulica</DialogTitle>
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
              Lançar produção hidráulica - {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
            {encanadoresAtivos.length === 0 || tarefas.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para lançar produção, primeiro cadastre pelo menos 1 encanador e 1 tarefa.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowGerenciarEncanadores(true)}>
                    Gerenciar encanadores
                  </Button>
                  <Button variant="outline" onClick={() => setShowGerenciarTarefas(true)}>
                    Gerenciar tarefas
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Encanador</Label>
                  <Select value={formEncanadorId} onValueChange={setFormEncanadorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {encanadoresAtivos.map((encanador) => (
                        <SelectItem key={encanador.id} value={encanador.id}>
                          {encanador.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Serviço</Label>
                  <Select value={formTarefaId} onValueChange={setFormTarefaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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
                    disabled={Boolean(dataInicioJaRegistrada)}
                  />
                  {dataInicioJaRegistrada && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tarefa já iniciada em {format(parseISO(dataInicioJaRegistrada), 'dd/MM/yyyy')}. Para alterar, edite o lançamento desse dia.
                    </p>
                  )}
                </div>

                <div>
                  <Label>Finalizar tarefa (opcional)</Label>
                  <Input
                    type="date"
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
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
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Observação</Label>
                  <Input
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button className="w-full sm:w-auto" onClick={handleSalvarLancamento} disabled={encanadoresAtivos.length === 0 || tarefas.length === 0}>
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
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Encanador</Label>
                            <Select
                              value={editandoRegistro.encanadorId}
                              onValueChange={(value) => setEditandoRegistro((prev) => prev ? { ...prev, encanadorId: value } : prev)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {encanadores.map((encanador) => (
                                  <SelectItem key={encanador.id} value={encanador.id}>
                                    {encanador.nome}{!encanador.ativo ? ' (histórico)' : ''}
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
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
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
                              const podeEditar = registroOriginal ? registroOriginal.data === registroOriginal.dataInicio : true;
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
                              const podeEditar = registroOriginal ? registroOriginal.data === registroOriginal.dataInicio : true;
                              if (podeEditar) {
                                return null;
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
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Metragem (opcional)</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={editandoRegistro.metragem}
                              onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, metragem: e.target.value } : prev)}
                            />
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
                            {encanadoresPorId[registro.encanadorId]?.nome || 'Encanador removido'} - {tarefasPorId[registro.tarefaId]?.nome || 'Serviço removido'}
                          </p>
                          <p className="text-sm text-muted-foreground break-words">
                            Início: {format(parseISO(registro.dataInicio), 'dd/MM/yyyy')}
                            {registro.dataFim ? ` | Final: ${format(parseISO(registro.dataFim), 'dd/MM/yyyy')}` : ''}
                            {' | '}
                            Metragem: {registro.metragem ? formatQuantidade(registro.metragem) : '-'}
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

export default ProducaoHidraulica;
