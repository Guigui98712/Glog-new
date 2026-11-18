import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ListChecks, Plus, Settings2, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface Categoria {
  id: string;
  nome: string;
}

interface EtapaDetalhada {
  id: string;
  categoria_id: string;
  nome: string;
}

interface Conclusao {
  id: string;
  etapa_id: string;
  pavimento: number;
  data_conclusao: string;
  observacao: string | null;
}

const nomePavimento = (pavimento: number) => {
  if (pavimento < 0) return `Subsolo ${Math.abs(pavimento)}`;
  if (pavimento === 0) return 'Térreo';
  return `${pavimento}º Andar`;
};

const EtapasDetalhadasObra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const obraId = Number(id);

  const [obraNome, setObraNome] = useState('');
  const [numeroPavimentos, setNumeroPavimentos] = useState<number | null>(null);
  const [numeroSubsolos, setNumeroSubsolos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [etapas, setEtapas] = useState<EtapaDetalhada[]>([]);
  const [conclusoes, setConclusoes] = useState<Conclusao[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [pavimentosForm, setPavimentosForm] = useState('');
  const [temSubsoloForm, setTemSubsoloForm] = useState(false);
  const [subsolosForm, setSubsolosForm] = useState('');
  const [categoriaForm, setCategoriaForm] = useState('');
  const [etapaForm, setEtapaForm] = useState('');
  const [categoriaEtapaForm, setCategoriaEtapaForm] = useState('');
  const [pavimentoForm, setPavimentoForm] = useState('');
  const [etapaConclusaoForm, setEtapaConclusaoForm] = useState('');
  const [observacaoForm, setObservacaoForm] = useState('');
  const [gerenciarAberto, setGerenciarAberto] = useState(false);
  const [pavimentosDialogAberto, setPavimentosDialogAberto] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!Number.isInteger(obraId) || obraId <= 0) {
      toast({ title: 'Obra inválida', description: 'Não foi possível identificar esta obra.', variant: 'destructive' });
      navigate('/obras', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const [obraResp, categoriasResp, etapasResp, conclusoesResp] = await Promise.all([
        supabase.from('obras').select('nome, numero_pavimentos, numero_subsolos').eq('id', obraId).single(),
        supabase.from('obra_etapas_categorias').select('id, nome').eq('obra_id', obraId).order('nome'),
        supabase.from('obra_etapas_detalhadas').select('id, categoria_id, nome').eq('obra_id', obraId).order('nome'),
        supabase.from('obra_etapas_conclusoes')
          .select('id, etapa_id, pavimento, data_conclusao, observacao')
          .eq('obra_id', obraId)
          .order('data_conclusao', { ascending: false }),
      ]);

      if (obraResp.error) throw obraResp.error;
      if (categoriasResp.error) throw categoriasResp.error;
      if (etapasResp.error) throw etapasResp.error;
      if (conclusoesResp.error) throw conclusoesResp.error;

      setObraNome(obraResp.data.nome);
      setNumeroPavimentos(obraResp.data.numero_pavimentos);
      setPavimentosForm(obraResp.data.numero_pavimentos ? String(obraResp.data.numero_pavimentos) : '');
      setNumeroSubsolos(obraResp.data.numero_subsolos || 0);
      setTemSubsoloForm((obraResp.data.numero_subsolos || 0) > 0);
      setSubsolosForm(obraResp.data.numero_subsolos ? String(obraResp.data.numero_subsolos) : '');
      setCategorias(categoriasResp.data || []);
      setEtapas(etapasResp.data || []);
      setConclusoes(conclusoesResp.data || []);
    } catch (error) {
      console.error('Erro ao carregar etapas detalhadas:', error);
      toast({
        title: 'Erro ao carregar página',
        description: error instanceof Error ? error.message : 'Não foi possível carregar as etapas detalhadas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [obraId, navigate, toast]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const etapasPorId = useMemo(() => new Map(etapas.map((etapa) => [etapa.id, etapa])), [etapas]);
  const categoriasPorId = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria])), [categorias]);
  const etapasDaCategoria = useMemo(
    () => etapas.filter((etapa) => etapa.categoria_id === categoriaEtapaForm),
    [etapas, categoriaEtapaForm],
  );
  const conclusoesFiltradas = useMemo(
    () => conclusoes.filter((conclusao) => {
      const etapa = etapasPorId.get(conclusao.etapa_id);
      return categoriaFiltro === 'todas' || etapa?.categoria_id === categoriaFiltro;
    }),
    [categoriaFiltro, conclusoes, etapasPorId],
  );
  const pavimentos = useMemo(
    () => numeroPavimentos
      ? [
          ...Array.from({ length: numeroSubsolos }, (_, index) => index - numeroSubsolos),
          0,
          ...Array.from({ length: Math.max(numeroPavimentos - 1, 0) }, (_, index) => index + 1),
        ]
      : [],
    [numeroPavimentos, numeroSubsolos],
  );

  const salvarNumeroPavimentos = async () => {
    const quantidade = Number(pavimentosForm);
    const subsolos = temSubsoloForm ? Number(subsolosForm) : 0;
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 200) {
      toast({ title: 'Quantidade inválida', description: 'Informe um número inteiro de pavimentos entre 1 e 200. A quantidade inclui o térreo.', variant: 'destructive' });
      return;
    }
    if (!Number.isInteger(subsolos) || subsolos < 0 || subsolos > 200 || (temSubsoloForm && subsolos < 1)) {
      toast({ title: 'Quantidade de subsolos inválida', description: 'Informe um número inteiro de subsolos entre 1 e 200 ou desmarque a opção.', variant: 'destructive' });
      return;
    }
    const maiorPavimentoRegistrado = Math.max(0, ...conclusoes.map((conclusao) => conclusao.pavimento));
    const maiorSubsoloRegistrado = Math.max(0, ...conclusoes.map((conclusao) => -conclusao.pavimento));
    if (maiorPavimentoRegistrado >= quantidade || maiorSubsoloRegistrado > subsolos) {
      toast({
        title: 'Quantidade incompatível com os registros',
        description: 'A quantidade não pode ser reduzida abaixo de pavimentos que já possuem etapas concluídas.',
        variant: 'destructive',
      });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('obras')
        .update({ numero_pavimentos: quantidade, numero_subsolos: subsolos })
        .eq('id', obraId);
      if (error) throw error;
      setNumeroPavimentos(quantidade);
      setNumeroSubsolos(subsolos);
      setTemSubsoloForm(subsolos > 0);
      setSubsolosForm(subsolos ? String(subsolos) : '');
      setPavimentosDialogAberto(false);
      toast({ title: 'Pavimentos salvos', description: `Térreo e ${quantidade - 1} ${quantidade - 1 === 1 ? 'andar acima' : 'andares acima'}${subsolos ? `, além de ${subsolos} ${subsolos === 1 ? 'subsolo' : 'subsolos'}` : ''}.` });
    } catch (error) {
      console.error('Erro ao salvar quantidade de pavimentos:', error);
      toast({ title: 'Erro ao salvar', description: error instanceof Error ? error.message : 'Não foi possível salvar a quantidade de pavimentos.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const cadastrarCategoria = async () => {
    const nome = categoriaForm.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('obra_etapas_categorias').insert({ obra_id: obraId, nome });
      if (error) throw error;
      setCategoriaForm('');
      await carregarDados();
      toast({ title: 'Categoria cadastrada' });
    } catch (error) {
      console.error('Erro ao cadastrar categoria:', error);
      toast({ title: 'Erro ao cadastrar categoria', description: error instanceof Error ? error.message : 'Confira se já existe uma categoria com esse nome.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const cadastrarEtapa = async () => {
    const nome = etapaForm.trim();
    if (!nome || !categoriaEtapaForm) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('obra_etapas_detalhadas').insert({
        obra_id: obraId,
        categoria_id: categoriaEtapaForm,
        nome,
      });
      if (error) throw error;
      setEtapaForm('');
      await carregarDados();
      toast({ title: 'Etapa cadastrada' });
    } catch (error) {
      console.error('Erro ao cadastrar etapa:', error);
      toast({ title: 'Erro ao cadastrar etapa', description: error instanceof Error ? error.message : 'Confira se já existe uma etapa com esse nome na categoria.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const registrarConclusao = async () => {
    if (!pavimentoForm || !etapaConclusaoForm) {
      toast({ title: 'Dados incompletos', description: 'Selecione o pavimento e a etapa concluída.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('obra_etapas_conclusoes').insert({
        obra_id: obraId,
        etapa_id: etapaConclusaoForm,
        pavimento: Number(pavimentoForm),
        observacao: observacaoForm.trim() || null,
      });
      if (error) throw error;
      setPavimentoForm('');
      setEtapaConclusaoForm('');
      setObservacaoForm('');
      await carregarDados();
      toast({ title: 'Conclusão registrada' });
    } catch (error) {
      console.error('Erro ao registrar conclusão:', error);
      toast({
        title: 'Não foi possível registrar',
        description: error instanceof Error && error.message.includes('duplicate')
          ? 'Esta etapa já foi concluída neste pavimento.'
          : error instanceof Error ? error.message : 'Confira os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const excluirConclusao = async (conclusaoId: string) => {
    setSalvando(true);
    try {
      const { error } = await supabase.from('obra_etapas_conclusoes').delete().eq('id', conclusaoId).eq('obra_id', obraId);
      if (error) throw error;
      setConclusoes((atuais) => atuais.filter((item) => item.id !== conclusaoId));
      toast({ title: 'Conclusão removida' });
    } catch (error) {
      console.error('Erro ao remover conclusão:', error);
      toast({ title: 'Erro ao remover conclusão', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center">Carregando etapas detalhadas...</div>;
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para obra
          </Button>
          <h1 className="text-2xl font-bold">Etapas detalhadas</h1>
          <p className="text-sm text-muted-foreground">{obraNome}</p>
        </div>
        {numeroPavimentos && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPavimentosDialogAberto(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Editar pavimentos
            </Button>
            <Button variant="outline" onClick={() => setGerenciarAberto(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Categorias e etapas
            </Button>
          </div>
        )}
      </div>

      {!numeroPavimentos ? (
        <Card className="mx-auto max-w-xl space-y-4 p-6">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Informe os pavimentos da obra</h2>
              <p className="text-sm text-muted-foreground">
                A quantidade informada inclui o térreo. Se houver subsolos, marque a opção para informar quantos.
              </p>
            </div>
          </div>
          <CamposPavimentos
            pavimentosId="pavimentos-inicial"
            pavimentos={pavimentosForm}
            onPavimentosChange={setPavimentosForm}
            temSubsolo={temSubsoloForm}
            onTemSubsoloChange={(checked) => {
              setTemSubsoloForm(checked);
              if (!checked) setSubsolosForm('');
              else if (!subsolosForm) setSubsolosForm('1');
            }}
            subsolos={subsolosForm}
            onSubsolosChange={setSubsolosForm}
          />
          <Button onClick={salvarNumeroPavimentos} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar e continuar'}
          </Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-4 p-4 md:p-6">
            <div>
              <h2 className="text-lg font-semibold">Registrar etapa concluída</h2>
              <p className="text-sm text-muted-foreground">Selecione o pavimento, a categoria e a etapa finalizada.</p>
            </div>
            {categorias.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-center">
                <p className="mb-3 text-sm text-muted-foreground">Cadastre uma categoria e suas etapas para começar.</p>
                <Button onClick={() => setGerenciarAberto(true)}><Plus className="mr-2 h-4 w-4" /> Cadastrar categorias e etapas</Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Pavimento</Label>
                    <Select value={pavimentoForm} onValueChange={setPavimentoForm}>
                      <SelectTrigger><SelectValue placeholder="Selecione o pavimento" /></SelectTrigger>
                      <SelectContent>
                        {pavimentos.map((pavimento) => (
                          <SelectItem key={pavimento} value={String(pavimento)}>{nomePavimento(pavimento)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={categoriaEtapaForm} onValueChange={(value) => { setCategoriaEtapaForm(value); setEtapaConclusaoForm(''); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        {categorias.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Etapa concluída</Label>
                    <Select value={etapaConclusaoForm} onValueChange={setEtapaConclusaoForm} disabled={!categoriaEtapaForm || etapasDaCategoria.length === 0}>
                      <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                      <SelectContent>
                        {etapasDaCategoria.map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input value={observacaoForm} onChange={(event) => setObservacaoForm(event.target.value)} placeholder="Observação (opcional)" />
                  <Button onClick={registrarConclusao} disabled={salvando || !etapaConclusaoForm} className="sm:shrink-0">
                    <Check className="mr-2 h-4 w-4" /> Registrar conclusão
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card className="space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Etapas concluídas</h2>
                <p className="text-sm text-muted-foreground">{conclusoesFiltradas.length} {conclusoesFiltradas.length === 1 ? 'registro' : 'registros'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={categoriaFiltro === 'todas' ? 'default' : 'outline'} onClick={() => setCategoriaFiltro('todas')}>Todas</Button>
                {categorias.map((categoria) => (
                  <Button key={categoria.id} size="sm" variant={categoriaFiltro === categoria.id ? 'default' : 'outline'} onClick={() => setCategoriaFiltro(categoria.id)}>
                    {categoria.nome}
                  </Button>
                ))}
              </div>
            </div>
            {conclusoesFiltradas.length === 0 ? (
              <p className="rounded-md bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                {conclusoes.length === 0 ? 'Nenhuma etapa concluída foi registrada.' : 'Nenhuma conclusão encontrada nesta categoria.'}
              </p>
            ) : (
              <div className="space-y-3">
                {conclusoesFiltradas.map((conclusao) => {
                  const etapa = etapasPorId.get(conclusao.etapa_id);
                  const categoria = etapa ? categoriasPorId.get(etapa.categoria_id) : null;
                  return (
                    <div key={conclusao.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{etapa?.nome || 'Etapa removida'}</span>
                          {categoria && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{categoria.nome}</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {nomePavimento(conclusao.pavimento)} · {format(parseISO(conclusao.data_conclusao), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                        {conclusao.observacao && <p className="mt-1 break-words text-sm">{conclusao.observacao}</p>}
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Remover conclusão" disabled={salvando} onClick={() => void excluirConclusao(conclusao.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={pavimentosDialogAberto} onOpenChange={setPavimentosDialogAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar pavimentos da obra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A quantidade de pavimentos inclui o térreo. As alterações não removem os registros de conclusão existentes.
            </p>
            <CamposPavimentos
              pavimentosId="pavimentos-edicao"
              pavimentos={pavimentosForm}
              onPavimentosChange={setPavimentosForm}
              temSubsolo={temSubsoloForm}
              onTemSubsoloChange={(checked) => {
                setTemSubsoloForm(checked);
                if (!checked) setSubsolosForm('');
                else if (!subsolosForm) setSubsolosForm('1');
              }}
              subsolos={subsolosForm}
              onSubsolosChange={setSubsolosForm}
            />
            <Button onClick={salvarNumeroPavimentos} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar pavimentos'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gerenciarAberto} onOpenChange={setGerenciarAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Gerenciar categorias e etapas</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="nova-categoria">Nova categoria</Label>
              <div className="flex gap-2">
                <Input id="nova-categoria" value={categoriaForm} onChange={(event) => setCategoriaForm(event.target.value)} placeholder="Ex.: Elétrica" />
                <Button onClick={cadastrarCategoria} disabled={salvando || !categoriaForm.trim()}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
              </div>
              {categorias.length > 0 && <p className="text-xs text-muted-foreground">Categorias: {categorias.map((categoria) => categoria.nome).join(', ')}</p>}
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label>Nova etapa</Label>
              <Select value={categoriaEtapaForm} onValueChange={setCategoriaEtapaForm}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input value={etapaForm} onChange={(event) => setEtapaForm(event.target.value)} placeholder="Ex.: Elétrica de parede" />
                <Button onClick={cadastrarEtapa} disabled={salvando || !etapaForm.trim() || !categoriaEtapaForm}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
              </div>
              {categorias.map((categoria) => (
                <div key={categoria.id} className="rounded-md bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{categoria.nome}</p>
                  <p className="mt-1 text-muted-foreground">
                    {etapas.filter((etapa) => etapa.categoria_id === categoria.id).map((etapa) => etapa.nome).join(', ') || 'Nenhuma etapa cadastrada'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface CamposPavimentosProps {
  pavimentosId: string;
  pavimentos: string;
  onPavimentosChange: (value: string) => void;
  temSubsolo: boolean;
  onTemSubsoloChange: (checked: boolean) => void;
  subsolos: string;
  onSubsolosChange: (value: string) => void;
}

const CamposPavimentos = ({
  pavimentosId,
  pavimentos,
  onPavimentosChange,
  temSubsolo,
  onTemSubsoloChange,
  subsolos,
  onSubsolosChange,
}: CamposPavimentosProps) => (
  <>
    <div className="space-y-2">
      <Label htmlFor={pavimentosId}>Quantidade de pavimentos (inclui o térreo)</Label>
      <Input
        id={pavimentosId}
        type="number"
        min="1"
        max="200"
        step="1"
        value={pavimentos}
        onChange={(event) => onPavimentosChange(event.target.value)}
        placeholder="Ex.: 3"
      />
    </div>
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={temSubsolo}
          onChange={(event) => onTemSubsoloChange(event.target.checked)}
          className="accent-primary"
        />
        Subsolo
      </label>
      {temSubsolo && (
        <div className="space-y-2">
          <Label htmlFor={`${pavimentosId}-subsolos`}>Quantidade de subsolos</Label>
          <Input
            id={`${pavimentosId}-subsolos`}
            type="number"
            min="1"
            max="200"
            step="1"
            value={subsolos}
            onChange={(event) => onSubsolosChange(event.target.value)}
            placeholder="Ex.: 2"
          />
        </div>
      )}
    </div>
  </>
);

export default EtapasDetalhadasObra;
