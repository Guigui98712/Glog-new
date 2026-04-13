import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, addWeeks, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { buscarCronograma, atualizarCronogramaFull } from '@/lib/api';
import { MoreVertical, X } from 'lucide-react';
import type { Cronograma, CronogramaStatus } from '@/types/cronograma';

const STATUS_LABEL: Record<CronogramaStatus, string> = {
  0: 'Vazio',
  1: 'Previsto',
  2: 'Fazendo',
  3: 'Efetuado',
};

const STATUS_BG: Record<CronogramaStatus, string> = {
  0: 'bg-white',
  1: 'bg-blue-200',
  2: 'bg-yellow-200',
  3: 'bg-green-200',
};

const CronogramaEditor: React.FC = () => {
  const { id, cronogramaId } = useParams();
  const obraId = Number(id);
  const cid = cronogramaId as string;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cronograma, setCronograma] = useState<Cronograma | null>(null);
  const [loading, setLoading] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [etapaNova, setEtapaNova] = useState('');
  const [editingEtapas, setEditingEtapas] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!cid) return;
    carregar();
  }, [cid]);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await buscarCronograma(cid);
      setCronograma(data);
      setNovoNome(data?.nome || '');
    } catch (err) {
      console.error('Erro ao carregar cronograma:', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar o cronograma', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleCell = (etapa: string, weekIndex: number) => {
    if (!cronograma) return;
    const cols = cronograma.data.weeks ?? cronograma.data.months ?? [];
    const cells = { ...(cronograma.data.cells || {}) } as Record<string, CronogramaStatus[]>;
    if (!cells[etapa]) cells[etapa] = new Array(cols.length).fill(0) as CronogramaStatus[];
    const current = (cells[etapa][weekIndex] || 0) as number;
    const next = ((current + 1) % 4) as CronogramaStatus;
    cells[etapa][weekIndex] = next;
    setCronograma({ ...cronograma, data: { ...cronograma.data, cells } });
  };

  const salvar = async () => {
    if (!cronograma) return;
    if (savingRef.current) {
      console.debug('[UI] CronogramaEditor salvar: already saving, ignoring duplicate');
      return;
    }
    savingRef.current = true;
    setLoading(true);
    console.debug('[UI] CronogramaEditor salvar start', cronograma.id);
    try {
      // Use the full update so we update both data and nome in one API call
      await atualizarCronogramaFull(cronograma.id, cronograma.data, novoNome);
      toast({ title: 'Salvo', description: 'Cronograma atualizado' });
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast({ title: 'Erro', description: 'Falha ao salvar cronograma', variant: 'destructive' });
    } finally {
      savingRef.current = false;
      setLoading(false);
      console.debug('[UI] CronogramaEditor salvar end', cronograma.id);
    }
  };

  const addWeek = () => {
    if (!cronograma) return;
    const isWeeks = !!cronograma.data.weeks;
    const cols = isWeeks ? [...(cronograma.data.weeks || [])] : [...(cronograma.data.months || [])];
    const last = new Date(cols[cols.length - 1]);
    const next = isWeeks ? addWeeks(last, 1) : addMonths(last, 1);
    cols.push(format(next, 'yyyy-MM-dd'));
    const newIndex = cols.length - 1;

    const cells = { ...(cronograma.data.cells || {}) } as Record<string, CronogramaStatus[]>;
    Object.keys(cells).forEach(etapa => {
      cells[etapa] = [...cells[etapa], 0 as CronogramaStatus];
    });

    if (isWeeks) {
      setCronograma(prev => ({ ...(prev as Cronograma), data: { ...(prev as Cronograma).data, weeks: cols, cells } }));
    } else {
      setCronograma(prev => ({ ...(prev as Cronograma), data: { ...(prev as Cronograma).data, months: cols, cells } }));
    }

    // destacar e rolar para a nova coluna
    setHighlightIndex(newIndex);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
        // limpar destaque após 1.5s
        setTimeout(() => setHighlightIndex(null), 1500);
      }, 50);
    });
  };

  const removeWeek = (index: number) => {
    if (!cronograma) return;
    const isWeeks = !!cronograma.data.weeks;
    const cols = (cronograma.data.weeks ?? cronograma.data.months ?? []).filter((_, i) => i !== index);
    const cells: Record<string, CronogramaStatus[]> = {};
    Object.entries(cronograma.data.cells || {}).forEach(([etapa, arr]) => {
      cells[etapa] = (arr as CronogramaStatus[]).filter((_, i) => i !== index);
    });
    if (isWeeks) setCronograma({ ...cronograma, data: { ...cronograma.data, weeks: cols, cells } });
    else setCronograma({ ...cronograma, data: { ...cronograma.data, months: cols, cells } });
  };

  const addEtapa = () => {
    if (!cronograma || !etapaNova.trim()) return;
    const etapa = etapaNova.trim();
    const etapas = [...cronograma.data.etapas, etapa];
    const colsLen = (cronograma.data.weeks ?? cronograma.data.months ?? []).length;
    const cells = { ...(cronograma.data.cells || {}) } as Record<string, CronogramaStatus[]>;
    cells[etapa] = new Array(colsLen).fill(0) as CronogramaStatus[];
    setEtapaNova('');
    setCronograma({ ...cronograma, data: { ...cronograma.data, etapas, cells } });
  };

  const removeEtapa = (etapaToRemove: string) => {
    if (!cronograma) return;
    if (!confirm(`Remover etapa "${etapaToRemove}"?`)) return;
    const etapas = cronograma.data.etapas.filter(e => e !== etapaToRemove);
    const cells: Record<string, CronogramaStatus[]> = {};
    Object.entries(cronograma.data.cells || {}).forEach(([etapa, arr]) => {
      if (etapa !== etapaToRemove) cells[etapa] = arr as CronogramaStatus[];
    });
    setCronograma({ ...cronograma, data: { ...cronograma.data, etapas, cells } });
  };

  const cols = cronograma.data.weeks ?? cronograma.data.months ?? [];

  if (!cronograma) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="p-6">Carregando cronograma...</Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold break-words">Editor: {cronograma.nome}</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 w-full sm:w-auto">
          <Button onClick={() => navigate(-1)} className="w-full sm:w-auto">Voltar</Button>
          <Button onClick={salvar} disabled={loading} className="w-full sm:w-auto">Salvar</Button>
        </div>
      </div>

      <Card className="p-4 relative">
        <div className="mb-3">
          <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome do cronograma" />
        </div>

        <div className="md:hidden space-y-4">
          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
            <p className="text-sm font-medium">Edição no celular</p>
            <p className="text-xs text-slate-600 mt-1">Toque nas células para alternar: Vazio, Previsto, Fazendo e Efetuado.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([0, 1, 2, 3] as CronogramaStatus[]).map((status) => (
                <span key={status} className={`text-xs px-2 py-1 rounded border border-slate-200 ${STATUS_BG[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={addWeek} size="sm">{cronograma.data.weeks ? '+ Semana' : '+ Mês'}</Button>
            <Button variant="outline" size="sm" onClick={() => setEditingEtapas(prev => !prev)}>
              {editingEtapas ? 'Concluir edição de etapas' : 'Editar etapas'}
            </Button>
          </div>

          {editingEtapas && (
            <div className="flex items-center gap-2">
              <Input placeholder="Nova etapa" value={etapaNova} onChange={(e) => setEtapaNova(e.target.value)} />
              <Button onClick={addEtapa}>Adicionar</Button>
            </div>
          )}

          <div className="space-y-3">
            {cronograma.data.etapas.map((etapa) => (
              <div key={etapa} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-medium text-sm leading-tight break-words">{etapa}</p>
                  {editingEtapas && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeEtapa(etapa);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="flex gap-2 pb-1 min-w-max">
                    {cols.map((w, i) => {
                      const status = cronograma.data.cells?.[etapa]?.[i] || 0;
                      const typedStatus = status as CronogramaStatus;
                      const highlight = i === highlightIndex ? 'ring-2 ring-blue-400 animate-pulse' : '';
                      return (
                        <button
                          key={`${etapa}-${i}`}
                          onClick={() => toggleCell(etapa, i)}
                          className={`w-28 h-24 rounded-md border border-slate-200 px-2 py-2 text-left flex-shrink-0 ${STATUS_BG[typedStatus]} ${highlight}`}
                        >
                          <div className="text-[11px] text-slate-600">
                            {cronograma.data.weeks
                              ? format(new Date(w), "dd'/'MM", { locale: ptBR })
                              : format(new Date(w), "MM/yyyy", { locale: ptBR })}
                          </div>
                          <div className="mt-2 text-sm font-medium leading-tight">{STATUS_LABEL[typedStatus]}</div>
                        </button>
                      );
                    })}

                    {cols.length > 0 && (
                      <button
                        onClick={() => removeWeek(cols.length - 1)}
                        className="w-24 h-24 rounded-md border border-red-200 text-red-600 text-xs px-2 py-2 flex-shrink-0"
                        title="Remove a última coluna"
                      >
                        Remover última
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={containerRef} className="hidden md:block overflow-auto -mx-4 px-4">
          <table className="min-w-[720px] md:min-w-[1000px] border-collapse w-full">
            <thead>
              <tr>
                <th className="sticky left-0 z-30 bg-white min-w-[220px] text-left px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Etapas</span>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingEtapas(prev => !prev); }}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </th>
                {cols.map((w, i) => (
                  <th key={w} className="px-2 py-3 text-center border-l border-slate-200 min-w-[80px] sticky top-0 bg-white z-20">
                    <div className="flex items-center justify-center gap-2">
                      {cronograma.data.weeks ? (
                        <>
                          <span className="hidden sm:inline font-medium">{format(new Date(w), "dd'/'MM")}</span>
                          <span className="inline sm:hidden block text-xs transform -rotate-90 origin-left" title={format(new Date(w), "dd'/'MM/yyyy")}>{format(new Date(w), "dd'/'MM")}</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline font-medium">{format(new Date(w), "MMM/yyyy", { locale: ptBR })}</span>
                          <span className="inline sm:hidden block text-xs" title={format(new Date(w), "MMM/yyyy", { locale: ptBR })}>{format(new Date(w), "MM/yyyy")}</span>
                        </>
                      )}
                      <button title="Remover semana" className="text-red-500 text-xs ml-2" onClick={() => removeWeek(i)}>Excluir</button>
                    </div>
                  </th>
                ))}
                <th className="min-w-[90px] text-center sticky top-0 bg-white z-20 px-2 py-2">
                  <Button onClick={addWeek} size="sm">{cronograma.data.weeks ? '+ Semana' : '+ Mês'}</Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {cronograma.data.etapas.map(etapa => (
                <tr key={etapa} className="align-top hover:bg-gray-50">
                  <td className="sticky left-0 z-20 bg-white p-4 align-top border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">{etapa}</div>
                      {editingEtapas && (
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeEtapa(etapa); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                  {cols.map((w, i) => {
                    const status = cronograma.data.cells?.[etapa]?.[i] || 0;
                    const classes = status === 1 ? 'bg-blue-200' : status === 2 ? 'bg-yellow-200' : status === 3 ? 'bg-green-200' : '';
                    const highlight = i === highlightIndex ? 'ring-2 ring-blue-400 animate-pulse' : '';
                    return (
                      <td key={`${etapa}-${i}`} className={`min-w-[80px] p-4 text-center border-t border-l border-slate-100 cursor-pointer ${classes} ${highlight}`} onClick={() => toggleCell(etapa, i)}>
                        <div className="text-sm">
                          {status === 0 ? '' : status === 1 ? 'Previsto' : status === 2 ? 'Fazendo' : 'Efetuado'}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-4 border-t border-slate-100"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingEtapas && (
          <div className="hidden md:flex mt-4 items-center gap-2">
            <Input placeholder="Nova etapa" value={etapaNova} onChange={(e) => setEtapaNova(e.target.value)} />
            <Button onClick={addEtapa}>Adicionar etapa</Button>
          </div>
        )}



      </Card>
    </div>
  );
};

export default CronogramaEditor;
