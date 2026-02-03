import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { listarItens, searchItems, getItemById, registerMovement, registrarDispositivoAlmoxarife, verificarDispositivoAlmoxarife } from '@/lib/api';

const DEVICE_KEY = 'almox_access_device';

type AlmoxDeviceInfo = {
  obraId: number;
  deviceId: number;
  deviceName: string;
};

const AlmoxarifadoAcesso: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<AlmoxDeviceInfo | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return;
    try {
      const parsed: AlmoxDeviceInfo = JSON.parse(raw);
      setDeviceInfo(parsed);
      setDeviceName(parsed.deviceName);
      setMode('login');
    } catch {
      localStorage.removeItem(DEVICE_KEY);
    }
  }, []);

  const handleRegistrar = async () => {
    if (!code.trim() || !deviceName.trim() || !password) return;
    if (password !== passwordConfirm) {
      toast({ title: 'Erro', description: 'As senhas não conferem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data: any = await registrarDispositivoAlmoxarife(code.trim(), deviceName.trim(), password);
      const info: AlmoxDeviceInfo = {
        obraId: data.obra_id,
        deviceId: data.id,
        deviceName: data.device_name
      };
      localStorage.setItem(DEVICE_KEY, JSON.stringify(info));
      setDeviceInfo(info);
      setAuthenticated(true);
      setMode('login');
      setCode('');
      setPassword('');
      setPasswordConfirm('');
      toast({ title: 'Dispositivo registrado', description: 'Acesso liberado' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível registrar o dispositivo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!deviceInfo || !password) return;
    setLoading(true);
    try {
      await verificarDispositivoAlmoxarife(deviceInfo.obraId, deviceInfo.deviceName, password);
      setAuthenticated(true);
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
    setAuthenticated(false);
  };

  const handleRemoverDispositivo = () => {
    localStorage.removeItem(DEVICE_KEY);
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
              {deviceInfo && (
                <Button variant="ghost" onClick={() => setMode('login')} className="w-full">Já tenho dispositivo</Button>
              )}
            </>
          )}

          {mode === 'login' && (
            <>
              <p className="text-sm text-gray-600">Dispositivo: <strong>{deviceInfo?.deviceName}</strong></p>
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

  return <AlmoxarifadoPublic obraId={deviceInfo?.obraId || 0} onSair={handleSair} />;
};

const AlmoxarifadoPublic: React.FC<{ obraId: number; onSair: () => void }> = ({ obraId, onSair }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementItem, setMovementItem] = useState<any>(null);
  const [movementQtd, setMovementQtd] = useState<number>(1);
  const [movementQuery, setMovementQuery] = useState('');
  const [movementSuggestions, setMovementSuggestions] = useState<any[]>([]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => Number(it?.quantidade ?? 0) > 0);
  }, [items]);

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

  const abrirMovimento = (type: 'entrada' | 'saida') => {
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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Almoxarifado</h1>
        <Button variant="outline" onClick={onSair}>Sair</Button>
      </div>

      <div className="flex justify-center items-center gap-4">
        <Button onClick={() => abrirMovimento('saida')} className="bg-yellow-500 hover:bg-yellow-600 text-white w-32" disabled={loading}>Saída</Button>
        <Button onClick={() => abrirMovimento('entrada')} className="bg-green-500 hover:bg-green-600 text-white w-32" disabled={loading}>Entrada</Button>
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
            {filteredItems.map(it => (
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

export default AlmoxarifadoAcesso;
