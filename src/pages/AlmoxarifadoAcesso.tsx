import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { listarItens, searchItems, getItemById, registerMovement, registrarDispositivoAlmoxarife, verificarDispositivoAlmoxarife, getAlmoxarifadoHistorico, getAlmoxarifadoHistoricoAnos, excluirItemAlmox, listarFerramentasAlmox, criarFerramentaAlmox, retirarFerramentaAlmox, devolverFerramentaAlmox } from '@/lib/api';
import CadastroItemDialog from '@/components/CadastroItemDialog';
import { MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DEVICE_KEY = 'almox_access_device';

type AlmoxDeviceInfo = {
  obraId: number;
  deviceId: number;
  deviceName: string;
  sessionExpiresAt?: string | null;
};

const getNextDailyExpiration = (hour = 20) => {
  const now = new Date();
  const expiration = new Date(now);
  expiration.setHours(hour, 0, 0, 0);

  if (now >= expiration) {
    expiration.setDate(expiration.getDate() + 1);
  }

  return expiration.toISOString();
};

const getInitialAccessContext = () => {
  if (typeof window === 'undefined') {
    return {
      obraId: null as number | null,
      activeView: 'materiais' as 'materiais' | 'ferramentas',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const obraIdParam = params.get('obraId') || params.get('obra');
  const viewParam = params.get('view');
  const parsedObraId = obraIdParam ? Number(obraIdParam) : NaN;

  return {
    obraId: Number.isFinite(parsedObraId) && parsedObraId > 0 ? parsedObraId : null,
    activeView: viewParam === 'ferramentas' ? 'ferramentas' : 'materiais',
  };
};

export default function AlmoxarifadoAcesso(): JSX.Element {
  const initialContext = getInitialAccessContext();
  const { toast } = useToast();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<AlmoxDeviceInfo | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [targetObraId] = useState<number | null>(initialContext.obraId);
  const [activeView, setActiveView] = useState<'materiais' | 'ferramentas'>(initialContext.activeView);

  const deviceStorageKey = targetObraId ? `${DEVICE_KEY}_${targetObraId}` : DEVICE_KEY;

  const persistDeviceInfo = (info: AlmoxDeviceInfo) => {
    localStorage.setItem(deviceStorageKey, JSON.stringify(info));
  };

  useEffect(() => {
    const raw = localStorage.getItem(deviceStorageKey);
    if (!raw) {
      setDeviceInfo(null);
      setAuthenticated(false);
      setMode('register');
      return;
    }

    try {
      const parsed: AlmoxDeviceInfo = JSON.parse(raw);
      if (targetObraId && Number(parsed.obraId) !== targetObraId) {
        setDeviceInfo(null);
        setAuthenticated(false);
        setMode('register');
        return;
      }

      const hasValidSession =
        !!parsed.sessionExpiresAt && new Date(parsed.sessionExpiresAt).getTime() > Date.now();

      setDeviceInfo(parsed);
      setDeviceName(parsed.deviceName);
      setMode('login');

      if (hasValidSession) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } catch {
      localStorage.removeItem(deviceStorageKey);
      setDeviceInfo(null);
      setAuthenticated(false);
      setMode('register');
    }
  }, [deviceStorageKey, targetObraId]);

  const handleRegistrar = async () => {
    if (!code.trim()) {
      toast({ title: 'Erro', description: 'Por favor, informe o código de acesso', variant: 'destructive' });
      return;
    }
    if (!deviceName.trim()) {
      toast({ title: 'Erro', description: 'Por favor, informe o nome do dispositivo', variant: 'destructive' });
      return;
    }
    if (!password) {
      toast({ title: 'Erro', description: 'Por favor, crie uma senha', variant: 'destructive' });
      return;
    }
    if (!passwordConfirm) {
      toast({ title: 'Erro', description: 'Por favor, confirme a senha', variant: 'destructive' });
      return;
    }
    if (password !== passwordConfirm) {
      toast({ title: 'Erro', description: 'As senhas não conferem', variant: 'destructive' });
      return;
    }
    if (password.length < 4) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 4 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data: any = await registrarDispositivoAlmoxarife(code.trim(), deviceName.trim(), password);

      if (targetObraId && Number(data.obra_id) !== targetObraId) {
        throw new Error('Este código não pertence à obra deste link');
      }

      const info: AlmoxDeviceInfo = {
        obraId: data.obra_id,
        deviceId: data.id,
        deviceName: data.device_name,
        sessionExpiresAt: getNextDailyExpiration(20)
      };
      persistDeviceInfo(info);
      setDeviceInfo(info);
      setAuthenticated(true);
      setMode('login');
      setCode('');
      setPassword('');
      setPasswordConfirm('');
      toast({ title: 'Dispositivo registrado', description: 'Acesso liberado' });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro',
        description: e instanceof Error ? e.message : 'Não foi possível registrar o dispositivo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const loginObraId = targetObraId ?? deviceInfo?.obraId ?? null;
    const loginDeviceName = String(deviceInfo?.deviceName || deviceName || '').trim();

    if (!loginObraId) {
      toast({ title: 'Erro', description: 'Link sem obra válida', variant: 'destructive' });
      return;
    }

    if (!loginDeviceName) {
      toast({ title: 'Erro', description: 'Informe o nome do dispositivo', variant: 'destructive' });
      return;
    }

    if (!password) {
      toast({ title: 'Erro', description: 'Por favor, informe a senha', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const verified: any = await verificarDispositivoAlmoxarife(loginObraId, loginDeviceName, password);

      const resolvedDeviceId = Number(
        deviceInfo?.deviceId ??
        verified?.id ??
        verified?.device_id ??
        0
      );

      const infoWithSession: AlmoxDeviceInfo = {
        obraId: loginObraId,
        deviceId: resolvedDeviceId,
        deviceName: loginDeviceName,
        sessionExpiresAt: getNextDailyExpiration(20)
      };

      persistDeviceInfo(infoWithSession);
      setDeviceInfo(infoWithSession);
      setAuthenticated(true);
      setMode('login');
      setPassword('');
      toast({ title: 'Acesso liberado', description: 'Senha correta' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Senha incorreta', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSair = () => {
    if (deviceInfo) {
      const infoWithoutSession: AlmoxDeviceInfo = {
        ...deviceInfo,
        sessionExpiresAt: null
      };
      persistDeviceInfo(infoWithoutSession);
      setDeviceInfo(infoWithoutSession);
    }
    setAuthenticated(false);
  };

  const handleRemoverDispositivo = () => {
    localStorage.removeItem(deviceStorageKey);
    setDeviceInfo(null);
    setMode('register');
    setDeviceName('');
    setPassword('');
    setPasswordConfirm('');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md space-y-4">
          <h1 className="text-xl font-semibold">Acesso ao Almoxarifado</h1>
          {mode === 'register' && (
            <>
              <p className="text-sm text-gray-600">Primeiro acesso: informe o código, nome do dispositivo e crie uma senha.</p>
              <Input
                placeholder="Código de acesso"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                placeholder="Nome do dispositivo"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirmar senha"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
              <Button onClick={handleRegistrar} disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar'}
              </Button>
              <Button variant="ghost" onClick={() => setMode('login')} className="w-full">Já tenho dispositivo</Button>
            </>
          )}

          {mode === 'login' && (
            <>
              {deviceInfo ? (
                <p className="text-sm text-gray-600">Dispositivo: <strong>{deviceInfo.deviceName}</strong></p>
              ) : (
                <Input
                  placeholder="Nome do dispositivo"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              )}
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={handleLogin} disabled={loading} className="w-full">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setMode('register')}>Usar outro código</Button>
                <Button variant="ghost" onClick={handleRemoverDispositivo}>Remover dispositivo</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  if (activeView === 'ferramentas') {
    return (
      <AlmoxarifadoFerramentasPublic
        obraId={deviceInfo?.obraId || 0}
        onSair={handleSair}
        onVoltarMateriais={() => setActiveView('materiais')}
      />
    );
  }

  return (
    <AlmoxarifadoPublic
      obraId={deviceInfo?.obraId || 0}
      onSair={handleSair}
      onAbrirFerramentas={() => setActiveView('ferramentas')}
    />
  );
};

const AlmoxarifadoPublic: React.FC<{ obraId: number; onSair: () => void; onAbrirFerramentas: () => void }> = ({ obraId, onSair, onAbrirFerramentas }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida' | 'devolucao'>('entrada');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementItem, setMovementItem] = useState<any>(null);
  const [movementQtd, setMovementQtd] = useState<number>(1);
  const [movementQuery, setMovementQuery] = useState('');
  const [movementSuggestions, setMovementSuggestions] = useState<any[]>([]);
  const [movementNumeroPedido, setMovementNumeroPedido] = useState('');
  const [movementEmpresaNome, setMovementEmpresaNome] = useState('');
  const [movementRetiradoPor, setMovementRetiradoPor] = useState('');

  const [showCadastro, setShowCadastro] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyYears, setHistoryYears] = useState<number[]>([]);

  const [showItemsEditor, setShowItemsEditor] = useState(false);
  const [itemsEditorQuery, setItemsEditorQuery] = useState('');

  const filteredItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const catA = String(a?.categoria || 'Sem categoria').toLowerCase();
      const catB = String(b?.categoria || 'Sem categoria').toLowerCase();
      if (catA !== catB) {
        return catA.localeCompare(catB);
      }
      return String(a?.nome || '').localeCompare(String(b?.nome || ''));
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

  useEffect(() => { carregar(); }, [obraId]);

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

  const abrirMovimento = (type: 'entrada' | 'saida' | 'devolucao') => {
    setMovementType(type);
    setMovementItemId('');
    setMovementItem(null);
    setMovementQtd(1);
    setMovementQuery('');
    setMovementSuggestions([]);
    setMovementNumeroPedido('');
    setMovementEmpresaNome('');
    setMovementRetiradoPor('');
    setMovementOpen(true);
  };

  const onPickSuggestion = (it: any) => {
    setMovementType('entrada');
    setMovementItemId(String(it.id));
    setMovementItem(it);
    setMovementQuery(it.nome || '');
    setSuggestions([]);
    setQuery('');
    setMovementSuggestions([]);
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
    if (!val) { setMovementItem(null); return; }
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

    if (movementQtd <= 0) {
      return toast({ title: 'Erro', description: 'Informe uma quantidade maior que zero', variant: 'destructive' });
    }

    if ((movementType === 'saida' || movementType === 'devolucao') && movementItem && movementQtd > Number(movementItem.quantidade || 0)) {
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

    setLoading(true);
    try {
      const movementApiType = movementType === 'devolucao' ? 'entrada' : movementType;

      await registerMovement(obraId, Number(movementItemId), movementApiType, movementQtd, {
        numero_pedido: movementType === 'entrada' ? movementNumeroPedido : null,
        empresa_nome: movementType === 'entrada' ? movementEmpresaNome : null,
        retirado_por: movementType === 'saida' ? movementRetiradoPor : null,
        observacao: movementType === 'devolucao' ? 'devolucao' : null,
      });
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

  const abrirHistorico = async () => {
    const currentYear = new Date().getFullYear();
    setShowHistory(true);
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
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Almoxarifado</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={onAbrirFerramentas}>Ferramentas</Button>
          <Button variant="outline" onClick={abrirHistorico}>Histórico</Button>
          <Button variant="outline" onClick={() => setShowItemsEditor(true)}>Itens</Button>
          <Button onClick={() => setShowCadastro(true)}>Cadastrar item</Button>
          <Button variant="outline" onClick={onSair}>Sair</Button>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={() => abrirMovimento('devolucao')} variant="outline" className="w-full sm:w-28 h-9 text-xs" disabled={loading}>Devolução</Button>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button onClick={() => abrirMovimento('saida')} className="bg-yellow-500 hover:bg-yellow-600 text-white flex-1 sm:w-32" disabled={loading}>Saída</Button>
            <Button onClick={() => abrirMovimento('entrada')} className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:w-32" disabled={loading}>Entrada</Button>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 items-center">
          <Input placeholder="Pesquisar itens" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full md:w-96" />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 bg-white border rounded-md shadow-sm max-w-md">
            {suggestions.map(s => (
              <div key={s.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => onPickSuggestion(s)}>{s.nome}</div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Lista de materiais</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>QTD</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map(it => (
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

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentações</DialogTitle>
          </DialogHeader>
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
                    <TableHead>Retirado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((mov, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(mov.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        {mov.item_nome}
                        {mov.item_excluido ? ' (item excluído)' : ''}
                      </TableCell>
                      <TableCell className={mov.observacao === 'devolucao' ? 'text-blue-600 font-semibold' : (mov.tipo === 'entrada' ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold')}>
                        {mov.observacao === 'devolucao' ? '↩ Devolução' : (mov.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída')}
                      </TableCell>
                      <TableCell>{mov.quantidade}</TableCell>
                      <TableCell>{mov.numero_pedido || '-'}</TableCell>
                      <TableCell>{mov.empresa_nome || '-'}</TableCell>
                      <TableCell>{mov.retirado_por || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <DialogTitle>{movementType === 'entrada' ? 'Registrar entrada' : movementType === 'saida' ? 'Registrar saída' : 'Registrar devolução'}</DialogTitle>
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

            {movementType === 'entrada' && (
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

            {movementType === 'saida' && (
              <div>
                <label className="block text-sm font-medium mb-1">Nome de quem retirou</label>
                <Input
                  value={movementRetiradoPor}
                  onChange={(e) => setMovementRetiradoPor(e.target.value)}
                  placeholder="Ex.: João Silva"
                />
              </div>
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
}

const AlmoxarifadoFerramentasPublic: React.FC<{ obraId: number; onSair: () => void; onVoltarMateriais: () => void }> = ({
  obraId,
  onSair,
  onVoltarMateriais,
}) => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [ferramentas, setFerramentas] = useState<any[]>([]);

  const [showCadastro, setShowCadastro] = useState(false);
  const [cadastroNome, setCadastroNome] = useState('');
  const [cadastroDescricao, setCadastroDescricao] = useState('');
  const [cadastroFoto, setCadastroFoto] = useState<File | null>(null);
  const [cadastroFotoPreview, setCadastroFotoPreview] = useState<string | null>(null);

  const [showAcao, setShowAcao] = useState(false);
  const [ferramentaSelecionada, setFerramentaSelecionada] = useState<any | null>(null);
  const [nomeRetirada, setNomeRetirada] = useState('');
  const [savingAcao, setSavingAcao] = useState(false);

  const carregarFerramentas = async () => {
    if (!obraId) return;
    setLoading(true);
    try {
      const data = await listarFerramentasAlmox(obraId);
      setFerramentas(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível carregar ferramentas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFerramentas();
  }, [obraId]);

  const ferramentasOrdenadas = useMemo(() => {
    const copy = [...ferramentas];
    copy.sort((a, b) => {
      const aPegada = !!a.com_pessoa_nome;
      const bPegada = !!b.com_pessoa_nome;

      if (aPegada !== bPegada) {
        return aPegada ? -1 : 1;
      }

      return String(a.nome || '').localeCompare(String(b.nome || ''));
    });

    return copy;
  }, [ferramentas]);

  const abrirCadastro = () => {
    setCadastroNome('');
    setCadastroDescricao('');
    setCadastroFoto(null);
    setCadastroFotoPreview(null);
    setShowCadastro(true);
  };

  const onSelecionarFoto = (file: File | null) => {
    setCadastroFoto(file);
    if (!file) {
      setCadastroFotoPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCadastroFotoPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const salvarCadastro = async () => {
    if (!cadastroNome.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome da ferramenta', variant: 'destructive' });
      return;
    }

    if (!cadastroFoto) {
      toast({ title: 'Erro', description: 'Selecione uma foto da ferramenta', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await criarFerramentaAlmox({
        obra_id: obraId,
        nome: cadastroNome.trim(),
        descricao: cadastroDescricao.trim() || null,
        foto: cadastroFoto,
      });

      toast({ title: 'Sucesso', description: 'Ferramenta cadastrada com sucesso' });
      setShowCadastro(false);
      await carregarFerramentas();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível cadastrar a ferramenta', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const abrirAcaoFerramenta = (ferramenta: any) => {
    setFerramentaSelecionada(ferramenta);
    setNomeRetirada('');
    setShowAcao(true);
  };

  const confirmarAcaoFerramenta = async () => {
    if (!ferramentaSelecionada) return;

    const jaRetirada = !!ferramentaSelecionada.com_pessoa_nome;

    if (!jaRetirada && !nomeRetirada.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome da pessoa que está pegando', variant: 'destructive' });
      return;
    }

    setSavingAcao(true);
    try {
      if (jaRetirada) {
        await devolverFerramentaAlmox(ferramentaSelecionada.id);
        toast({ title: 'Sucesso', description: 'Ferramenta devolvida ao estoque' });
      } else {
        await retirarFerramentaAlmox(ferramentaSelecionada.id, nomeRetirada.trim());
        toast({ title: 'Sucesso', description: 'Retirada registrada com sucesso' });
      }

      setShowAcao(false);
      await carregarFerramentas();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a ferramenta', variant: 'destructive' });
    } finally {
      setSavingAcao(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ferramentas</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={onVoltarMateriais}>Materiais</Button>
          <Button onClick={abrirCadastro}>Cadastrar ferramenta</Button>
          <Button variant="outline" onClick={onSair}>Sair</Button>
        </div>
      </div>

      {loading && ferramentas.length === 0 ? (
        <Card className="p-6 text-sm text-gray-500">Carregando ferramentas...</Card>
      ) : ferramentasOrdenadas.length === 0 ? (
        <Card className="p-6 text-sm text-gray-500">Nenhuma ferramenta cadastrada.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ferramentasOrdenadas.map((ferramenta) => {
            const retirada = !!ferramenta.com_pessoa_nome;
            const gradient = retirada
              ? 'from-yellow-300 via-amber-400 to-yellow-500'
              : 'from-emerald-300 via-green-400 to-emerald-500';

            return (
              <button
                key={ferramenta.id}
                onClick={() => abrirAcaoFerramenta(ferramenta)}
                className={`text-left rounded-xl p-[2px] bg-gradient-to-r ${gradient} transition-transform hover:scale-[1.01]`}
              >
                <div className="bg-white rounded-[10px] p-3 h-full">
                  <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden mb-3">
                    {ferramenta.foto_url ? (
                      <img src={ferramenta.foto_url} alt={ferramenta.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Sem foto</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-sm line-clamp-1">{ferramenta.nome}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{ferramenta.descricao || 'Sem descrição'}</p>
                    <p className="text-xs font-medium text-gray-700">
                      {retirada ? `Com: ${ferramenta.com_pessoa_nome}` : 'Em estoque'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={showCadastro} onOpenChange={setShowCadastro}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar ferramenta</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <Input value={cadastroNome} onChange={(e) => setCadastroNome(e.target.value)} placeholder="Ex.: Furadeira" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <Textarea
                value={cadastroDescricao}
                onChange={(e) => setCadastroDescricao(e.target.value)}
                placeholder="Ex.: Furadeira de impacto 750W"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Foto</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => onSelecionarFoto(e.target.files?.[0] || null)}
              />
            </div>

            {cadastroFotoPreview && (
              <div className="w-full h-40 rounded-lg overflow-hidden bg-gray-100">
                <img src={cadastroFotoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCadastro(false)}>Cancelar</Button>
              <Button onClick={salvarCadastro} disabled={loading}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAcao} onOpenChange={setShowAcao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ferramentaSelecionada?.nome}</DialogTitle>
          </DialogHeader>

          {ferramentaSelecionada && (
            <div className="space-y-3">
              {ferramentaSelecionada.com_pessoa_nome ? (
                <>
                  <p className="text-sm text-gray-700">
                    Atualmente com: <strong>{ferramentaSelecionada.com_pessoa_nome}</strong>
                  </p>
                  <Button onClick={confirmarAcaoFerramenta} disabled={savingAcao} className="w-full">
                    {savingAcao ? 'Processando...' : 'Registrar devolução'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700">Ferramenta disponível em estoque.</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome de quem está pegando</label>
                    <Input
                      value={nomeRetirada}
                      onChange={(e) => setNomeRetirada(e.target.value)}
                      placeholder="Ex.: João Silva"
                    />
                  </div>
                  <Button onClick={confirmarAcaoFerramenta} disabled={savingAcao} className="w-full">
                    {savingAcao ? 'Processando...' : 'Registrar retirada'}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
