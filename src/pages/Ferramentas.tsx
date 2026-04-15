import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  listarFerramentasAlmox,
  criarFerramentaAlmox,
  retirarFerramentaAlmox,
  devolverFerramentaAlmox,
  excluirFerramentaAlmox,
  atualizarFerramentaAlmox,
  getFerramentasHistorico,
  getFerramentasHistoricoAnos,
} from '@/lib/api';

const FERRAMENTAS_REMINDER_BASE_ID = 730000;
const FERRAMENTAS_REMINDER_HOUR = 17;
const FERRAMENTAS_REMINDER_MINUTE = 30;
const FERRAMENTAS_REMINDER_WEEKDAYS = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
];

const Ferramentas: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const obraId = Number(id);

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

  const [showEdicao, setShowEdicao] = useState(false);
  const [ferramentaEdicao, setFerramentaEdicao] = useState<any | null>(null);
  const [edicaoNome, setEdicaoNome] = useState('');
  const [edicaoDescricao, setEdicaoDescricao] = useState('');
  const [savingEdicao, setSavingEdicao] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyYears, setHistoryYears] = useState<number[]>([]);
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyQuery, setHistoryQuery] = useState('');

  const reminderNotificationIds = useMemo(() => {
    const obraOffset = (obraId || 0) * 10;
    return FERRAMENTAS_REMINDER_WEEKDAYS.map((_, index) => FERRAMENTAS_REMINDER_BASE_ID + obraOffset + index);
  }, [obraId]);

  const syncFerramentasReminder = async (tools: any[]) => {
    if (!Capacitor.isNativePlatform() || !obraId) return;

    try {
      const hasBorrowedTools = tools.some((tool) => !!tool.com_pessoa_nome);

      await LocalNotifications.cancel({
        notifications: reminderNotificationIds.map((id) => ({ id })),
      });

      if (!hasBorrowedTools) return;

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== 'granted') return;
      }

      await LocalNotifications.schedule({
        notifications: FERRAMENTAS_REMINDER_WEEKDAYS.map((weekday, index) => ({
          id: reminderNotificationIds[index],
          title: 'Ferramentas pendentes',
          body: 'Nem todas as ferramentas foram entregues. Confira o almoxarifado.',
          schedule: {
            on: {
              weekday,
              hour: FERRAMENTAS_REMINDER_HOUR,
              minute: FERRAMENTAS_REMINDER_MINUTE,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          smallIcon: 'ic_notification',
          channelId: 'default',
        })),
      });
    } catch (err) {
      console.error('Erro ao sincronizar lembrete de ferramentas', err);
    }
  };

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

  useEffect(() => {
    syncFerramentasReminder(ferramentas);
  }, [ferramentas, obraId]);

  useEffect(() => {
    if (!showHistory || !obraId) return;

    let mounted = true;
    const run = async () => {
      setHistoryLoading(true);
      try {
        const data = await getFerramentasHistorico(obraId, historyYear);
        if (mounted) setHistory(data || []);
      } catch (err) {
        console.error(err);
        if (mounted) {
          toast({ title: 'Erro', description: 'Não foi possível carregar histórico de ferramentas', variant: 'destructive' });
        }
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [showHistory, historyYear, obraId, toast]);

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

  const abrirHistorico = async () => {
    if (!obraId) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const [data, anos] = await Promise.all([
        getFerramentasHistorico(obraId, historyYear),
        getFerramentasHistoricoAnos(obraId),
      ]);
      setHistory(data || []);
      setHistoryYears(anos || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível carregar histórico de ferramentas', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
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

  const excluirFerramenta = async () => {
    if (!ferramentaSelecionada) return;

    const confirmed = confirm(`Deseja realmente excluir a ferramenta "${ferramentaSelecionada.nome}"?`);
    if (!confirmed) return;

    setSavingAcao(true);
    try {
      await excluirFerramentaAlmox(ferramentaSelecionada.id);
      toast({ title: 'Sucesso', description: 'Ferramenta excluída com sucesso' });
      setShowAcao(false);
      await carregarFerramentas();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível excluir a ferramenta', variant: 'destructive' });
    } finally {
      setSavingAcao(false);
    }
  };

  const abrirEdicaoFerramenta = (ferramenta: any) => {
    setFerramentaEdicao(ferramenta);
    setEdicaoNome(String(ferramenta?.nome || ''));
    setEdicaoDescricao(String(ferramenta?.descricao || ''));
    setShowEdicao(true);
  };

  const salvarEdicaoFerramenta = async () => {
    if (!ferramentaEdicao) return;

    const nome = edicaoNome.trim();
    if (!nome) {
      toast({ title: 'Erro', description: 'Informe o nome da ferramenta', variant: 'destructive' });
      return;
    }

    setSavingEdicao(true);
    try {
      await atualizarFerramentaAlmox(ferramentaEdicao.id, {
        nome,
        descricao: edicaoDescricao.trim() || null,
      });

      toast({ title: 'Sucesso', description: 'Ferramenta atualizada com sucesso' });
      setShowEdicao(false);
      await carregarFerramentas();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a ferramenta', variant: 'destructive' });
    } finally {
      setSavingEdicao(false);
    }
  };

  const historyFiltrado = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return history;

    return history.filter((h) => {
      const toolNome = String(h.tool_nome || '').toLowerCase();
      const acao = String(h.acao || '').toLowerCase();
      const pessoa = String(h.pessoa_nome || '').toLowerCase();
      const observacao = String(h.observacao || '').toLowerCase();
      return toolNome.includes(q) || acao.includes(q) || pessoa.includes(q) || observacao.includes(q);
    });
  }, [history, historyQuery]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/obras/${id}/almoxarifado`)}
            title="Voltar para almoxarifado"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Ferramentas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={abrirHistorico}>Histórico</Button>
          <Button onClick={abrirCadastro}>Cadastrar ferramenta</Button>
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
              <div
                key={ferramenta.id}
                className={`rounded-xl p-[2px] bg-gradient-to-r ${gradient} transition-transform hover:scale-[1.01]`}
              >
                <div className="bg-white rounded-[10px] p-3 h-full">
                  <button
                    type="button"
                    onClick={() => abrirAcaoFerramenta(ferramenta)}
                    className="w-full text-left"
                  >
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
                  </button>
                </div>
              </div>
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

              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    if (!ferramentaSelecionada) return;
                    setShowAcao(false);
                    abrirEdicaoFerramenta(ferramentaSelecionada);
                  }}
                  disabled={savingAcao}
                  className="w-full text-xs text-gray-600 hover:text-gray-700 disabled:opacity-50 flex items-center justify-center gap-1 mb-2"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar ferramenta
                </button>

                <button
                  type="button"
                  onClick={excluirFerramenta}
                  disabled={savingAcao}
                  className="w-full text-xs text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir ferramenta
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEdicao} onOpenChange={setShowEdicao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ferramenta</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <Input
                value={edicaoNome}
                onChange={(e) => setEdicaoNome(e.target.value)}
                placeholder="Ex.: Furadeira"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <Textarea
                value={edicaoDescricao}
                onChange={(e) => setEdicaoDescricao(e.target.value)}
                placeholder="Ex.: Furadeira de impacto 750W"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowEdicao(false)}>Cancelar</Button>
              <Button onClick={salvarEdicaoFerramenta} disabled={savingEdicao}>
                {savingEdicao ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Ferramentas</DialogTitle>
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
            <div className="text-sm text-gray-500">Carregando histórico...</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhuma movimentação registrada.</div>
          ) : (
            <>
              <Input
                placeholder="Pesquisar histórico..."
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="w-full"
              />

              {historyFiltrado.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhum resultado encontrado para a pesquisa.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ferramenta</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Pessoa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyFiltrado.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{h.criado_em ? new Date(h.criado_em).toLocaleString('pt-BR') : '-'}</TableCell>
                          <TableCell>{h.tool_nome || '-'}</TableCell>
                          <TableCell>
                            {h.acao === 'cadastro' && 'Cadastro'}
                            {h.acao === 'retirada' && 'Retirada'}
                            {h.acao === 'devolucao' && 'Devolução'}
                            {h.acao === 'exclusao' && 'Exclusão'}
                          </TableCell>
                          <TableCell>{h.pessoa_nome || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ferramentas;
