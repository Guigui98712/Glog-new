import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { formatCurrency } from '@/lib/utils';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Users, ClipboardList, ChevronLeft, ChevronRight, Pencil, Check, X, FileSpreadsheet, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

interface Pedreiro {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Tarefa {
  id: string;
  nome: string;
  valor: number;
  ordem: number;
}

interface ProducaoRegistro {
  id: string;
  data: string;
  pedreiroId: string;
  tarefaId: string;
  quantidade: number;
  quantidadeFormula?: string;
  pavimento: string;
  observacao?: string;
}

const FALTA_TAG = '[FALTOU]';

const isRegistroFalta = (registro: ProducaoRegistro) => {
  return (registro.observacao || '').startsWith(FALTA_TAG);
};

const getMotivoFalta = (registro: ProducaoRegistro) => {
  const obs = registro.observacao || '';
  if (!obs.startsWith(FALTA_TAG)) {
    return obs;
  }
  return obs.replace(FALTA_TAG, '').trim();
};

const montarObservacaoFalta = (motivo: string) => {
  const texto = motivo.trim();
  return texto ? `${FALTA_TAG} ${texto}` : FALTA_TAG;
};

interface SemanaColuna {
  id: string;
  inicio: Date;
  fim: Date;
  label: string;
}

const formatQuantidade = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
};

const calcularExpressao = (expressao: string): number | null => {
  const limpa = expressao.replace(/\s+/g, '').replace(/,/g, '.');

  if (!limpa) {
    return null;
  }

  // Permite apenas numeros, operadores e parenteses.
  if (!/^[0-9+\-*/().]+$/.test(limpa)) {
    return null;
  }

  let balanceamento = 0;
  for (const ch of limpa) {
    if (ch === '(') balanceamento += 1;
    if (ch === ')') balanceamento -= 1;
    if (balanceamento < 0) return null;
  }
  if (balanceamento !== 0) {
    return null;
  }

  try {
    const resultado = Function(`"use strict"; return (${limpa});`)();
    if (typeof resultado !== 'number' || !Number.isFinite(resultado)) {
      return null;
    }
    return resultado;
  } catch {
    return null;
  }
};

const resolverQuantidade = (valorBruto: string): number | null => {
  const texto = valorBruto.trim();
  if (!texto) {
    return null;
  }

  if (texto.startsWith('=')) {
    return calcularExpressao(texto.slice(1));
  }

  const numero = Number(texto.replace(',', '.'));
  if (!Number.isFinite(numero)) {
    return null;
  }
  return numero;
};

const normalizarNomeAba = (nome: string) => {
  const limpo = nome.replace(/[\\/:*?\[\]]/g, '').trim();
  return (limpo || 'Pedreiro').slice(0, 31);
};

const ordenarTarefas = (lista: Tarefa[]) => {
  return [...lista].sort((a, b) => {
    if (a.ordem !== b.ordem) {
      return a.ordem - b.ordem;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
};

const montarSemanasDoMes = (mesReferencia: Date): SemanaColuna[] => {
  const inicioMes = startOfMonth(mesReferencia);
  const fimMes = endOfMonth(mesReferencia);
  const semanas: SemanaColuna[] = [];

  // Anda dia a dia, agrupando por semana ISO (seg-sex), só dentro do mês
  let cursor = new Date(inicioMes);

  while (cursor <= fimMes) {
    const diaSemana = cursor.getDay(); // 0=dom, 6=sab

    // Pula fins de semana
    if (diaSemana === 0 || diaSemana === 6) {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // Este cursor é segunda (ou primeira 2ª-6ª do mês)
    const inicioSemanaUtil = new Date(cursor);

    // Avança até sexta-feira (5) ou fim do mês
    while (cursor <= fimMes && cursor.getDay() !== 6 && cursor.getDay() !== 0) {
      const proximo = new Date(cursor);
      proximo.setDate(proximo.getDate() + 1);
      if (proximo > fimMes || proximo.getDay() === 6 || proximo.getDay() === 0) {
        break;
      }
      cursor = proximo;
    }

    const fimSemanaUtil = new Date(cursor);

    semanas.push({
      id: format(inicioSemanaUtil, 'yyyy-MM-dd'),
      inicio: inicioSemanaUtil,
      fim: fimSemanaUtil,
      label: `${format(inicioSemanaUtil, 'dd/MM')} a ${format(fimSemanaUtil, 'dd/MM')}`,
    });

    // Pula para a próxima segunda-feira
    cursor = new Date(fimSemanaUtil);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getDay() === 6 || cursor.getDay() === 0) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return semanas;
};

const ProducaoObra = () => {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [obraNome, setObraNome] = useState('Obra');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);

  const [pedreiros, setPedreiros] = useState<Pedreiro[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [registros, setRegistros] = useState<ProducaoRegistro[]>([]);

  const [showGerenciarPedreiros, setShowGerenciarPedreiros] = useState(false);
  const [showGerenciarTarefas, setShowGerenciarTarefas] = useState(false);
  const [showLancarDialog, setShowLancarDialog] = useState(false);

  const [novoPedreiro, setNovoPedreiro] = useState('');
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novoValorTarefa, setNovoValorTarefa] = useState('');

  const [editandoPedreiro, setEditandoPedreiro] = useState<{ id: string; nome: string } | null>(null);
  const [editandoTarefa, setEditandoTarefa] = useState<{ id: string; nome: string; valor: string } | null>(null);

  const [tabelaPedreiroId, setTabelaPedreiroId] = useState<string>('all');
  const [tabelaMes, setTabelaMes] = useState<Date>(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const [formPedreiroId, setFormPedreiroId] = useState('');
  const [formTarefaId, setFormTarefaId] = useState('');
  const [formQuantidade, setFormQuantidade] = useState('');
  const [formQuantidadeFormula, setFormQuantidadeFormula] = useState<string | null>(null);
  const [formPavimento, setFormPavimento] = useState('');
  const [formObservacao, setFormObservacao] = useState('');
  const [formPedreiroFaltou, setFormPedreiroFaltou] = useState(false);
  const [editandoRegistro, setEditandoRegistro] = useState<{
    id: string;
    pedreiroId: string;
    tarefaId: string;
    quantidade: string;
    pavimento: string;
    observacao: string;
    faltou: boolean;
  } | null>(null);

  const carregarDadosProducao = async () => {
    if (!obraId) {
      return;
    }

    try {
      setLoadingDados(true);
      const obraNumero = Number(obraId);

      const [pedreirosResp, tarefasResp, registrosResp] = await Promise.all([
        supabase
          .from('producao_pedreiros')
          .select('id, nome, ativo')
          .eq('obra_id', obraNumero)
          .order('nome', { ascending: true }),
        supabase
          .from('producao_tarefas')
          .select('id, nome, valor, ordem')
          .eq('obra_id', obraNumero)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('producao_registros')
          .select('id, data, pedreiro_id, tarefa_id, quantidade, quantidade_formula, pavimento, observacao')
          .eq('obra_id', obraNumero)
          .order('data', { ascending: true }),
      ]);

      if (pedreirosResp.error || tarefasResp.error || registrosResp.error) {
        throw pedreirosResp.error || tarefasResp.error || registrosResp.error;
      }

      setPedreiros(
        (pedreirosResp.data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          ativo: p.ativo !== false,
        }))
      );
      const tarefasCarregadas = (tarefasResp.data || []).map((t: any, idx: number) => ({
        id: t.id,
        nome: t.nome,
        valor: Number(t.valor),
        ordem: typeof t.ordem === 'number' ? t.ordem : idx + 1,
      }));
      setTarefas(ordenarTarefas(tarefasCarregadas));
      setRegistros(
        (registrosResp.data || []).map((r: any) => ({
          id: r.id,
          data: r.data,
          pedreiroId: r.pedreiro_id,
          tarefaId: r.tarefa_id,
          quantidade: Number(r.quantidade),
          quantidadeFormula: r.quantidade_formula || undefined,
          pavimento: r.pavimento || '',
          observacao: r.observacao || '',
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar produção:', error);
      toast({
        title: 'Erro ao carregar produção',
        description: 'Não foi possível buscar os dados no banco.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDados(false);
    }
  };

  useEffect(() => {
    if (!obraId) {
      navigate('/obras');
      return;
    }

    const carregarObra = async () => {
      const { data, error } = await supabase
        .from('obras')
        .select('nome')
        .eq('id', Number(obraId))
        .single();

      if (!error && data?.nome) {
        setObraNome(data.nome);
      }
    };

    carregarObra();
  }, [obraId, navigate]);

  useEffect(() => {
    carregarDadosProducao();
  }, [obraId]);

  const pedreirosAtivos = useMemo(() => pedreiros.filter((p) => p.ativo), [pedreiros]);

  useEffect(() => {
    if (tabelaPedreiroId === 'all') {
      return;
    }

    const selecionadoAtivo = pedreirosAtivos.some((p) => p.id === tabelaPedreiroId);
    if (!selecionadoAtivo) {
      setTabelaPedreiroId('all');
    }
  }, [tabelaPedreiroId, pedreirosAtivos]);

  const semanasDoMes = useMemo(() => montarSemanasDoMes(tabelaMes), [tabelaMes]);

  const registrosDoMes = useMemo(() => {
    return registros.filter((registro) => {
      const dataRegistro = parseISO(registro.data);
      const noMes = isSameMonth(dataRegistro, tabelaMes);
      const noFiltro = tabelaPedreiroId === 'all' ? true : registro.pedreiroId === tabelaPedreiroId;
      return noMes && noFiltro;
    });
  }, [registros, tabelaMes, tabelaPedreiroId]);

  const resumoPorTarefa = useMemo(() => {
    return tarefas.map((tarefa) => {
      const registrosDaTarefa = registrosDoMes.filter((r) => r.tarefaId === tarefa.id);
      const valoresSemana = semanasDoMes.map((semana) => {
        return registrosDaTarefa
          .filter((r) => {
            const dataRegistro = parseISO(r.data);
            return dataRegistro >= semana.inicio && dataRegistro <= semana.fim;
          })
          .reduce((acc, r) => acc + r.quantidade, 0);
      });

      const totalQuantidade = valoresSemana.reduce((acc, valor) => acc + valor, 0);
      const totalPagar = totalQuantidade * tarefa.valor;

      return {
        tarefa,
        valoresSemana,
        totalQuantidade,
        totalPagar,
      };
    });
  }, [tarefas, registrosDoMes, semanasDoMes]);

  const totalGeralPagar = useMemo(() => {
    return resumoPorTarefa.reduce((acc, item) => acc + item.totalPagar, 0);
  }, [resumoPorTarefa]);

  // Pavimento mais frequente por semana (considerando filtro de pedreiro)
  const pavimentoPorSemana = useMemo(() => {
    return semanasDoMes.map((semana) => {
      const registrosDaSemana = registrosDoMes.filter((r) => {
        const d = parseISO(r.data);
        return d >= semana.inicio && d <= semana.fim && r.pavimento;
      });

      if (registrosDaSemana.length === 0) return '';

      const freq: Record<string, number> = {};
      for (const r of registrosDaSemana) {
        const pav = r.pavimento.trim();
        if (pav) freq[pav] = (freq[pav] || 0) + 1;
      }

      return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    });
  }, [semanasDoMes, registrosDoMes]);

  const registrosDataSelecionada = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const dataSelecionada = format(selectedDate, 'yyyy-MM-dd');
    return registros.filter((r) => r.data === dataSelecionada);
  }, [registros, selectedDate]);

  const pedreirosComLancamentoNaData = useMemo(() => {
    return new Set(registrosDataSelecionada.map((registro) => registro.pedreiroId));
  }, [registrosDataSelecionada]);

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') {
      return '';
    }

    const dataStr = format(date, 'yyyy-MM-dd');
    const temRegistro = registros.some((r) => r.data === dataStr);
    return temRegistro ? 'producao-dia' : '';
  };

  const handleAbrirLancamento = (date: Date) => {
    setSelectedDate(date);
    setFormPedreiroId(pedreirosAtivos[0]?.id || '');
    setFormTarefaId(tarefas[0]?.id || '');
    setFormQuantidade('');
    setFormQuantidadeFormula(null);
    setFormPavimento('');
    setFormObservacao('');
    setFormPedreiroFaltou(false);
    setShowLancarDialog(true);
  };

  const handleAdicionarPedreiro = async () => {
    const nome = novoPedreiro.trim();

    if (!nome) {
      return;
    }

    const jaExiste = pedreirosAtivos.some((p) => p.nome.toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
      toast({
        title: 'Pedreiro já cadastrado',
        description: 'Use outro nome ou remova o cadastro existente.',
      });
      return;
    }

    if (!obraId) {
      return;
    }

    const inativoMesmoNome = pedreiros.find(
      (p) => !p.ativo && p.nome.toLowerCase() === nome.toLowerCase()
    );

    if (inativoMesmoNome) {
      const { data, error } = await supabase
        .from('producao_pedreiros')
        .update({ nome, ativo: true, data_inativacao: null })
        .eq('id', inativoMesmoNome.id)
        .eq('obra_id', Number(obraId))
        .select('id, nome, ativo')
        .single();

      if (error || !data) {
        toast({
          title: 'Erro ao reativar pedreiro',
          description: 'Não foi possível atualizar no banco.',
          variant: 'destructive',
        });
        return;
      }

      setPedreiros((prev) =>
        prev.map((p) =>
          p.id === data.id
            ? { id: data.id, nome: data.nome, ativo: data.ativo !== false }
            : p
        )
      );
      setNovoPedreiro('');
      return;
    }

    const { data, error } = await supabase
      .from('producao_pedreiros')
      .insert({ obra_id: Number(obraId), nome, ativo: true, data_inativacao: null })
      .select('id, nome, ativo')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao salvar pedreiro',
        description: 'Não foi possível cadastrar no banco.',
        variant: 'destructive',
      });
      return;
    }

    setPedreiros((prev) => [...prev, { id: data.id, nome: data.nome, ativo: data.ativo !== false }]);
    setNovoPedreiro('');
  };

  const handleExcluirPedreiro = async (pedreiroId: string) => {
    if (!obraId) {
      return;
    }

    const { error } = await supabase
      .from('producao_pedreiros')
      .update({ ativo: false, data_inativacao: new Date().toISOString() })
      .eq('id', pedreiroId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir pedreiro',
        description: 'Não foi possível remover no banco.',
        variant: 'destructive',
      });
      return;
    }

    setPedreiros((prev) => prev.map((p) => (p.id === pedreiroId ? { ...p, ativo: false } : p)));
  };

  const handleReativarPedreiro = async (pedreiroId: string) => {
    if (!obraId) {
      return;
    }

    const { data, error } = await supabase
      .from('producao_pedreiros')
      .update({ ativo: true, data_inativacao: null })
      .eq('id', pedreiroId)
      .eq('obra_id', Number(obraId))
      .select('id, nome, ativo')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao reativar pedreiro',
        description: 'Não foi possível atualizar no banco.',
        variant: 'destructive',
      });
      return;
    }

    setPedreiros((prev) =>
      prev.map((p) => (p.id === data.id ? { id: data.id, nome: data.nome, ativo: data.ativo !== false } : p))
    );
  };

  const handleSalvarEdicaoPedreiro = async () => {
    if (!editandoPedreiro) return;
    const nome = editandoPedreiro.nome.trim();
    if (!nome) return;
    const jaExiste = pedreirosAtivos.some(
      (p) => p.nome.toLowerCase() === nome.toLowerCase() && p.id !== editandoPedreiro.id
    );
    if (jaExiste) {
      toast({ title: 'Nome já cadastrado', description: 'Escolha outro nome.' });
      return;
    }
    if (!obraId) {
      return;
    }

    const { data, error } = await supabase
      .from('producao_pedreiros')
      .update({ nome })
      .eq('id', editandoPedreiro.id)
      .eq('obra_id', Number(obraId))
      .select('id, nome')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao editar pedreiro',
        description: 'Não foi possível atualizar no banco.',
        variant: 'destructive',
      });
      return;
    }

    setPedreiros((prev) => prev.map((p) => (p.id === data.id ? { ...p, nome: data.nome } : p)));
    setEditandoPedreiro(null);
  };

  const handleAdicionarTarefa = async () => {
    const nome = novaTarefa.trim();
    const valor = Number(novoValorTarefa.replace(',', '.'));

    if (!nome || Number.isNaN(valor) || valor <= 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Informe nome da tarefa e valor acima de zero.',
        variant: 'destructive',
      });
      return;
    }

    const jaExiste = tarefas.some((t) => t.nome.toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
      toast({
        title: 'Tarefa já cadastrada',
        description: 'Use outro nome ou remova a tarefa existente.',
      });
      return;
    }

    if (!obraId) {
      return;
    }

    const maiorOrdem = tarefas.length === 0 ? 0 : Math.max(...tarefas.map((t) => t.ordem));

    const { data, error } = await supabase
      .from('producao_tarefas')
      .insert({ obra_id: Number(obraId), nome, valor, ordem: maiorOrdem + 1 })
      .select('id, nome, valor, ordem')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao salvar tarefa',
        description: 'Não foi possível cadastrar no banco.',
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) =>
      ordenarTarefas([
        ...prev,
        {
          id: data.id,
          nome: data.nome,
          valor: Number(data.valor),
          ordem: typeof data.ordem === 'number' ? data.ordem : maiorOrdem + 1,
        },
      ])
    );
    setNovaTarefa('');
    setNovoValorTarefa('');
  };

  const handleExcluirTarefa = async (tarefaId: string) => {
    if (!obraId) {
      return;
    }

    const { error } = await supabase
      .from('producao_tarefas')
      .delete()
      .eq('id', tarefaId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: 'Não foi possível remover no banco.',
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) => prev.filter((t) => t.id !== tarefaId));
    setRegistros((prev) => prev.filter((r) => r.tarefaId !== tarefaId));
  };

  const handleSalvarEdicaoTarefa = async () => {
    if (!editandoTarefa) return;
    const nome = editandoTarefa.nome.trim();
    const valor = Number(editandoTarefa.valor.replace(',', '.'));
    if (!nome || Number.isNaN(valor) || valor <= 0) {
      toast({ title: 'Dados inválidos', description: 'Informe nome e valor acima de zero.', variant: 'destructive' });
      return;
    }
    const jaExiste = tarefas.some(
      (t) => t.nome.toLowerCase() === nome.toLowerCase() && t.id !== editandoTarefa.id
    );
    if (jaExiste) {
      toast({ title: 'Nome já cadastrado', description: 'Escolha outro nome.' });
      return;
    }
    if (!obraId) {
      return;
    }

    const { data, error } = await supabase
      .from('producao_tarefas')
      .update({ nome, valor })
      .eq('id', editandoTarefa.id)
      .eq('obra_id', Number(obraId))
      .select('id, nome, valor')
      .single();

    if (error || !data) {
      toast({
        title: 'Erro ao editar tarefa',
        description: 'Não foi possível atualizar no banco.',
        variant: 'destructive',
      });
      return;
    }

    setTarefas((prev) =>
      ordenarTarefas(
        prev.map((t) => (t.id === data.id ? { ...t, nome: data.nome, valor: Number(data.valor) } : t))
      )
    );
    setEditandoTarefa(null);
  };

  const handleMoverTarefa = async (tarefaId: string, direcao: 'up' | 'down') => {
    const idxAtual = tarefas.findIndex((t) => t.id === tarefaId);
    if (idxAtual === -1) {
      return;
    }

    const idxAlvo = direcao === 'up' ? idxAtual - 1 : idxAtual + 1;
    if (idxAlvo < 0 || idxAlvo >= tarefas.length) {
      return;
    }

    if (!obraId) {
      return;
    }

    const tarefaAtual = tarefas[idxAtual];
    const tarefaAlvo = tarefas[idxAlvo];

    const ordemAtual = tarefaAtual.ordem;
    const ordemAlvo = tarefaAlvo.ordem;

    const ordemTemporaria = -2147483648;

    const moverAtualParaTemp = await supabase
      .from('producao_tarefas')
      .update({ ordem: ordemTemporaria })
      .eq('id', tarefaAtual.id)
      .eq('obra_id', Number(obraId));

    if (moverAtualParaTemp.error) {
      toast({
        title: 'Erro ao reordenar',
        description: 'Não foi possível alterar a ordem das tarefas.',
        variant: 'destructive',
      });
      carregarDadosProducao();
      return;
    }

    const moverAlvoParaAtual = await supabase
      .from('producao_tarefas')
      .update({ ordem: ordemAtual })
      .eq('id', tarefaAlvo.id)
      .eq('obra_id', Number(obraId));

    if (moverAlvoParaAtual.error) {
      await supabase
        .from('producao_tarefas')
        .update({ ordem: ordemAtual })
        .eq('id', tarefaAtual.id)
        .eq('obra_id', Number(obraId));

      toast({
        title: 'Erro ao reordenar',
        description: 'Não foi possível alterar a ordem das tarefas.',
        variant: 'destructive',
      });
      carregarDadosProducao();
      return;
    }

    const moverTempParaAlvo = await supabase
      .from('producao_tarefas')
      .update({ ordem: ordemAlvo })
      .eq('id', tarefaAtual.id)
      .eq('obra_id', Number(obraId));

    if (moverTempParaAlvo.error) {
      toast({
        title: 'Erro ao reordenar',
        description: 'Não foi possível alterar a ordem das tarefas.',
        variant: 'destructive',
      });
      carregarDadosProducao();
      return;
    }

    setTarefas((prev) =>
      ordenarTarefas(
        prev.map((t) => {
          if (t.id === tarefaAtual.id) {
            return { ...t, ordem: ordemAlvo };
          }
          if (t.id === tarefaAlvo.id) {
            return { ...t, ordem: ordemAtual };
          }
          return t;
        })
      )
    );
  };

  const handleSalvarLancamento = async () => {
    if (!selectedDate) {
      return;
    }

    if (!formPedreiroId || (!formPedreiroFaltou && !formTarefaId)) {
      toast({
        title: 'Campos obrigatórios',
        description: formPedreiroFaltou
          ? 'Selecione o pedreiro.'
          : 'Selecione pedreiro e serviço.',
        variant: 'destructive',
      });
      return;
    }

    const quantidade = formPedreiroFaltou ? 0 : resolverQuantidade(formQuantidade);
    if (!formPedreiroFaltou && (quantidade === null || quantidade <= 0)) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero ou uma fórmula válida.',
        variant: 'destructive',
      });
      return;
    }

    const formulaDigitada = !formPedreiroFaltou && formQuantidade.trim().startsWith('=') ? formQuantidade.trim() : null;
    const formulaParaSalvar = formPedreiroFaltou ? null : (formulaDigitada || formQuantidadeFormula);

    if (!formPedreiroFaltou && quantidade !== null) {
      setFormQuantidade(formatQuantidade(quantidade));
    }

    if (!obraId) {
      return;
    }

    const tarefaParaSalvar = formTarefaId || tarefas[0]?.id || null;
    if (!tarefaParaSalvar) {
      toast({
        title: 'Serviço não encontrado',
        description: 'Cadastre uma tarefa para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('producao_registros')
      .insert({
        obra_id: Number(obraId),
        data: format(selectedDate, 'yyyy-MM-dd'),
        pedreiro_id: formPedreiroId,
        tarefa_id: tarefaParaSalvar,
        quantidade,
        quantidade_formula: formulaParaSalvar,
        pavimento: formPedreiroFaltou ? null : (formPavimento.trim() || null),
        observacao: formPedreiroFaltou
          ? montarObservacaoFalta(formObservacao)
          : (formObservacao.trim() || null),
      })
      .select('id, data, pedreiro_id, tarefa_id, quantidade, quantidade_formula, pavimento, observacao')
      .single();

    if (error || !data) {
      const detalheErro = error?.message ? ` (${error.message})` : '';
      toast({
        title: 'Erro ao salvar lançamento',
        description: `Não foi possível salvar no banco.${detalheErro}`,
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) => [
      ...prev,
      {
        id: data.id,
        data: data.data,
        pedreiroId: data.pedreiro_id,
        tarefaId: data.tarefa_id,
        quantidade: Number(data.quantidade),
        quantidadeFormula: data.quantidade_formula || undefined,
        pavimento: data.pavimento || '',
        observacao: data.observacao || '',
      },
    ]);
    setFormQuantidade('');
    setFormQuantidadeFormula(null);
    setFormPavimento('');
    setFormObservacao('');
    setFormPedreiroFaltou(false);
    toast({
      title: formPedreiroFaltou ? 'Falta registrada' : 'Produção lançada',
      description: formPedreiroFaltou ? 'Falta do pedreiro registrada com sucesso.' : 'Registro salvo com sucesso.',
    });
  };

  const handleGerarPdfDiario = async () => {
    if (!selectedDate) {
      return;
    }

    if (registrosDataSelecionada.length === 0) {
      toast({
        title: 'Sem lançamentos',
        description: 'Não há produção lançada nesta data para gerar PDF.',
      });
      return;
    }

    try {
      const dataRef = format(selectedDate, 'dd/MM/yyyy');
      const nomeObraSeguro = obraNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'obra';
      const nomeArquivo = `producao_${nomeObraSeguro}_${format(selectedDate, 'dd-MM-yyyy')}.pdf`;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const margemX = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margemX * 2;
      const labelWidth = 24;
      let cursorY = 0;

      const desenharCabecalho = (novaPagina: boolean) => {
        if (novaPagina) {
          pdf.addPage();
        }

        pdf.setFillColor(34, 63, 98);
        pdf.rect(0, 0, pageWidth, 22, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.text('Relatório de Produção Diária', margemX, 10.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Data: ${dataRef}`, margemX, 16.5);

        pdf.setFillColor(242, 246, 252);
        pdf.setDrawColor(220, 228, 238);
        pdf.roundedRect(margemX, 27, contentWidth, 12, 2, 2, 'FD');

        pdf.setTextColor(34, 63, 98);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        const obraTexto = pdf.splitTextToSize(`Obra: ${obraNome}`, contentWidth - 8);
        pdf.text(obraTexto, margemX + 4, 32.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Lançamentos no dia: ${registrosDataSelecionada.length}`, margemX + 4, 36.7);

        cursorY = 45;
      };

      desenharCabecalho(false);

      const registrosOrdenados = [...registrosDataSelecionada].sort((a, b) => {
        const pedreiroA = pedreiros.find((p) => p.id === a.pedreiroId)?.nome || '';
        const pedreiroB = pedreiros.find((p) => p.id === b.pedreiroId)?.nome || '';
        return pedreiroA.localeCompare(pedreiroB, 'pt-BR');
      });

      const gruposPorPedreiro = registrosOrdenados.reduce<
        Record<string, { nome: string; registros: ProducaoRegistro[] }>
      >((acc, registro) => {
        const pedreiro = pedreiros.find((p) => p.id === registro.pedreiroId);
        const key = registro.pedreiroId || pedreiro?.nome || 'sem_pedreiro';
        if (!acc[key]) {
          acc[key] = {
            nome: pedreiro?.nome || 'Pedreiro não informado',
            registros: [],
          };
        }
        acc[key].registros.push(registro);
        return acc;
      }, {});

      const gruposOrdenados = Object.values(gruposPorPedreiro).sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR')
      );

      for (const grupo of gruposOrdenados) {
        const blocos = grupo.registros.map((registro) => {
          const tarefa = tarefas.find((t) => t.id === registro.tarefaId);
          const faltou = isRegistroFalta(registro);
          const campos = faltou
            ? [
                { label: 'Status', value: 'Faltou' },
                { label: 'Motivo', value: getMotivoFalta(registro) || '-' },
              ]
            : [
                { label: 'Serviço', value: tarefa?.nome || 'Não informado' },
                { label: 'Quantidade', value: formatQuantidade(registro.quantidade) },
                { label: 'Pavimento', value: registro.pavimento || '-' },
                { label: 'Obs', value: registro.observacao || '-' },
              ];

          const linhasPorCampo = campos.map((campo) =>
            pdf.splitTextToSize(String(campo.value), contentWidth - labelWidth - 10)
          );

          return { campos, linhasPorCampo };
        });

        const alturaBlocos = blocos.reduce((soma, bloco, idx) => {
          const alturaCampos = bloco.linhasPorCampo.reduce(
            (subTotal, linhas) => subTotal + linhas.length * 4.6 + 1.4,
            0
          );
          const separador = idx < blocos.length - 1 ? 3.5 : 0;
          return soma + alturaCampos + separador;
        }, 0);

        const alturaCard = 10 + alturaBlocos;

        if (cursorY + alturaCard > pageHeight - 12) {
          desenharCabecalho(true);
        }

        pdf.setFillColor(250, 252, 255);
        pdf.setDrawColor(220, 228, 238);
        pdf.roundedRect(margemX, cursorY, contentWidth, alturaCard, 2.2, 2.2, 'FD');

        pdf.setTextColor(34, 63, 98);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.text(grupo.nome, margemX + 4, cursorY + 5.4);

        let linhaY = cursorY + 10;

        for (let blocoIdx = 0; blocoIdx < blocos.length; blocoIdx += 1) {
          const bloco = blocos[blocoIdx];

          for (let idx = 0; idx < bloco.campos.length; idx += 1) {
            const campo = bloco.campos[idx];
            const linhasValor = bloco.linhasPorCampo[idx];

            pdf.setTextColor(44, 62, 80);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text(`${campo.label}:`, margemX + 4, linhaY);

            pdf.setTextColor(33, 33, 33);
            pdf.setFont('helvetica', 'normal');
            for (let j = 0; j < linhasValor.length; j += 1) {
              pdf.text(linhasValor[j], margemX + 4 + labelWidth, linhaY + j * 4.6);
            }

            linhaY += linhasValor.length * 4.6 + 1.4;
          }

          if (blocoIdx < blocos.length - 1) {
            pdf.setDrawColor(225, 233, 242);
            pdf.line(margemX + 3, linhaY, margemX + contentWidth - 3, linhaY);
            linhaY += 3.5;
          }
        }

        cursorY += alturaCard + 4;
      }

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        const result = await Filesystem.writeFile({
          path: nomeArquivo,
          data: pdfBase64,
          directory: Directory.Cache,
          recursive: true,
        });

        await Share.share({
          title: `Produção diária - ${dataRef}`,
          text: `Relatório de produção de ${dataRef} - ${obraNome}`,
          url: result.uri,
          dialogTitle: 'Compartilhar PDF de produção',
        });

        toast({
          title: 'PDF pronto',
          description: 'Compartilhamento iniciado com sucesso.',
        });
        return;
      }

      pdf.save(nomeArquivo);
      toast({
        title: 'PDF gerado',
        description: `Arquivo ${nomeArquivo} gerado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao gerar PDF diário:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar/compartilhar o PDF desta data.',
        variant: 'destructive',
      });
    }
  };

  const handleExcluirRegistro = async (registroId: string) => {
    if (!obraId) {
      return;
    }

    const { error } = await supabase
      .from('producao_registros')
      .delete()
      .eq('id', registroId)
      .eq('obra_id', Number(obraId));

    if (error) {
      toast({
        title: 'Erro ao excluir lançamento',
        description: 'Não foi possível remover no banco.',
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) => prev.filter((r) => r.id !== registroId));
  };

  const handleIniciarEdicaoRegistro = (registro: ProducaoRegistro) => {
    const faltou = isRegistroFalta(registro);
    setEditandoRegistro({
      id: registro.id,
      pedreiroId: registro.pedreiroId,
      tarefaId: registro.tarefaId,
      quantidade: faltou ? '0' : (registro.quantidadeFormula || formatQuantidade(registro.quantidade)),
      pavimento: faltou ? '' : (registro.pavimento || ''),
      observacao: faltou ? getMotivoFalta(registro) : (registro.observacao || ''),
      faltou,
    });
  };

  const handleResolverFormulaQuantidadeForm = () => {
    if (!formQuantidade.trim().startsWith('=')) {
      setFormQuantidadeFormula(null);
      return;
    }

    const resultado = resolverQuantidade(formQuantidade);
    if (resultado === null) {
      toast({
        title: 'Fórmula inválida',
        description: 'Revise a expressão. Exemplo: =2,3*6*2+8,6*2*5',
        variant: 'destructive',
      });
      return;
    }

    setFormQuantidadeFormula(formQuantidade.trim());
    setFormQuantidade(formatQuantidade(resultado));
  };

  const handleResolverFormulaQuantidadeEdicao = () => {
    if (!editandoRegistro || !editandoRegistro.quantidade.trim().startsWith('=')) {
      return;
    }

    const resultado = resolverQuantidade(editandoRegistro.quantidade);
    if (resultado === null) {
      toast({
        title: 'Fórmula inválida',
        description: 'Revise a expressão. Exemplo: =2,3*6*2+8,6*2*5',
        variant: 'destructive',
      });
      return;
    }

    // Na edicao mantemos a formula visivel para permitir ajustes.
  };

  const handleSalvarEdicaoRegistro = async () => {
    if (!editandoRegistro || !obraId) {
      return;
    }

    if (!editandoRegistro.pedreiroId || (!editandoRegistro.faltou && !editandoRegistro.tarefaId)) {
      toast({
        title: 'Campos obrigatórios',
        description: editandoRegistro.faltou
          ? 'Selecione o pedreiro.'
          : 'Selecione pedreiro e serviço.',
        variant: 'destructive',
      });
      return;
    }

    const quantidade = editandoRegistro.faltou ? 0 : resolverQuantidade(editandoRegistro.quantidade);
    if (!editandoRegistro.faltou && (quantidade === null || quantidade <= 0)) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero ou uma fórmula válida.',
        variant: 'destructive',
      });
      return;
    }

    const formulaDigitada = !editandoRegistro.faltou && editandoRegistro.quantidade.trim().startsWith('=')
      ? editandoRegistro.quantidade.trim()
      : null;

    const tarefaParaSalvar = editandoRegistro.tarefaId || tarefas[0]?.id || null;
    if (!tarefaParaSalvar) {
      toast({
        title: 'Serviço não encontrado',
        description: 'Cadastre uma tarefa para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('producao_registros')
      .update({
        pedreiro_id: editandoRegistro.pedreiroId,
        tarefa_id: tarefaParaSalvar,
        quantidade,
        quantidade_formula: editandoRegistro.faltou ? null : formulaDigitada,
        pavimento: editandoRegistro.faltou ? null : (editandoRegistro.pavimento.trim() || null),
        observacao: editandoRegistro.faltou
          ? montarObservacaoFalta(editandoRegistro.observacao)
          : (editandoRegistro.observacao.trim() || null),
      })
      .eq('id', editandoRegistro.id)
      .eq('obra_id', Number(obraId))
      .select('id, pedreiro_id, tarefa_id, quantidade, quantidade_formula, pavimento, observacao')
      .single();

    if (error || !data) {
      const detalheErro = error?.message ? ` (${error.message})` : '';
      toast({
        title: 'Erro ao editar lançamento',
        description: `Não foi possível atualizar no banco.${detalheErro}`,
        variant: 'destructive',
      });
      return;
    }

    setRegistros((prev) =>
      prev.map((r) =>
        r.id === data.id
          ? {
              ...r,
              pedreiroId: data.pedreiro_id,
              tarefaId: data.tarefa_id,
              quantidade: Number(data.quantidade),
              quantidadeFormula: data.quantidade_formula || undefined,
              pavimento: data.pavimento || '',
              observacao: data.observacao || '',
            }
          : r
      )
    );

    setEditandoRegistro(null);
    toast({
      title: 'Lançamento atualizado',
      description: 'As alterações foram salvas com sucesso.',
    });
  };

  const irMesAnterior = () => setTabelaMes((prev) => subMonths(prev, 1));
  const irProximoMes = () => setTabelaMes((prev) => addMonths(prev, 1));

  const todosNaTabelaIds = ['all', ...pedreirosAtivos.map((p) => p.id)];
  const idxPedreiroAtual = todosNaTabelaIds.indexOf(tabelaPedreiroId);

  const irPedreiroAnterior = () => {
    const prevIdx = (idxPedreiroAtual - 1 + todosNaTabelaIds.length) % todosNaTabelaIds.length;
    setTabelaPedreiroId(todosNaTabelaIds[prevIdx]);
  };

  const irProximoPedreiro = () => {
    const nextIdx = (idxPedreiroAtual + 1) % todosNaTabelaIds.length;
    setTabelaPedreiroId(todosNaTabelaIds[nextIdx]);
  };

  const pedreiroAtual = pedreirosAtivos.find((p) => p.id === tabelaPedreiroId);
  const tabelaTitulo = tabelaPedreiroId === 'all'
    ? 'Toda a Equipe'
    : (pedreiroAtual?.nome || 'Pedreiro');

  const handleExportarExcelMensal = async () => {
    const semanas = montarSemanasDoMes(tabelaMes);
    const inicioMes = startOfMonth(tabelaMes);
    const fimMes = endOfMonth(tabelaMes);

    const idsComDadosNoMes = new Set(
      registros
        .filter((r) => {
          const d = parseISO(r.data);
          return d >= inicioMes && d <= fimMes;
        })
        .map((r) => r.pedreiroId)
    );

    const pedreirosParaExportar = pedreiros
      .filter((p) => p.ativo || idsComDadosNoMes.has(p.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (pedreirosParaExportar.length === 0) {
      toast({
        title: 'Nada para exportar',
        description: 'Não há pedreiros para gerar o arquivo deste mês.',
      });
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GLog';
    const nomesAbasUsados = new Set<string>();

    const corCinzaEscuro = 'FF4B5563';
    const corCinzaMedio = 'FF6B7280';
    const corCinzaClaro = 'FFF3F4F6';
    const corVerdeClaro = 'FFE8F1E3';

    const bordaFina: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' },
    };

    // Aba resumo para visão geral do mês
    const resumoLinhas: (string | number)[][] = [];
    resumoLinhas.push([
      `RESUMO DE PRODUÇÃO ${format(tabelaMes, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()} - ${obraNome.toUpperCase()}`,
    ]);
    resumoLinhas.push([]);
    resumoLinhas.push(['PEDREIRO', 'TOTAL A PAGAR (R$)']);

    let totalResumoPagar = 0;

    for (const pedreiro of pedreirosParaExportar) {
      const registrosPedreiroMes = registros.filter((r) => {
        const d = parseISO(r.data);
        return d >= inicioMes && d <= fimMes && r.pedreiroId === pedreiro.id;
      });

      const totalPagar = tarefas.reduce((acc, tarefa) => {
        const somaQuantidade = registrosPedreiroMes
          .filter((r) => r.tarefaId === tarefa.id)
          .reduce((s, r) => s + r.quantidade, 0);
        return acc + somaQuantidade * tarefa.valor;
      }, 0);

      totalResumoPagar += totalPagar;

      resumoLinhas.push([pedreiro.nome, totalPagar]);
    }

    resumoLinhas.push(['TOTAL GERAL', totalResumoPagar]);

    const wsResumo = wb.addWorksheet('RESUMO');
    resumoLinhas.forEach((row) => wsResumo.addRow(row));

    wsResumo.columns = [
      { width: 28 },
      { width: 20 },
    ];
    wsResumo.mergeCells(1, 1, 1, 2);

    const tituloResumo = wsResumo.getCell(1, 1);
    tituloResumo.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    tituloResumo.alignment = { horizontal: 'center', vertical: 'middle' };
    tituloResumo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaEscuro } };

    for (let c = 1; c <= 2; c += 1) {
      const h = wsResumo.getCell(3, c);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h.alignment = { horizontal: 'center', vertical: 'middle' };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaMedio } };
      h.border = bordaFina;
    }

    for (let r = 4; r <= wsResumo.rowCount; r += 1) {
      for (let c = 1; c <= 2; c += 1) {
        const cell = wsResumo.getCell(r, c);
        cell.border = bordaFina;
        if (r % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaClaro } };
        }
      }
      wsResumo.getCell(r, 2).numFmt = '#,##0.00';
    }

    const ultimaResumo = wsResumo.rowCount;
    for (let c = 1; c <= 2; c += 1) {
      const cell = wsResumo.getCell(ultimaResumo, c);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVerdeClaro } };
      cell.border = bordaFina;
    }

    for (const pedreiro of pedreirosParaExportar) {
      const registrosPedreiroMes = registros.filter((r) => {
        const d = parseISO(r.data);
        return d >= inicioMes && d <= fimMes && r.pedreiroId === pedreiro.id;
      });

      const linhas: (string | number)[][] = [];

      // Título principal e subtítulo
      linhas.push([
        `RELATÓRIO DE PRODUÇÃO EMPREITA ${format(tabelaMes, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()} - ${obraNome.toUpperCase()}`,
      ]);
      linhas.push([pedreiro.nome.toUpperCase()]);
      linhas.push([]);

      // Cabeçalho no formato próximo ao seu Excel
      const headerBase = ['SERVIÇOS EXECUTADOS', 'VALOR COMBINADO'];
      const semanasHeader = semanas.map((s) => s.label.toUpperCase());
      linhas.push([...headerBase, ...semanasHeader, 'TOTAL METRAGEM', 'A PAGAR']);

      for (const tarefa of tarefas) {
        const registrosTarefa = registrosPedreiroMes.filter((r) => r.tarefaId === tarefa.id);
        const valoresSemana = semanas.map((semana) => {
          return registrosTarefa
            .filter((r) => {
              const d = parseISO(r.data);
              return d >= semana.inicio && d <= semana.fim;
            })
            .reduce((acc, r) => acc + r.quantidade, 0);
        });

        linhas.push([
          tarefa.nome.toUpperCase(),
          tarefa.valor,
          ...valoresSemana.map((v) => (v > 0 ? v : null)),
          null,
          null,
        ]);
      }

      // Pavimento mais frequente por semana
      const pavimentosSemana = semanas.map((semana) => {
        const regs = registrosPedreiroMes.filter((r) => {
          const d = parseISO(r.data);
          return d >= semana.inicio && d <= semana.fim && r.pavimento;
        });
        if (regs.length === 0) return '';
        const freq: Record<string, number> = {};
        for (const r of regs) {
          const p = r.pavimento.trim();
          if (p) freq[p] = (freq[p] || 0) + 1;
        }
        return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      });

      const totalGeralPagar = tarefas.reduce((acc, tarefa) => {
        const somaQuantidade = registrosPedreiroMes
          .filter((r) => r.tarefaId === tarefa.id)
          .reduce((s, r) => s + r.quantidade, 0);
        return acc + somaQuantidade * tarefa.valor;
      }, 0);

      linhas.push([
        'PAVIMENTOS',
        '',
        ...pavimentosSemana,
        'Total',
        totalGeralPagar,
      ]);

      let nomeAba = normalizarNomeAba(pedreiro.nome);
      let idx = 2;
      while (nomesAbasUsados.has(nomeAba)) {
        nomeAba = `${normalizarNomeAba(pedreiro.nome).slice(0, 28)} ${idx}`;
        idx += 1;
      }
      nomesAbasUsados.add(nomeAba);

      const ws = wb.addWorksheet(nomeAba);
      linhas.forEach((row) => ws.addRow(row));

      const colServico = 1;
      const colValor = 2;
      const colSemanasInicio = 3;
      const colTotalMetragem = colSemanasInicio + semanas.length;
      const colApagar = colTotalMetragem + 1;
      const ultimaCol = colApagar;

      ws.mergeCells(1, 1, 1, ultimaCol);
      ws.mergeCells(2, 1, 2, ultimaCol);

      ws.columns = [
        { width: 30 },
        { width: 12 },
        ...semanas.map(() => ({ width: 14 })),
        { width: 14 },
        { width: 14 },
      ];

      const tituloCell = ws.getCell(1, 1);
      tituloCell.font = { bold: true, size: 13 };
      tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const pedreiroCell = ws.getCell(2, 1);
      pedreiroCell.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
      pedreiroCell.alignment = { horizontal: 'center', vertical: 'middle' };
      pedreiroCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaEscuro } };

      for (let c = 1; c <= ultimaCol; c += 1) {
        const h = ws.getCell(4, c);
        h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaMedio } };
        h.border = bordaFina;
      }

      const inicioDados = 5;
      const fimDados = inicioDados + tarefas.length - 1;
      for (let r = inicioDados; r <= fimDados; r += 1) {
        for (let c = 1; c <= ultimaCol; c += 1) {
          const cell = ws.getCell(r, c);
          cell.border = bordaFina;
          cell.alignment = { horizontal: c === colServico ? 'left' : 'center', vertical: 'middle' };
          if (r % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaClaro } };
          }
        }

        ws.getCell(r, colValor).numFmt = '#,##0.00';
        for (let c = colSemanasInicio; c < colSemanasInicio + semanas.length; c += 1) {
          ws.getCell(r, c).numFmt = '#,##0.00';
        }

        const letraSemanaIni = ws.getColumn(colSemanasInicio).letter;
        const letraSemanaFim = ws.getColumn(colSemanasInicio + semanas.length - 1).letter;
        const letraTotal = ws.getColumn(colTotalMetragem).letter;
        const letraValor = ws.getColumn(colValor).letter;

        ws.getCell(r, colTotalMetragem).value = {
          formula: `IF(SUM(${letraSemanaIni}${r}:${letraSemanaFim}${r})=0,"",SUM(${letraSemanaIni}${r}:${letraSemanaFim}${r}))`,
        };
        ws.getCell(r, colTotalMetragem).numFmt = '#,##0.00';

        ws.getCell(r, colApagar).value = {
          formula: `IF(${letraTotal}${r}="","",${letraTotal}${r}*${letraValor}${r})`,
        };
        ws.getCell(r, colApagar).numFmt = '#,##0.00';

        // Coluna A PAGAR com fundo verde claro
        ws.getCell(r, colApagar).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVerdeClaro } };
      }

      const rodapeRow = fimDados + 1;
      for (let c = 1; c <= ultimaCol; c += 1) {
        const cell = ws.getCell(rodapeRow, c);
        cell.border = bordaFina;
      }

      ws.getCell(rodapeRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corCinzaMedio } };
      ws.getCell(rodapeRow, 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell(rodapeRow, 1).alignment = { horizontal: 'center' };

      ws.getCell(rodapeRow, colTotalMetragem).value = 'Total';
      ws.getCell(rodapeRow, colTotalMetragem).font = { bold: true };
      ws.getCell(rodapeRow, colTotalMetragem).alignment = { horizontal: 'center' };
      const letraApagar = ws.getColumn(colApagar).letter;
      ws.getCell(rodapeRow, colApagar).value = {
        formula: `IF(SUM(${letraApagar}${inicioDados}:${letraApagar}${fimDados})=0,"",SUM(${letraApagar}${inicioDados}:${letraApagar}${fimDados}))`,
      };
      ws.getCell(rodapeRow, colApagar).font = { bold: true };
      ws.getCell(rodapeRow, colApagar).numFmt = '#,##0.00';
      ws.getCell(rodapeRow, colApagar).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVerdeClaro } };

      // Linha de altura para legibilidade
      ws.getRow(4).height = 46;
      ws.getRow(2).height = 28;

      // Aba ja criada com nome final unico
    }

    const nomeArquivo = `producao_${obraNome.replace(/\s+/g, '_').toLowerCase()}_${format(tabelaMes, 'MM-yyyy')}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nomeArquivo;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast({
      title: 'Excel gerado',
      description: `Arquivo ${nomeArquivo} criado com ${pedreirosParaExportar.length} abas.`,
    });
  };

  if (loadingDados) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 flex items-center justify-center min-h-[220px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="ml-3 text-sm text-muted-foreground">Carregando dados de produção...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Produção de Pedreiros</h1>
          <p className="text-sm text-muted-foreground">{obraNome}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para obra
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarPedreiros(true)}>
            <Users className="h-4 w-4 mr-2" />
            Gerenciar pedreiros
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowGerenciarTarefas(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Gerenciar tarefas
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">
            Clique em um dia do calendário para lançar produção.
          </p>
        </div>

        <div className="w-full flex justify-center">
          <Calendar
            locale="pt-BR"
            className="producao-calendar"
            onClickDay={handleAbrirLancamento}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (!activeStartDate) {
                return;
              }

              setTabelaMes(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1));
            }}
            tileClassName={tileClassName}
          />
        </div>
      </Card>

      <Card className="p-4 md:p-6 space-y-4">
        {/* Cabeçalho estilo Excel */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-700 text-white text-center py-2 px-4">
            <p className="font-bold text-sm md:text-base uppercase tracking-wide">
              Relatório de Produção Empreita{' '}
              {format(tabelaMes, "MMMM/yyyy", { locale: ptBR }).toUpperCase()}{' - '}
              {obraNome.toUpperCase()}
            </p>
          </div>
          <div className="bg-gray-200 text-center py-2 px-4">
            <p className="font-bold text-lg uppercase tracking-widest">{tabelaTitulo}</p>
          </div>
        </div>

        {/* Controles de navegação */}
        <div className="flex flex-col gap-3 sm:items-center sm:justify-between lg:flex-row">
          {/* Mês */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Button variant="outline" size="icon" onClick={irMesAnterior}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[8.5rem] sm:min-w-[10rem] text-center capitalize">
              {format(tabelaMes, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={irProximoMes}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Pedreiro */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={irPedreiroAnterior} disabled={pedreirosAtivos.length === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={tabelaPedreiroId} onValueChange={setTabelaPedreiroId}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a equipe</SelectItem>
                {pedreirosAtivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={irProximoPedreiro} disabled={pedreirosAtivos.length === 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs sm:text-sm border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="px-2 sm:px-3 py-2 text-left font-bold uppercase text-[11px] sm:text-xs min-w-[150px] sm:min-w-[180px] border border-gray-500">Serviços executados</th>
                <th className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs min-w-[100px] sm:min-w-[110px] border border-gray-500">Valor combinado</th>
                {semanasDoMes.map((semana) => (
                  <th key={semana.id} className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs min-w-[90px] sm:min-w-[100px] border border-gray-500">
                    {semana.label}
                  </th>
                ))}
                <th className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs min-w-[110px] sm:min-w-[120px] border border-gray-500">Total metragem</th>
                <th className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs min-w-[110px] sm:min-w-[120px] border border-gray-500">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {resumoPorTarefa.length === 0 ? (
                <tr>
                  <td colSpan={semanasDoMes.length + 4} className="text-center text-muted-foreground py-10">
                    Cadastre tarefas para começar a montar a planilha.
                  </td>
                </tr>
              ) : (
                resumoPorTarefa.map((item, rowIdx) => (
                  <tr
                    key={item.tarefa.id}
                    className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-2 sm:px-3 py-2 font-semibold uppercase text-[11px] sm:text-xs border border-gray-200">{item.tarefa.nome}</td>
                    <td className="px-2 sm:px-3 py-2 text-center text-[11px] sm:text-xs border border-gray-200">
                      R$ {item.tarefa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    {item.valoresSemana.map((valor, index) => (
                      <td
                        key={`${item.tarefa.id}-semana-${index}`}
                        className={`px-2 sm:px-3 py-2 text-center font-semibold text-[11px] sm:text-xs border border-gray-200 ${
                          valor > 0 ? 'bg-green-50 text-green-800' : ''
                        }`}
                      >
                        {valor > 0 ? formatQuantidade(valor) : ''}
                      </td>
                    ))}
                    <td className="px-2 sm:px-3 py-2 text-center font-bold text-xs sm:text-sm border border-gray-200 bg-gray-100">
                      {item.totalQuantidade > 0 ? formatQuantidade(item.totalQuantidade) : '0'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center font-bold text-xs sm:text-sm border border-gray-200 bg-gray-100">
                      {item.totalPagar > 0 ? formatCurrency(item.totalPagar) : 'R$ -'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {resumoPorTarefa.length > 0 && (
              <tfoot>
                <tr className="bg-gray-700 text-white">
                  <td className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs border border-gray-500">Pavimentos</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs border border-gray-500"></td>
                  {pavimentoPorSemana.map((pav, idx) => (
                    <td key={idx} className="px-2 sm:px-3 py-2 text-center font-bold uppercase text-[11px] sm:text-xs border border-gray-500">
                      {pav || '-'}
                    </td>
                  ))}
                  <td className="px-2 sm:px-3 py-2 text-center font-bold text-xs sm:text-sm border border-gray-500">Total</td>
                  <td className="px-2 sm:px-3 py-2 text-center font-bold text-xs sm:text-sm border border-gray-500">{formatCurrency(totalGeralPagar)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Button className="w-full sm:w-auto" onClick={handleExportarExcelMensal}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Gerar Excel
          </Button>
        </div>
      </Card>

      <Dialog open={showGerenciarPedreiros} onOpenChange={setShowGerenciarPedreiros}>
        <DialogContent className="w-[95vw] max-w-lg h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar pedreiros</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nome do pedreiro"
                value={novoPedreiro}
                onChange={(e) => setNovoPedreiro(e.target.value)}
              />
              <Button className="w-full sm:w-auto" type="button" onClick={handleAdicionarPedreiro}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {pedreiros.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedreiro cadastrado.</p>
              ) : (
                pedreiros.map((pedreiro) =>
                  editandoPedreiro?.id === pedreiro.id ? (
                    <div key={pedreiro.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoPedreiro.nome}
                        onChange={(e) => setEditandoPedreiro({ ...editandoPedreiro, nome: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarEdicaoPedreiro(); if (e.key === 'Escape') setEditandoPedreiro(null); }}
                        className="h-8"
                      />
                      <Button variant="ghost" size="icon" onClick={handleSalvarEdicaoPedreiro}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoPedreiro(null)}>
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ) : (
                    <div key={pedreiro.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                      <span className="break-words">
                        {pedreiro.nome}
                        {!pedreiro.ativo && <span className="ml-2 text-xs text-amber-600">(inativo)</span>}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoPedreiro({ id: pedreiro.id, nome: pedreiro.nome })}
                          disabled={!pedreiro.ativo}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        {pedreiro.ativo ? (
                          <Button variant="ghost" size="icon" onClick={() => handleExcluirPedreiro(pedreiro.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleReativarPedreiro(pedreiro.id)}>
                            Reativar
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGerenciarTarefas} onOpenChange={setShowGerenciarTarefas}>
        <DialogContent className="w-[95vw] max-w-2xl h-[86vh] sm:h-[88vh] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar tarefas</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
              <Input
                placeholder="Nome da tarefa"
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Valor R$"
                value={novoValorTarefa}
                onChange={(e) => setNovoValorTarefa(e.target.value)}
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
                tarefas.map((tarefa, index) =>
                  editandoTarefa?.id === tarefa.id ? (
                    <div key={tarefa.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-blue-50">
                      <Input
                        autoFocus
                        value={editandoTarefa.nome}
                        onChange={(e) => setEditandoTarefa({ ...editandoTarefa, nome: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSalvarEdicaoTarefa();
                          if (e.key === 'Escape') setEditandoTarefa(null);
                        }}
                        className="h-8 flex-1"
                        placeholder="Nome"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editandoTarefa.valor}
                        onChange={(e) => setEditandoTarefa({ ...editandoTarefa, valor: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSalvarEdicaoTarefa();
                          if (e.key === 'Escape') setEditandoTarefa(null);
                        }}
                        className="h-8 w-28"
                        placeholder="R$"
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
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoverTarefa(tarefa.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoverTarefa(tarefa.id, 'down')}
                            disabled={index === tarefas.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Posição {index + 1}</p>
                          <p className="font-medium break-words">{tarefa.nome}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(tarefa.valor)}</p>
                        </div>
                      </div>

                      <div className="flex gap-1 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditandoTarefa({ id: tarefa.id, nome: tarefa.nome, valor: String(tarefa.valor) })}
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
          <DialogHeader className="pr-7">
            <div className="flex items-start justify-between gap-2">
              <DialogTitle>
                Lançar produção - {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : ''}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={handleGerarPdfDiario}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                PDF
              </Button>
            </div>
          </DialogHeader>

          {pedreirosAtivos.length === 0 || tarefas.length === 0 ? (
            <div className="space-y-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">
                Para lançar produção, primeiro cadastre pelo menos 1 pedreiro e 1 tarefa.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowGerenciarPedreiros(true)}>
                  Gerenciar pedreiros
                </Button>
                <Button variant="outline" onClick={() => setShowGerenciarTarefas(true)}>
                  Gerenciar tarefas
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Pedreiro</Label>
                  <Select value={formPedreiroId} onValueChange={setFormPedreiroId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {pedreirosAtivos.map((pedreiro) => (
                        <SelectItem
                          key={pedreiro.id}
                          value={pedreiro.id}
                          className={pedreirosComLancamentoNaData.has(pedreiro.id)
                            ? 'font-semibold text-green-600 focus:text-green-600'
                            : ''}
                        >
                          {pedreiro.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nomes em verde indicam pedreiros já lançados nesta data.
                  </p>
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                  <input
                    id="faltou-pedreiro"
                    type="checkbox"
                    checked={formPedreiroFaltou}
                    onChange={(e) => setFormPedreiroFaltou(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="faltou-pedreiro" className="cursor-pointer">
                    Falta
                  </Label>
                </div>

                {!formPedreiroFaltou && (
                  <>
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
                      <Label>Quantidade</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formQuantidade}
                        onChange={(e) => setFormQuantidade(e.target.value)}
                        onBlur={handleResolverFormulaQuantidadeForm}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleResolverFormulaQuantidadeForm();
                          }
                        }}
                        placeholder="Ex.: 12,5 ou =2,3*6*2+8,6*2*5"
                      />
                    </div>

                    <div>
                      <Label>Pavimento</Label>
                      <Input
                        value={formPavimento}
                        onChange={(e) => setFormPavimento(e.target.value)}
                        placeholder="Ex.: Térreo, S2, 1º andar"
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <Label>{formPedreiroFaltou ? 'Motivo da falta (opcional)' : 'Observação'}</Label>
                  <Input
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    placeholder={formPedreiroFaltou ? 'Ex.: Atestado médico' : 'Ex.: Chapisco parede externa bloco A'}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="w-full sm:w-auto" onClick={handleSalvarLancamento}>Salvar lançamento</Button>
              </div>

              <div className="border-t pt-4 min-h-0 flex flex-col">
                <h3 className="font-semibold mb-3">Lançamentos do dia</h3>
                <div className="space-y-2 min-h-0 max-h-56 overflow-y-auto pr-1">
                  {registrosDataSelecionada.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum lançamento nesta data.</p>
                  ) : (
                    registrosDataSelecionada.map((registro) => {
                      const pedreiro = pedreiros.find((p) => p.id === registro.pedreiroId);
                      const tarefa = tarefas.find((t) => t.id === registro.tarefaId);
                      const pedreirosDisponiveisEdicao = pedreiros.filter(
                        (p) => p.ativo || p.id === editandoRegistro?.pedreiroId
                      );

                      if (editandoRegistro?.id === registro.id) {
                        return (
                          <div key={registro.id} className="border rounded-md px-3 py-3 bg-blue-50 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <Label className="text-xs">Pedreiro</Label>
                                <Select
                                  value={editandoRegistro.pedreiroId}
                                  onValueChange={(value) => setEditandoRegistro((prev) => prev ? { ...prev, pedreiroId: value } : prev)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pedreirosDisponiveisEdicao.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.nome}{!p.ativo ? ' (inativo)' : ''}
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
                                  disabled={editandoRegistro.faltou}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tarefas.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="sm:col-span-2 flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                                <input
                                  id={`edit-faltou-${registro.id}`}
                                  type="checkbox"
                                  checked={editandoRegistro.faltou}
                                  onChange={(e) =>
                                    setEditandoRegistro((prev) =>
                                      prev ? { ...prev, faltou: e.target.checked } : prev
                                    )
                                  }
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`edit-faltou-${registro.id}`} className="cursor-pointer text-xs">
                                  Falta
                                </Label>
                              </div>

                              {!editandoRegistro.faltou && (
                                <>
                                  <div>
                                    <Label className="text-xs">Quantidade</Label>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={editandoRegistro.quantidade}
                                      onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, quantidade: e.target.value } : prev)}
                                      onBlur={handleResolverFormulaQuantidadeEdicao}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleResolverFormulaQuantidadeEdicao();
                                        }
                                      }}
                                      placeholder="Ex.: 12,5 ou =2,3*6*2+8,6*2*5"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs">Pavimento</Label>
                                    <Input
                                      value={editandoRegistro.pavimento}
                                      onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, pavimento: e.target.value } : prev)}
                                    />
                                  </div>
                                </>
                              )}

                              <div className="sm:col-span-2">
                                <Label className="text-xs">{editandoRegistro.faltou ? 'Motivo da falta (opcional)' : 'Observação'}</Label>
                                <Input
                                  value={editandoRegistro.observacao}
                                  onChange={(e) => setEditandoRegistro((prev) => prev ? { ...prev, observacao: e.target.value } : prev)}
                                  placeholder={editandoRegistro.faltou ? 'Ex.: Atestado médico' : 'Descreva o serviço executado'}
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
                        );
                      }

                      return (
                        <div key={registro.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md px-3 py-2">
                          <div className="min-w-0">
                            {isRegistroFalta(registro) ? (
                              <>
                                <p className="font-medium break-words">{pedreiro?.nome || 'Pedreiro removido'} - Faltou</p>
                                <p className="text-sm text-muted-foreground break-words">
                                  Motivo: {getMotivoFalta(registro) || '-'}
                                </p>
                              </>
                            ) : (
                              <>
                            <p className="font-medium break-words">{pedreiro?.nome || 'Pedreiro removido'} - {tarefa?.nome || 'Tarefa removida'}</p>
                            <p className="text-sm text-muted-foreground break-words">
                              Quantidade: {formatQuantidade(registro.quantidade)} | Pavimento: {registro.pavimento || '-'}
                            </p>
                            {registro.quantidadeFormula && (
                              <p className="text-xs text-muted-foreground break-all">Fórmula: {registro.quantidadeFormula}</p>
                            )}
                            {registro.observacao && (
                              <p className="text-xs text-muted-foreground break-words">Obs: {registro.observacao}</p>
                            )}
                              </>
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
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProducaoObra;

