import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import CadastroItemDialog from '@/components/CadastroItemDialog';
import { listarItens, searchItems, getItemById, registerMovement, getAlmoxarifadoHistorico, criarCodigoAlmoxarife, listarDispositivosAlmoxarife, revogarDispositivoAlmoxarife } from '@/lib/api';
import { Copy, MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Almoxarifado: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const obraId = Number(id);
  const { toast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  // search/autocomplete
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Entrada/Saida form
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'entrada'|'saida'>('entrada');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementItem, setMovementItem] = useState<any>(null);
  const [movementQtd, setMovementQtd] = useState<number>(1);
  const [movementQuery, setMovementQuery] = useState('');
  const [movementSuggestions, setMovementSuggestions] = useState<any[]>([]);

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const accessBaseUrl = import.meta.env.VITE_ALMOX_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const accessUrl = `${accessBaseUrl}/almoxarifado/acesso`;
  const almoxPublicUrl = 'https://almoxarifadoglog.netlify.app/almox.html';

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

  // autocomplete para pesquisa principal
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!query || query.trim().length < 1) { setSuggestions([]); return; }
      try {
        const res = await searchItems(obraId, query.trim());
        if (mounted) setSuggestions(res || []);
      } catch (e) {
        console.error(e);
      }
    };
    run();
    return () => { mounted = false; };
  }, [query, obraId]);

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

  const abrirMovimento = (type: 'entrada'|'saida') => {
    setMovementType(type);
    setMovementItemId('');
    setMovementItem(null);
    setMovementQtd(1);
    setMovementQuery('');
    setMovementSuggestions([]);
    setMovementOpen(true);
  };

  const onPickSuggestion = (it: any) => {
    setMovementItemId(String(it.id));
    setMovementItem(it);
    setSuggestions([]);
    setQuery('');
    setMovementQuery('');
    setMovementSuggestions([]);
  };

  const onPickMovementSuggestion = (it: any) => {
    setMovementItemId(String(it.id));
    setMovementItem(it);
    setMovementQuery(it.nome);
    setMovementSuggestions([]);
  };

  const onItemIdChange = async (val: string) => {
    setMovementItemId(val);
    if (!val) { setMovementItem(null); return; }
    // try fetch by id
    const idNum = Number(val);
    if (!isNaN(idNum)) {
      try {
        const it = await getItemById(obraId, idNum);
        setMovementItem(it || null);
      } catch (e) {
        console.error(e);
        setMovementItem(null);
      }
    } else {
      setMovementItem(null);
    }
  };

  const submitMovement = async () => {
    if (!movementItemId || !movementQtd || !obraId) return toast({ title: 'Erro', description: 'Informe item e quantidade', variant: 'destructive' });
    setLoading(true);
    try {
      await registerMovement(obraId, Number(movementItemId), movementType, movementQtd);
      toast({ title: 'Registrado', description: 'Movimento registrado com sucesso' });
      setMovementOpen(false);
      await carregar();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao registrar movimento', variant: 'destructive' });
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
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const data = await getAlmoxarifadoHistorico(obraId);
      setHistory(data || []);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      toast({ title: 'Erro', description: 'Não foi possível carregar histórico', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const itemsFiltrados = useMemo(() => {
    return items.filter((it) => Number(it?.quantidade ?? 0) > 0);
  }, [items]);

  const onClickSuggestion = (it: any) => {
    setSelectedSearchItem(it);
    setShowSearchDetail(true);
    setSuggestions([]);
    setQuery('');
  };

  const itemsFiltradosEditor = useMemo(() => {
    if (!itemsEditorQuery || !itemsEditorQuery.trim()) return items;
    const q = itemsEditorQuery.trim().toLowerCase();
    return items.filter((it) => {
      const nome = String(it.nome || '').toLowerCase();
      const categoria = String(it.categoria || '').toLowerCase();
      return nome.includes(q) || categoria.includes(q);
    });
  }, [items, itemsEditorQuery]);

  const excluirItem = async (itemId: number) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      const { error } = await supabase.from('almox_items').delete().eq('id', itemId);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Item excluído com sucesso' });
      await carregar();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao excluir item', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={abrirHistorico}>Histórico</Button>
          <Button variant="outline" onClick={() => setShowItemsEditor(true)}>Itens</Button>
          <Button onClick={() => setShowCadastro(true)}>Cadastrar item</Button>
        </div>
      </div>

      <div className="flex justify-center items-center gap-4">
        <Button onClick={() => abrirMovimento('saida')} className="bg-yellow-500 hover:bg-yellow-600 text-white w-32">Saída</Button>
        <Button onClick={() => abrirMovimento('entrada')} className="bg-green-500 hover:bg-green-600 text-white w-32">Entrada</Button>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Acesso do Almoxarife</h2>
            <div className="mt-2 flex items-center gap-2 text-sm">
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
                className="h-8 w-8 p-0"
                aria-label="Copiar link do almoxarife"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button onClick={gerarCodigoAcesso} disabled={accessCodesLoading}>Gerar código</Button>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Dispositivos autorizados</h3>
          {devicesLoading ? (
            <div className="text-sm text-gray-500">Carregando dispositivos...</div>
          ) : devices.length === 0 ? (
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
                {devices.map((d) => (
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
        <div className="flex gap-2 items-center">
          <Input placeholder="Pesquisar itens" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full md:w-96" />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 bg-white border rounded-md shadow-sm max-w-md">
            {suggestions.map(s => (
              <div key={s.id} className="flex justify-between items-center p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                <div onClick={() => onClickSuggestion(s)} className="flex-1">{s.nome}</div>
                <button onClick={(e) => { e.stopPropagation(); onPickSuggestion(s); }} className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600">Entrada</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Lista de materiais</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>QTD</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Categoria</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentações</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="ml-2 text-sm text-gray-600">Carregando...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhuma movimentação registrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((mov, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(mov.data).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{mov.item_nome}</TableCell>
                    <TableCell className={mov.tipo === 'entrada' ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                      {mov.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                    </TableCell>
                    <TableCell>{mov.quantidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
        </DialogContent>
      </Dialog>

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{movementType === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">ID ou Nome do item</label>
              <Input value={movementItemId} onChange={(e) => onItemIdChange(e.target.value)} placeholder="Digite o ID" className="mb-2" />
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
