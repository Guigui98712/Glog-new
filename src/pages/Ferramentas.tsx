import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  listarFerramentasAlmox,
  criarFerramentaAlmox,
  retirarFerramentaAlmox,
  devolverFerramentaAlmox,
} from '@/lib/api';

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
        <Button onClick={abrirCadastro}>Cadastrar ferramenta</Button>
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

export default Ferramentas;
