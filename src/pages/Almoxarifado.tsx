import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import CadastroItemDialog from '@/components/CadastroItemDialog';
import { listarItens, searchItems, getItemById, registerMovement, getAlmoxarifadoHistorico, getAlmoxarifadoHistoricoAnos, criarCodigoAlmoxarife, listarDispositivosAlmoxarife, revogarDispositivoAlmoxarife, excluirItemAlmox } from '@/lib/api';
import { Copy, MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const getAlmoxarifeNome = (observacao?: string | null) => {
  const obs = String(observacao || '');
  const match = obs.match(/almoxarife:([^;|]+)/i);
  const nome = String(match?.[1] || '').trim();
  return nome || '-';
};

const Almoxarifado: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const obraId = Number(id);
  const { toast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  // Entrada/Saida form
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'entrada'|'saida'|'devolucao'|'devolucao_empresa'>('entrada');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementItem, setMovementItem] = useState<any>(null);
  const [movementQtd, setMovementQtd] = useState<number>(1);
  const [movementQuery, setMovementQuery] = useState('');
  const [movementSuggestions, setMovementSuggestions] = useState<any[]>([]);
  const [movementNumeroPedido, setMovementNumeroPedido] = useState('');
  const [movementEmpresaNome, setMovementEmpresaNome] = useState('');
  const [movementAlmoxarifeNome, setMovementAlmoxarifeNome] = useState('');
  const [movementRetiradoPor, setMovementRetiradoPor] = useState('');

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyYears, setHistoryYears] = useState<number[]>([]);

  // Items editor modal
  const [showItemsEditor, setShowItemsEditor] = useState(false);
  const [itemsEditorQuery, setItemsEditorQuery] = useState('');

  // Almoxarife access codes
  const [accessCodesLoading, setAccessCodesLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string>('');
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const buildAlmoxPublicUrl = () => {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const configuredUrl = import.meta.env.VITE_ALMOX_PUBLIC_URL?.trim();

    try {
      const url = new URL(configuredUrl || '/almox.html', baseOrigin || undefined);
      if (!configuredUrl && (!url.pathname || url.pathname === '/')) {
        url.pathname = '/almox.html';
      }
      url.searchParams.set('obraId', String(obraId));
      return url.toString();
    } catch {
      return `${baseOrigin}/almox.html?obraId=${obraId}`;
    }
  };

  const almoxPublicUrl = buildAlmoxPublicUrl();

  // Search detail modal
  const [showSearchDetail, setShowSearchDetail] = useState(false);
  const [selectedSearchItem, setSelectedSearchItem] = useState<any>(null);

  useEffect(() => { carregar(); }, [obraId]);
  useEffect(() => { carregarDispositivos(); }, [obraId]);

  const carregar = async () => {
    if (!obraId) return;
    setLoading(true);
    try {
      const data = await listarItens(obraId);
      setItems(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível carregar itens', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const carregarDispositivos = async () => {
    if (!obraId) return;
    setDevicesLoading(true);
    try {
      const data = await listarDispositivosAlmoxarife(obraId);
      setDevices(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível carregar dispositivos', variant: 'destructive' });
    } finally {
      setDevicesLoading(false);
    }
  };

  // autocomplete para modal de movimento
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!movementQuery || movementQuery.trim().length < 1) { setMovementSuggestions([]); return; }
      try {
        const res = await searchItems(obraId, movementQuery.trim());
        if (mounted) setMovementSuggestions(res || []);
      } catch (e) {
        console.error(e);
      }
    };
    run();
    return () => { mounted = false; };
  }, [movementQuery, obraId]);

  const abrirMovimento = (type: 'entrada'|'saida'|'devolucao'|'devolucao_empresa') => {
    setMovementType(type);
    setMovementItemId('');
    setMovementItem(null);
    setMovementQtd(1);
    setMovementQuery('');
    setMovementSuggestions([]);
    setMovementNumeroPedido('');
    setMovementEmpresaNome('');
    setMovementAlmoxarifeNome('');
    setMovementRetiradoPor('');
    setMovementOpen(true);
  };

  const onPickMovementSuggestion = (it: any) => {
    setMovementItemId(String(it.id));
    setMovementItem(it);
    setMovementQuery(it.nome);
    setMovementSuggestions([]);
  };

  const onItemIdChange = async (val: string) => {
    setMovementItemId(val);
    const trimmedValue = val.trim();
    if (!trimmedValue) {
      setMovementItem(null);
      return;
    }

    const localMatch = items.find((it) => String(it.id) === trimmedValue);
    if (localMatch) {
      setMovementItem(localMatch);
      if (!movementQuery) {
        setMovementQuery(localMatch.nome || '');
      }
      return;
    }

    const idNum = Number(trimmedValue);
    if (!Number.isNaN(idNum)) {
      try {
        const it = await getItemById(obraId, idNum);
        setMovementItem(it || null);
        if (it && !movementQuery) {
          setMovementQuery(it.nome || '');
        }
      } catch (e) {
        console.error(e);
        setMovementItem(null);
      }
      return;
    }

    setMovementItem(null);
  };

  const submitMovement = async () => {
    if (!movementItemId || !movementQtd || !obraId) return toast({ title: 'Erro', description: 'Informe item e quantidade', variant: 'destructive' });

    if (movementQtd <= 0) {
      return toast({ title: 'Erro', description: 'Informe uma quantidade maior que zero', variant: 'destructive' });
    }

    if ((movementType === 'saida' || movementType === 'devolucao_empresa') && movementItem && movementQtd > Number(movementItem.quantidade || 0)) {
      return toast({
        title: 'Erro',
        description: 'Quantidade insuficiente em estoque',
        variant: 'destructive'
      });
    }

    if (movementType === 'entrada' && (!movementNumeroPedido.trim() || !movementEmpresaNome.trim())) {
      return toast({
        title: 'Erro',
        description: 'Informe número do pedido e nome da empresa para registrar entrada',
        variant: 'destructive'
      });
    }

    if (movementType === 'saida' && !movementRetiradoPor.trim()) {
      return toast({
        title: 'Erro',
        description: 'Informe o nome de quem retirou o item para registrar saída',
        variant: 'destructive'
      });
    }

    if (movementType === 'saida' && !movementAlmoxarifeNome.trim()) {
      return toast({
        title: 'Erro',
        description: 'Informe o nome do almoxarife responsável pela saída',
        variant: 'destructive'
      });
    }

    if (movementType === 'devolucao_empresa' && !movementEmpresaNome.trim()) {
      return toast({
        title: 'Erro',
        description: 'Informe o nome da empresa para registrar devolução',
        variant: 'destructive'
      });
    }

    if (movementType === 'devolucao_empresa' && !movementAlmoxarifeNome.trim()) {
      return toast({
        title: 'Erro',
        description: 'Informe o nome do almoxarife responsável pela devolução',
        variant: 'destructive'
      });
    }

    setLoading(true);
    try {
      const resolvedItemId = Number(movementItem?.id ?? movementItemId.trim());
      if (!Number.isFinite(resolvedItemId)) {
        throw new Error('Selecione um item válido');
      }

      const resolvedItem = movementItem
        ?? items.find((it) => Number(it.id) === resolvedItemId)
        ?? await getItemById(obraId, resolvedItemId);
      if (!resolvedItem) {
        throw new Error('Item não encontrado para esta obra');
      }

      const movementApiType =
        movementType === 'devolucao'
          ? 'entrada'
          : movementType === 'devolucao_empresa'
            ? 'saida'
            : movementType;

      await registerMovement(obraId, resolvedItemId, movementApiType, movementQtd, {
        numero_pedido: movementType === 'entrada' || movementType === 'devolucao_empresa' ? movementNumeroPedido : null,
        empresa_nome: movementType === 'entrada' || movementType === 'devolucao_empresa' ? movementEmpresaNome : null,
        retirado_por: movementType === 'saida' || movementType === 'devolucao_empresa' ? movementRetiradoPor : null,
        observacao:
          movementType === 'devolucao'
            ? 'devolucao'
            : movementType === 'saida'
              ? `almoxarife:${movementAlmoxarifeNome.trim()}`
              : `devolucao_empresa;almoxarife:${movementAlmoxarifeNome.trim()}`
              : null,
      });
      setMovementItemId(String(resolvedItemId));
      setMovementItem(resolvedItem);
      toast({ title: 'Registrado', description: 'Movimento registrado com sucesso' });
      setMovementOpen(false);
      await carregar();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro',
        description: e instanceof Error ? e.message : 'Falha ao registrar movimento',
        variant: 'destructive'
      });
    } finally { setLoading(false); }
  };

  const gerarCodigoAcesso = async () => {
    if (!obraId) return;
    setAccessCodesLoading(true);
    try {
      const data = await criarCodigoAlmoxarife(obraId, 30);
      if (data?.code) {
        setGeneratedCode(data.code);
        setGeneratedExpiresAt(data.expires_at);
        setShowCodeModal(true);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao gerar código', variant: 'destructive' });
    } finally {
      setAccessCodesLoading(false);
    }
  };

  const revogarDispositivo = async (id: number) => {
    setDevicesLoading(true);
    try {
      await revogarDispositivoAlmoxarife(id);
      await carregarDispositivos();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao revogar dispositivo', variant: 'destructive' });
    } finally {
      setDevicesLoading(false);
    }
  };

  const abrirHistorico = async () => {
    const currentYear = new Date().getFullYear();
    setShowHistory(true);
    setHistoryQuery('');
    setHistoryYear(currentYear);
    setHistoryLoading(true);
    try {
      const anos = await getAlmoxarifadoHistoricoAnos(obraId);
      setHistoryYears(anos || []);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar histórico', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!showHistory || !obraId) return;

    let mounted = true;
    const load = async () => {
      setHistoryLoading(true);
      try {
        const data = await getAlmoxarifadoHistorico(obraId, historyYear);
        if (mounted) setHistory(data || []);
      } catch (e) {
        console.error('Erro ao carregar histórico:', e);
        if (mounted) {
          toast({ title: 'Erro', description: 'Não foi possível carregar histórico', variant: 'destructive' });
        }
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [showHistory, obraId, historyYear, toast]);

  const itemsFiltrados = useMemo(() => {
    return [...items].sort((a, b) => {
      const catA = (a.categoria || 'Sem categoria').toLowerCase();
      const catB = (b.categoria || 'Sem categoria').toLowerCase();
      if (catA !== catB) {
        return catA.localeCompare(catB);
      }
      return (a.nome || '').localeCompare(b.nome || '');
    });
  }, [items]);

  const itemsFiltradosEditor = useMemo(() => {
    if (!itemsEditorQuery || !itemsEditorQuery.trim()) return items;
    const q = itemsEditorQuery.trim().toLowerCase();
    return items.filter((it) => {
      const nome = String(it.nome || '').toLowerCase();
      const categoria = String(it.categoria || '').toLowerCase();
      return nome.includes(q) || categoria.includes(q);
    });
  }, [items, itemsEditorQuery]);

  const movementIdSuggestions = useMemo(() => {
    const term = movementItemId.trim().toLowerCase();
    if (!term) return [];

    return items
      .filter((it) => {
        const idText = String(it.id ?? '').toLowerCase();
        const nome = String(it.nome || '').toLowerCase();
        const categoria = String(it.categoria || '').toLowerCase();
        return idText.includes(term) || nome.includes(term) || categoria.includes(term);
      })
      .slice(0, 10);
  }, [items, movementItemId]);

  const dispositivosAtivos = useMemo(() => {
    return devices.filter((device) => device.active);
  }, [devices]);

  const historyFiltrado = useMemo(() => {
    if (!historyQuery || !historyQuery.trim()) return history;
    const q = historyQuery.trim().toLowerCase();

    return history.filter((mov) => {
      const itemId = String(mov.item_id ?? mov.id_item ?? mov.itemId ?? '').toLowerCase();
      const itemNome = String(mov.item_nome || '').toLowerCase();
      const empresaNome = String(mov.empresa_nome || '').toLowerCase();

      return (
        itemId.includes(q) ||
        itemNome.includes(q) ||
        empresaNome.includes(q)
      );
    });
  }, [history, historyQuery]);

  const excluirItem = async (itemId: number) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      await excluirItemAlmox(itemId);
      toast({ title: 'Sucesso', description: 'Item excluído com sucesso' });
      await carregar();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao excluir item', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/obras/${id}`)}
            title="Voltar para detalhes da obra"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Almoxarifado</h1>
          <Button
            variant="outline"
            className="h-8"
            onClick={() => navigate(`/obras/${id}/almoxarifado/ferramentas`)}
          >
            Ferramentas
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={abrirHistorico} className="text-sm">Histórico</Button>
          <Button variant="outline" onClick={() => setShowItemsEditor(true)} className="text-sm">Itens</Button>
          <Button onClick={() => setShowCadastro(true)} className="text-sm">Cadastrar</Button>
        </div>
      </div>

      <div className="w-full flex justify-end">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={() => abrirMovimento('devolucao')}
            variant="ghost"
            className="h-8 w-8 rounded-md border border-black bg-white p-0 text-lg font-semibold !text-black hover:bg-gray-100 hover:!text-black"
            aria-label="Retornar ao estoque"
            title="Retornar ao estoque"
          >
            ↩
          </Button>
          <Button
            onClick={() => abrirMovimento('devolucao_empresa')}
            variant="ghost"
            className="h-8 w-8 rounded-md border border-black bg-white p-0 text-lg font-semibold !text-black hover:bg-gray-100 hover:!text-black"
            aria-label="Devolver para empresa"
            title="Devolver para empresa"
          >
            ↪
          </Button>
          <Button onClick={() => abrirMovimento('saida')} className="bg-yellow-500 hover:bg-yellow-600 text-white sm:w-40">Saída</Button>
          <Button onClick={() => abrirMovimento('entrada')} className="bg-green-500 hover:bg-green-600 text-white sm:w-40">Entrada</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
          <div className="w-full sm:w-auto">
            <h2 className="font-semibold">Acesso do Almoxarife</h2>
            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
              <a
                href={almoxPublicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {almoxPublicUrl}
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(almoxPublicUrl);
                    toast({ title: 'Copiado', description: 'Link copiado para a área de transferência' });
                  } catch (e) {
                    console.error(e);
                    toast({ title: 'Erro', description: 'Não foi possível copiar o link', variant: 'destructive' });
                  }
                }}
                className="h-8 w-8 p-0 flex-shrink-0"
                aria-label="Copiar link do almoxarife"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button onClick={gerarCodigoAcesso} disabled={accessCodesLoading} className="w-full sm:w-auto">Gerar código</Button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-2">Dispositivos autorizados</h3>
          {devicesLoading ? (
            <div className="text-sm text-gray-500">Carregando dispositivos...</div>
          ) : dispositivosAtivos.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhum dispositivo cadastrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispositivosAtivos.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.device_name}</TableCell>
                    <TableCell>{new Date(d.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{d.last_seen ? new Date(d.last_seen).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell className={d.active ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                      {d.active ? 'Ativo' : 'Revogado'}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => revogarDispositivo(d.id)} disabled={!d.active}>Revogar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Lista de materiais</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px]">ID</TableHead>
                <TableHead className="min-w-[150px]">Item</TableHead>
                <TableHead className="min-w-[60px]">QTD</TableHead>
                <TableHead className="min-w-[80px]">Unidade</TableHead>
                <TableHead className="min-w-[100px]">Categoria</TableHead>
                <TableHead className="min-w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.map(it => (
                <TableRow key={it.id}>
                  <TableCell>{it.id}</TableCell>
                  <TableCell>{it.nome}</TableCell>
                  <TableCell>{it.quantidade}</TableCell>
                  <TableCell>{it.unidade}</TableCell>
                  <TableCell>{it.categoria}</TableCell>
                  <TableCell className={Number(it.quantidade ?? 0) > 0 ? 'text-green-600' : 'text-amber-600'}>
                    {Number(it.quantidade ?? 0) > 0 ? 'Em estoque' : 'Sem estoque'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CadastroItemDialog open={showCadastro} onOpenChange={setShowCadastro} onCreated={() => { setShowCadastro(false); carregar(); }} obraId={obraId} />

      {/* Search Detail Modal */}
      <Dialog open={showSearchDetail} onOpenChange={setShowSearchDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSearchItem?.nome}</DialogTitle>
          </DialogHeader>
          {selectedSearchItem && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">ID</label>
                <p className="text-lg font-semibold">{selectedSearchItem.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Quantidade</label>
                <p className="text-lg font-semibold">{selectedSearchItem.quantidade}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Unidade</label>
                <p className="text-lg font-semibold">{selectedSearchItem.unidade}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Categoria</label>
                <p className="text-lg font-semibold">{selectedSearchItem.categoria}</p>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setShowSearchDetail(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Código de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Código</label>
              <p className="text-2xl font-mono font-semibold tracking-widest">{generatedCode}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Expira em</label>
              <p className="text-sm">{generatedExpiresAt ? new Date(generatedExpiresAt).toLocaleString('pt-BR') : '-'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setShowCodeModal(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <DialogTitle className="text-base sm:text-lg">Histórico de Movimentações</DialogTitle>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {historyYears.length > 0 && (
              <div className="flex justify-end mb-3">
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {historyYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            {historyLoading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="ml-2 text-sm text-gray-600">Carregando...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhuma movimentação registrada.</div>
            ) : (
              <>
                <div className="mb-4">
                  <Input
                    placeholder="Pesquisar histórico por ID, item ou empresa..."
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                {historyFiltrado.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum resultado encontrado para a pesquisa.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Almoxarife</TableHead>
                          <TableHead>Retirado por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyFiltrado.map((mov, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{new Date(mov.data).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              {mov.item_nome}
                              {mov.item_excluido ? ' (item excluído)' : ''}
                            </TableCell>
                            <TableCell className={mov.observacao === 'item_excluido' ? 'text-red-600 font-semibold' : (mov.observacao === 'entrada_inicial' ? 'text-cyan-700 font-semibold' : (String(mov.observacao || '').includes('devolucao_empresa') ? 'text-orange-600 font-semibold' : (mov.observacao === 'devolucao' ? 'text-blue-600 font-semibold' : (mov.tipo === 'entrada' ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'))))}>
                              {mov.observacao === 'item_excluido' ? 'Excluído' : (mov.observacao === 'entrada_inicial' ? 'Cadastro' : (String(mov.observacao || '').includes('devolucao_empresa') ? '↪ Devolução Empresa' : (mov.observacao === 'devolucao' ? '↩ Devolução' : (mov.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'))))}
                            </TableCell>
                            <TableCell>{mov.quantidade}</TableCell>
                            <TableCell>{mov.numero_pedido || '-'}</TableCell>
                            <TableCell>{mov.empresa_nome || '-'}</TableCell>
                            <TableCell>{getAlmoxarifeNome(mov.observacao)}</TableCell>
                            <TableCell>{mov.retirado_por || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end border-t px-4 py-3">
            <Button variant="outline" onClick={() => setShowHistory(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items Editor Modal */}
      <Dialog open={showItemsEditor} onOpenChange={setShowItemsEditor}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editor de Itens</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <Input 
              placeholder="Pesquisar itens..." 
              value={itemsEditorQuery} 
              onChange={(e) => setItemsEditorQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>QTD</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsFiltradosEditor.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.id}</TableCell>
                    <TableCell>{it.nome}</TableCell>
                    <TableCell>{it.quantidade}</TableCell>
                    <TableCell>{it.unidade}</TableCell>
                    <TableCell>{it.categoria}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => excluirItem(it.id)} className="text-red-600 cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {movementType === 'entrada'
                ? 'Registrar entrada'
                : movementType === 'saida'
                  ? 'Registrar saída'
                  : movementType === 'devolucao_empresa'
                    ? 'Registrar devolução para empresa'
                    : 'Registrar retorno ao estoque'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">ID ou Nome do item</label>
              <Input value={movementItemId} onChange={(e) => onItemIdChange(e.target.value)} placeholder="Digite o ID" className="mb-2" />
              {movementIdSuggestions.length > 0 && (
                <div className="mt-2 mb-2 bg-white border rounded-md shadow-sm max-w-md">
                  {movementIdSuggestions.map((suggestion) => (
                    <div
                      key={`id-${suggestion.id}`}
                      className="p-2 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onPickMovementSuggestion(suggestion)}
                    >
                      {suggestion.id} - {suggestion.nome}
                    </div>
                  ))}
                </div>
              )}
              <Input value={movementQuery} onChange={(e) => setMovementQuery(e.target.value)} placeholder="Ou comece a digitar o nome..." />
              {movementSuggestions.length > 0 && (
                <div className="mt-2 bg-white border rounded-md shadow-sm max-w-md">
                  {movementSuggestions.map(s => (
                    <div key={s.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => onPickMovementSuggestion(s)}>{s.nome}</div>
                  ))}
                </div>
              )}
              {movementItem && <div className="mt-2 text-sm text-gray-600">Encontrado: {movementItem.nome} — Qtd atual: {movementItem.quantidade}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <Input type="number" value={movementQtd.toString()} onChange={(e) => setMovementQtd(Number(e.target.value || 0))} />
            </div>

            {(movementType === 'entrada' || movementType === 'devolucao_empresa') && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Número do pedido</label>
                  <Input
                    value={movementNumeroPedido}
                    onChange={(e) => setMovementNumeroPedido(e.target.value)}
                    placeholder="Ex.: PED-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da empresa</label>
                  <Input
                    value={movementEmpresaNome}
                    onChange={(e) => setMovementEmpresaNome(e.target.value)}
                    placeholder="Ex.: Fornecedora ABC"
                  />
                </div>
              </>
            )}

            {(movementType === 'saida' || movementType === 'devolucao_empresa') && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do almoxarife</label>
                  <Input
                    value={movementAlmoxarifeNome}
                    onChange={(e) => setMovementAlmoxarifeNome(e.target.value)}
                    placeholder="Ex.: Carlos Souza"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{movementType === 'devolucao_empresa' ? 'Nome de quem levou para devolução' : 'Nome de quem retirou'}</label>
                  <Input
                    value={movementRetiradoPor}
                    onChange={(e) => setMovementRetiradoPor(e.target.value)}
                    placeholder={movementType === 'devolucao_empresa' ? 'Ex.: Motorista da empresa' : 'Ex.: João Silva'}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMovementOpen(false)}>Cancelar</Button>
              <Button onClick={submitMovement}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Almoxarifado;
