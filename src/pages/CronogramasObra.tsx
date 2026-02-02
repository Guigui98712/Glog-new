import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, addDays, addWeeks, startOfWeek, addMonths, startOfMonth } from 'date-fns';
import { listarCronogramasObra, criarCronograma as apiCriarCronograma, excluirCronograma as apiExcluirCronograma, buscarObra, listarEtapasFluxograma, atualizarCronogramaFull } from '@/lib/api';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import type { Cronograma, CronogramaStatus } from '@/types/cronograma';

const formatFriday = (d: Date) => {
  return format(d, "dd'/'MM", { locale: ptBR });
};

const getFriday = (d: Date) => {
  // date-fns getDay: 0 (Sun) - 6 (Sat) ; Fri = 5
  const day = d.getDay();
  const diff = 5 - day; // days to add to get to Friday
  return addDays(d, diff);
};

const CronogramasObra: React.FC = () => {
  const { id } = useParams();
  const obraId = Number(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState('Cronograma 1');
  const [etapaNova, setEtapaNova] = useState('');
  const [loading, setLoading] = useState(false);
  // synchronous in-flight guards to avoid duplicate requests on fast clicks
  const creatingRef = useRef(false);
  const savingRef = useRef(false);
  // track last created name to prevent accidental repeated creates
  const lastCreatedRef = useRef<{ name: string; ts: number } | null>(null);
  const [selectedDirty, setSelectedDirty] = useState(false);

  useEffect(() => {
    if (!obraId) return;
    carregarCronogramas();
  }, [obraId]);

  const tipoOf = (c: Cronograma) => {
    if (c.data.weeks) return 'weeks';
    if (c.data.months) return 'months';
    return 'weeks';
  };

  const dedupeByName = (arr: Cronograma[]) => {
    const map = new Map<string, Cronograma>();
    for (const c of arr) {
      const key = `${c.obra_id}-${tipoOf(c)}-${(c.nome || '').trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, c);
    }
    return Array.from(map.values());
  };

  const dedupeByIdThenName = (arr: Cronograma[]) => {
    // first dedupe strictly by id (keep first occurrence)
    const byId = new Map<string, Cronograma>();
    for (const c of arr) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    // then dedupe by name+tipo (keeping first occurrence among the id-unique items)
    return dedupeByName(Array.from(byId.values()));
  };

  const carregarCronogramas = async () => {
    setLoading(true);
    try {
      const data = await listarCronogramasObra(obraId);
      const arr = (data || []) as Cronograma[];
      console.debug('[UI] carregarCronogramas: got', arr.length, 'items', arr.map(a => ({ id: a.id, nome: a.nome })));
      const deduped = dedupeByIdThenName(arr);
      if (deduped.length !== arr.length) console.debug('[UI] carregarCronogramas: deduped', arr.length, '->', deduped.length, 'result ids', deduped.map(d => d.id));
      setCronogramas(deduped);
      if (deduped.length > 0) {
        setSelectedId(deduped[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar cronogramas:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar os cronogramas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const criarCronograma = async (tipo: 'weeks' | 'months' = 'weeks') => {
    if (!obraId) return;

    // block quick repeated attempts with same name
    if (lastCreatedRef.current && lastCreatedRef.current.name === (nomeNovo || '').trim() && (Date.now() - lastCreatedRef.current.ts) < 2000) {
      console.debug('[UI] criarCronograma: blocked duplicate name attempt', nomeNovo);
      toast({ title: 'Aguarde', description: 'Já há uma criação em andamento com este nome', variant: 'default' });
      return;
    }

    if (creatingRef.current) {
      console.log('[UI] criarCronograma: already creating, ignoring duplicate click');
      return;
    }
    creatingRef.current = true;
    setLoading(true);
    console.log('[UI] criarCronograma start', obraId, nomeNovo, tipo);

    // client-side early check: if a cronograma with same normalized name AND same tipo exists, navigate to it instead of creating
    const existingSameName = cronogramas.find(c => {
      const sameName = (c.nome || '').trim().toLowerCase() === (nomeNovo || '').trim().toLowerCase() && c.obra_id === obraId;
      const sameTipo = (tipo === 'weeks' && !!c.data.weeks) || (tipo === 'months' && !!c.data.months);
      return sameName && sameTipo;
    });
    if (existingSameName) {
      console.log('[UI] criarCronograma: blocked because same name+tipo exists locally', existingSameName.id);
      toast({ title: 'Já existe', description: 'Um cronograma com este nome e tipo já existe. Abrindo ele.', variant: 'default' });
      setSelectedId(existingSameName.id);
      navigate(`/obras/${obraId}/cronogramas/${existingSameName.id}`);
      creatingRef.current = false;
      setLoading(false);
      return;
    }

    try {
      // Start date = obra.data_inicio if available, otherwise today
      let start = new Date();
      try {
        const obraData = await buscarObra(obraId);
        if (obraData?.data_inicio) {
          start = new Date(obraData.data_inicio);
        }
      } catch (e) {
        console.warn('Não foi possível obter data de início da obra, usando hoje');
      }

      let cols: string[] = [];
      if (tipo === 'weeks') {
        const firstFriday = getFriday(start);
        cols = [0, 1, 2, 3].map(i => format(addWeeks(firstFriday, i), 'yyyy-MM-dd'));
      } else {
        const firstMonth = startOfMonth(start);
        cols = [0, 1, 2, 3].map(i => format(addMonths(firstMonth, i), 'yyyy-MM-dd'));
      }

      // Tentar carregar etapas do fluxograma da obra via API
      let etapasLista: string[] = [];
      try {
        etapasLista = await listarEtapasFluxograma(obraId);
      } catch (e) {
        console.warn('Não foi possível carregar etapas do fluxograma, continuando sem etapas');
      }

      const cells: Record<string, CronogramaStatus[]> = {};
      etapasLista.forEach(etapa => {
        cells[etapa] = new Array(cols.length).fill(0) as CronogramaStatus[];
      });

      const payload: any = tipo === 'weeks' ? { weeks: cols, etapas: etapasLista, cells } : { months: cols, etapas: etapasLista, cells };

      const data = await apiCriarCronograma(obraId, nomeNovo || (tipo === 'weeks' ? `Cronograma ${new Date().toLocaleString()}` : `Cronograma Mensal ${new Date().toLocaleString()}`), payload, tipo);
      console.log('[UI] criarCronograma: api returned', data?.id, data?.nome, 'tipo', tipo);
      // mark last created to avoid fast duplicates
      lastCreatedRef.current = { name: (nomeNovo || '').trim(), ts: Date.now() };
      // If server returned an existing cronograma (duplicate prevention), navigate to it and show toast
      const existingInList = cronogramas.find(c => c.id === data?.id);
      if (existingInList) {
        console.log('[UI] criarCronograma: server returned existing and it is in current list', data?.id);
        // refresh authoritative list and open the existing one
        await carregarCronogramas();
        toast({ title: 'Já existe', description: 'Um cronograma com este nome já existe. Abrindo ele.', variant: 'default' });
        setSelectedId(data.id);
        navigate(`/obras/${obraId}/cronogramas/${data.id}`);
      } else {
        // do not mutate local list with temporary insertions; reload authoritative list
        await carregarCronogramas();
        toast({ title: 'Criado', description: 'Cronograma criado com sucesso' });
        if (data) {
          setSelectedId(data.id);
          // Abrir editor do cronograma recém-criado
          navigate(`/obras/${obraId}/cronogramas/${data.id}`);
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Falha ao criar cronograma', variant: 'destructive' });
    } finally {
      creatingRef.current = false;
      setLoading(false);
      console.debug('[UI] criarCronograma end');
    }
  };

  const selected = useMemo(() => cronogramas.find(c => c.id === selectedId) || null, [cronogramas, selectedId]);

  const salvarCronograma = async (c: Cronograma) => {
    if (!c?.id) return;
    if (savingRef.current) {
      console.debug('[UI] salvarCronograma: already saving, ignoring duplicate');
      return;
    }
    savingRef.current = true;
    setLoading(true);
    console.debug('[UI] salvarCronograma start', c.id);
    try {
      await atualizarCronogramaFull(c.id, c.data, c.nome);
      await carregarCronogramas();
      setSelectedDirty(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Falha ao salvar cronograma', variant: 'destructive' });
    } finally {
      savingRef.current = false;
      setLoading(false);
      console.debug('[UI] salvarCronograma end', c.id);
    }
  };

  const addWeek = async () => {
    if (!selected) return;
    const isWeeks = !!selected.data.weeks;
    const cols = isWeeks ? [...(selected.data.weeks || [])] : [...(selected.data.months || [])];
    const last = new Date(cols[cols.length - 1]);
    const next = isWeeks ? addWeeks(last, 1) : addMonths(last, 1);
    cols.push(format(next, 'yyyy-MM-dd'));

    const newData = isWeeks ? { ...selected.data, weeks: cols } : { ...selected.data, months: cols };
    const newC = { ...selected, data: newData } as Cronograma;
    // do not auto-save: only mark dirty and update local UI
    setCronogramas(prev => prev.map(p => p.id === newC.id ? newC : p));
    setSelectedId(newC.id);
    setSelectedDirty(true);
  };

  const removeWeek = async (index: number) => {
    if (!selected) return;
    const isWeeks = !!selected.data.weeks;
    const cols = (selected.data.weeks ?? selected.data.months ?? []).filter((_, i) => i !== index);
    // also remove column from each etapa cells
    const cells: Record<string, CronogramaStatus[]> = {};
    Object.entries(selected.data.cells || {}).forEach(([etapa, arr]) => {
      const newArr = (arr as CronogramaStatus[]).filter((_, i) => i !== index);
      cells[etapa] = newArr;
    });

    const newData = isWeeks ? { ...selected.data, weeks: cols, cells } : { ...selected.data, months: cols, cells };
    const newC = { ...selected, data: newData } as Cronograma;
    setCronogramas(prev => prev.map(p => p.id === newC.id ? newC : p));
    setSelectedDirty(true);
  };

  const addEtapa = async () => {
    if (!selected || !etapaNova.trim()) return;
    const etapas = [...selected.data.etapas, etapaNova.trim()];
    const colsLen = (selected.data.weeks ?? selected.data.months ?? []).length;
    const cells = { ...selected.data.cells } as Record<string, number[]>;
    cells[etapaNova.trim()] = new Array(colsLen).fill(0);
    const newData = { ...selected.data, etapas, cells };
    const newC = { ...selected, data: newData } as Cronograma;
    setCronogramas(prev => prev.map(p => p.id === newC.id ? newC : p));
    setSelectedDirty(true);
    setEtapaNova('');
  };

  const toggleCell = async (etapa: string, weekIndex: number) => {
    if (!selected) return;
    const cells: Record<string, CronogramaStatus[]> = { ...(selected.data.cells || {}) } as Record<string, CronogramaStatus[]>;
    const colsLen = (selected.data.weeks ?? selected.data.months ?? []).length;
    if (!cells[etapa]) cells[etapa] = new Array(colsLen).fill(0) as CronogramaStatus[];
    const current = (cells[etapa][weekIndex] || 0) as number;
    const next = ((current + 1) % 4) as CronogramaStatus; // cycles 0..3
    cells[etapa][weekIndex] = next;
    const newData = { ...selected.data, cells };
    const newC = { ...selected, data: newData } as Cronograma;
    setCronogramas(prev => prev.map(p => p.id === newC.id ? newC : p));
    setSelectedDirty(true);
  };

  const excluirCronograma = async (cid: string) => {
    if (!cid) return;
    if (!confirm('Excluir este cronograma?')) return;
    console.debug('[UI] excluirCronograma called with id', cid);
    setLoading(true);
    try {
      console.debug('[UI] excluirCronograma: before server call, local ids=', cronogramas.map(c => c.id));
      const deleted = await apiExcluirCronograma(cid);
      console.debug('[UI] excluirCronograma: server deleted', deleted);
      toast({ title: 'Removido', description: 'Cronograma excluído' });
      // refresh and dedupe local list
      await carregarCronogramas();
      // if selected was deleted, clear it
      setSelectedId(prev => (prev === cid ? null : prev));
    } catch (err) {
      console.error('Erro ao excluir cronograma:', err);
      toast({ title: 'Erro', description: 'Falha ao excluir', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.debug('[UI] cronogramas state changed: count=', cronogramas.length, 'ids=', cronogramas.map(c => c.id));
  }, [cronogramas]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="!px-3">Voltar</Button>
          <h1 className="text-xl font-bold">Cronogramas</h1>
        </div>
        <div className="flex w-full md:w-auto items-start md:items-center gap-2">
          <Input className="w-full md:w-64" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do cronograma" />
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button className="w-full sm:w-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[UI] create button clicked: weeks'); criarCronograma('weeks'); }} disabled={loading}>{loading ? 'Criando...' : 'Criar Semanas'}</Button>
            <Button className="w-full sm:w-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[UI] create button clicked: months'); criarCronograma('months'); }} disabled={loading}>{loading ? 'Criando...' : 'Criar Mensal'}</Button>
          </div>
        </div>
      </div>

          {cronogramas.length === 0 ? (
        <div className="mt-6">
          <Card className="p-6">
            <p className="text-gray-700">Nenhum cronograma cadastrado para esta obra ainda. Use o campo de criação no topo para adicionar o primeiro cronograma.</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch md:auto-rows-fr">
          {cronogramas.filter(c => c.id !== selectedId).map(c => (
            <Card key={c.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer gap-3 h-full min-h-[92px]" onClick={() => setSelectedId(c.id)}>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium truncate">{c.nome}</h3>
                <p className="text-sm text-gray-500 truncate">Criado em: {c.created_at ? format(new Date(c.created_at), "dd'/'MM/yyyy HH:mm") : '—'}</p>
                <p className="text-sm text-gray-500 mt-1 truncate">{c.data.weeks ? `Semanas: ${c.data.weeks.length}` : c.data.months ? `Meses: ${c.data.months.length}` : `Colunas: ${ (c.data.weeks?.length || c.data.months?.length) || 0 }`} · Etapas: {c.data.etapas?.length || 0}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate(`/obras/${obraId}/cronogramas/${c.id}`); }}>Abrir editor</Button>
                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); e.preventDefault(); console.log('[UI] list delete button clicked', c.id); excluirCronograma(c.id); }} disabled={loading}>Excluir</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="p-4 h-full min-h-[92px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium truncate">{selected.nome}</h3>
              <p className="text-sm text-gray-500 truncate">Criado em: {selected.created_at ? format(new Date(selected.created_at), "dd'/'MM/yyyy HH:mm") : '—'}</p>
              <p className="text-sm text-gray-500 mt-1 truncate">{selected.data.weeks ? `Semanas: ${selected.data.weeks.length}` : selected.data.months ? `Meses: ${selected.data.months.length}` : `Colunas: ${ (selected.data.weeks?.length || selected.data.months?.length) || 0 }`} · Etapas: {selected.data.etapas?.length || 0}</p>
            </div>
            <div className="mt-3 md:mt-0 flex flex-col sm:flex-row gap-2">
              {selectedDirty && <Button size="sm" onClick={() => salvarCronograma(selected)} disabled={loading}>Salvar alterações</Button>}
              <Button size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/obras/${obraId}/cronogramas/${selected.id}`); }}>Abrir editor</Button>
              <Button size="sm" variant="destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[UI] selected panel delete clicked', selected.id); excluirCronograma(selected.id); }} disabled={loading}>Excluir</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CronogramasObra;
