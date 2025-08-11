import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { ViagensService, ContagemMensal, ViagemDetalhes, Carro, ContagemCarroMensal } from '@/services/ViagensService';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Edit2, Plus, Car } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function ViagensObra() {
  const { id: obraId } = useParams();
  const [diasComViagem, setDiasComViagem] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isViagem, setIsViagem] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [pessoas, setPessoas] = useState<string>('');
  const [pessoasLista, setPessoasLista] = useState<string[]>([]);
  const [contagemMensal, setContagemMensal] = useState<ContagemMensal[]>([]);
  const [viagensDetalhes, setViagensDetalhes] = useState<ViagemDetalhes[]>([]);
  const [carros, setCarros] = useState<Carro[]>([]);
  const [contagemCarrosMensal, setContagemCarrosMensal] = useState<ContagemCarroMensal[]>([]);
  const [carrosSelecionados, setCarrosSelecionados] = useState<number[]>([]);
  const [novoCarroNome, setNovoCarroNome] = useState<string>('');
  const [carroEditando, setCarroEditando] = useState<Carro | null>(null);
  const [carregandoCarros, setCarregandoCarros] = useState(false);
  const [dialogCarrosAberto, setDialogCarrosAberto] = useState(false);

  const viagensService = new ViagensService();

  // Carregar dados das viagens do Supabase ao iniciar
  useEffect(() => {
    const carregarDados = async () => {
      if (!obraId) return;
      
      setLoadingInitial(true);
      try {
        // Carregar viagens existentes
        const viagensData = await viagensService.buscarViagensPorObra(obraId);
        setDiasComViagem(viagensData);
        
        // Carregar detalhes das viagens (com pessoas)
        const detalhes = await viagensService.buscarViagensDetalhesPorObra(obraId);
        setViagensDetalhes(detalhes);
        
        // Carregar contagem mensal
        const contagem = await viagensService.buscarContagemMensal(obraId);
        setContagemMensal(contagem);

        // Carregar carros
        const carrosData = await viagensService.listarCarros();
        setCarros(carrosData);

        // Carregar contagem de carros mensal
        const contagemCarrosData = await viagensService.buscarContagemCarrosMensal(obraId);
        setContagemCarrosMensal(contagemCarrosData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados das viagens');
      } finally {
        setLoadingInitial(false);
      }
    };

    carregarDados();
  }, [obraId]);

  // ===== FUNÇÕES PARA GESTÃO DE CARROS =====

  const handleAdicionarCarro = async () => {
    if (!novoCarroNome.trim()) {
      toast.error('Digite o nome do carro');
      return;
    }

    setCarregandoCarros(true);
    try {
      await viagensService.adicionarCarro(novoCarroNome.trim());
      setNovoCarroNome('');
      toast.success('Carro adicionado com sucesso!');
      
      // Recarregar lista de carros
      const carrosData = await viagensService.listarCarros();
      setCarros(carrosData);
    } catch (error) {
      console.error('Erro ao adicionar carro:', error);
      toast.error('Erro ao adicionar carro');
    } finally {
      setCarregandoCarros(false);
    }
  };

  const handleEditarCarro = async () => {
    if (!carroEditando || !carroEditando.nome.trim()) {
      toast.error('Digite o nome do carro');
      return;
    }

    setCarregandoCarros(true);
    try {
      await viagensService.atualizarCarro(carroEditando.id, carroEditando.nome.trim());
      setCarroEditando(null);
      toast.success('Carro atualizado com sucesso!');
      
      // Recarregar lista de carros
      const carrosData = await viagensService.listarCarros();
      setCarros(carrosData);
    } catch (error) {
      console.error('Erro ao editar carro:', error);
      toast.error('Erro ao editar carro');
    } finally {
      setCarregandoCarros(false);
    }
  };

  const handleRemoverCarro = async (carroId: number, carroNome: string) => {
    if (!confirm(`Tem certeza que deseja remover o carro "${carroNome}"?`)) {
      return;
    }

    setCarregandoCarros(true);
    try {
      await viagensService.removerCarro(carroId);
      toast.success('Carro removido com sucesso!');
      
      // Recarregar lista de carros
      const carrosData = await viagensService.listarCarros();
      setCarros(carrosData);
    } catch (error) {
      console.error('Erro ao remover carro:', error);
      toast.error('Erro ao remover carro');
    } finally {
      setCarregandoCarros(false);
    }
  };

  const handleToggleCarroSelecionado = (carroId: number) => {
    setCarrosSelecionados(prev => {
      if (prev.includes(carroId)) {
        return prev.filter(id => id !== carroId);
      } else {
        return [...prev, carroId];
      }
    });
  };

  // Função para abrir o dialog ao clicar no dia
  const handleDayClick = async (date: Date) => {
    setSelectedDate(date);
    const dateString = format(date, 'yyyy-MM-dd');

    if (!obraId) return;

    try {
      const detalhesViagem = await viagensService.buscarDetalhesViagem(obraId, dateString);

      if (detalhesViagem) {
        setIsViagem(true);
        setPessoas(detalhesViagem.pessoas || '');
        setCarrosSelecionados(detalhesViagem.carros_ids || []);
      } else {
        setIsViagem(false);
        setPessoas('');
        setCarrosSelecionados([]);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da viagem:', error);
      toast.error('Erro ao carregar dados da viagem.');
      // Reseta para um estado seguro em caso de erro
      setIsViagem(false);
      setPessoas('');
      setCarrosSelecionados([]);
    }

    setShowDialog(true);
  };

  // Função para marcar/desmarcar viagem
  const handleSalvar = async () => {
    if (!selectedDate || !obraId) return;

    setLoading(true);
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pessoasTexto = pessoas.trim();
      
      if (isViagem && !diasComViagem.includes(dateString)) {
        // Marcar nova viagem com carros
        await viagensService.marcarViagemComCarros(obraId, dateString, pessoasTexto, carrosSelecionados);
        toast.success('Viagem marcada com sucesso!');
      } else if (isViagem && diasComViagem.includes(dateString)) {
        // Atualizar viagem existente com carros
        await viagensService.atualizarViagemComCarros(obraId, dateString, pessoasTexto, carrosSelecionados);
        toast.success('Viagem atualizada com sucesso!');
      } else if (!isViagem && diasComViagem.includes(dateString)) {
        // Desmarcar viagem
        await viagensService.desmarcarViagem(obraId, dateString);
        toast.success('Viagem desmarcada com sucesso!');
      }
      
      // Recarregar todos os dados
      const viagensData = await viagensService.buscarViagensPorObra(obraId);
      setDiasComViagem(viagensData);
      
      const detalhes = await viagensService.buscarViagensDetalhesPorObra(obraId);
      setViagensDetalhes(detalhes);
      
      const contagem = await viagensService.buscarContagemMensal(obraId);
      setContagemMensal(contagem);
      
      // Recarregar contagem de carros
      const contagemCarrosData = await viagensService.buscarContagemCarrosMensal(obraId);
      setContagemCarrosMensal(contagemCarrosData);
      
      setShowDialog(false);
      setPessoas('');
      setCarrosSelecionados([]);
    } catch (error) {
      console.error('Erro ao salvar viagem:', error);
      toast.error('Erro ao salvar viagem');
    } finally {
      setLoading(false);
    }
  };

  // Customização visual dos dias
  const tileClassName = ({ date }: { date: Date }) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return diasComViagem.includes(dateString) ? 'bg-blue-200 text-blue-900 font-bold rounded-full' : '';
  };

  if (loadingInitial) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="ml-2">Carregando viagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Viagens - Controle de Deslocamentos</h2>

      <Card className="p-4 max-w-xl mx-auto">
        <Calendar
          locale="pt-BR"
          tileClassName={tileClassName}
          onClickDay={handleDayClick}
        />
      </Card>

      {/* Tabela de contagem mensal */}
      {contagemMensal && contagemMensal.length > 0 && (
        <Card className="p-4 mt-6 max-w-xl mx-auto">
          <h3 className="text-lg font-semibold mb-3">Viagens por mês</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Mês</th>
                <th className="text-left">Ano</th>
                <th className="text-right">Total de Viagens</th>
              </tr>
            </thead>
            <tbody>
              {contagemMensal
                .filter(item => {
                  // Só mostra mês atual ou meses anteriores que já tenham viagens
                  const agora = new Date();
                  const mesAtual = agora.getMonth() + 1;
                  const anoAtual = agora.getFullYear();
                  return (
                    item.ano < anoAtual ||
                    (item.ano === anoAtual && item.mesNum <= mesAtual)
                  );
                })
                .map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.mes}</td>
                    <td>{item.ano}</td>
                    <td className="text-right font-bold">{item.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Contagem de viagens por carro por mês */}
      {carros.length > 0 && (
        <Card className="p-4 mt-6 max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Carros</CardTitle>
          </CardHeader>
          <CardContent>
            {contagemCarrosMensal.length > 0 ? (
              <div className="space-y-4">
                {contagemCarrosMensal.map((mes, index) => (
                  <div key={index}>
                    <h4 className="font-semibold mb-2">{mes.mes} {mes.ano}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Carro</TableHead>
                          <TableHead className="text-right">Viagens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mes.carros
                          .filter(carro => carro.total > 0)
                          .map((carro) => (
                            <TableRow key={carro.id}>
                              <TableCell>{carro.nome}</TableCell>
                              <TableCell className="text-right font-medium">
                                {carro.total}
                              </TableCell>
                            </TableRow>
                          ))}
                        {mes.carros.every(carro => carro.total === 0) && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-gray-500">
                              Nenhuma viagem com carros neste mês
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                <p>Nenhuma viagem com carros registrada ainda.</p>
                <p className="text-sm mt-2">
                  Marque uma viagem e selecione os carros utilizados para ver o relatório aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gerenciamento de carros */}
      <Card className="p-4 mt-6 max-w-xl mx-auto">
        <h3 className="text-lg font-semibold mb-3">Gerenciamento de Carros</h3>
        <div className="flex flex-col gap-4">
          <Button
            onClick={() => setDialogCarrosAberto(true)}
            size="sm"
            variant="outline"
          >
            Editar carros
          </Button>
        </div>
      </Card>

      {/* Modal de gestão de carros */}
      <Dialog open={dialogCarrosAberto} onOpenChange={setDialogCarrosAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Carros</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Adicionar novo carro */}
            <div className="flex gap-2">
              <Input
                value={novoCarroNome}
                onChange={(e) => setNovoCarroNome(e.target.value)}
                placeholder="Nome do carro"
                disabled={carregandoCarros}
                onKeyPress={(e) => e.key === 'Enter' && handleAdicionarCarro()}
              />
              <Button
                onClick={handleAdicionarCarro}
                disabled={carregandoCarros || !novoCarroNome.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Lista de carros */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {carros.map((carro) => (
                <div key={carro.id} className="flex items-center justify-between p-2 border rounded">
                  {carroEditando?.id === carro.id ? (
                    <div className="flex gap-2 flex-1">
                      <Input
                        value={carroEditando.nome}
                        onChange={(e) => setCarroEditando({ ...carroEditando, nome: e.target.value })}
                        disabled={carregandoCarros}
                        onKeyPress={(e) => e.key === 'Enter' && handleEditarCarro()}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleEditarCarro}
                        disabled={carregandoCarros}
                        size="sm"
                        variant="outline"
                      >
                        Salvar
                      </Button>
                      <Button
                        onClick={() => setCarroEditando(null)}
                        disabled={carregandoCarros}
                        size="sm"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1">{carro.nome}</span>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => setCarroEditando(carro)}
                          disabled={carregandoCarros}
                          size="sm"
                          variant="ghost"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => handleRemoverCarro(carro.id, carro.nome)}
                          disabled={carregandoCarros}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {carros.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum carro cadastrado
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para marcar/desmarcar viagem */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Viagem</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 items-center">
            <span className="text-lg font-medium">
              {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
            </span>
            <div className="flex items-center gap-2">
              <Switch checked={isViagem} onCheckedChange={setIsViagem} />
              <span>{isViagem ? 'Teve viagem neste dia' : 'Não teve viagem neste dia'}</span>
            </div>
            {isViagem && (
              <div className="w-full flex flex-col gap-2">
                <Label htmlFor="pessoas">Pessoas que participaram da viagem:</Label>
                <Textarea
                  id="pessoas"
                  value={pessoas}
                  onChange={(e) => setPessoas(e.target.value)}
                  placeholder="Digite os nomes das pessoas separados por vírgula"
                  className="min-h-[80px]"
                />
              </div>
            )}
            {isViagem && (
              <div className="space-y-2">
                <Label>Carros utilizados na viagem:</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {carros.map((carro) => (
                    <div key={carro.id} className="flex items-center space-x-2">
                      <Switch
                        id={`carro-${carro.id}`}
                        checked={carrosSelecionados.includes(carro.id)}
                        onCheckedChange={() => handleToggleCarroSelecionado(carro.id)}
                      />
                      <Label htmlFor={`carro-${carro.id}`} className="text-sm">
                        {carro.nome}
                      </Label>
                    </div>
                  ))}
                  {carros.length === 0 && (
                    <p className="text-sm text-gray-500">
                      Nenhum carro cadastrado. Use o botão "Editar carros" para adicionar.
                    </p>
                  )}
                </div>
              </div>
            )}
            <Button 
              onClick={handleSalvar} 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 