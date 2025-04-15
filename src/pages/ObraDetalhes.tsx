import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Building2, Calendar as CalendarIcon, DollarSign, FileText, Plus, Pencil, CalendarDays, AlertCircle, FileUp, ListTodo, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from '@/lib/supabase';
import FluxogramaObra from '@/components/FluxogramaObra';
import EditarEtapasObra from '@/components/EditarEtapasObra';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buscarObra, listarRegistrosDiario, gerarRelatorioSemanal, atualizarObra } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import GraficoEtapas from '@/components/GraficoEtapas';
import { obterQuadroObra, criarLista, criarCard } from '@/lib/trello-local';

interface DiarioRegistro {
  id: number;
  data: string;
  descricao: string;
  observacoes: string;
  fotos: string[];
  obra_id: number;
  etapas_iniciadas: string[];
  etapas_concluidas: string[];
  etapas_info?: {
    [etapa: string]: {
      data_inicio?: string;
      data_conclusao?: string;
      duracao_dias?: number;
    };
  };
}

interface Obra {
  id: number;
  nome: string;
  endereco: string;
  data_inicio: string;
  data_fim_prevista: string;
  status: string;
  progresso: number;
  custo_previsto: number;
  custo_real: number;
  responsavel?: string;
  trello_board_id?: string;
  definicoes_board_id?: string;
}

interface EtapaComDatas {
  etapa_nome: string;
  data_inicio: string;
  data_fim?: string;
  status: 'em_andamento' | 'concluida';
}

interface DefinicaoCard {
  id: string;
  title: string;
  description?: string;
  attachments?: string[];
  checklists?: {
    id: string;
    title: string;
    items: {
      id: string;
      text?: string;
      title?: string;
      checked: boolean;
    }[];
  }[];
  labels?: (string | { title?: string; color?: string })[];
}

interface DefinicaoLista {
  id: string;
  title: string;
  cards: DefinicaoCard[];
}

interface DefinicaoQuadro {
  id: string;
  nome?: string;
  title?: string;
  lists: DefinicaoLista[];
}

const ObraDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [obra, setObra] = useState<Obra | null>(null);
  const [etapas, setEtapas] = useState<EtapaComDatas[]>([]);
  const [registrosDiario, setRegistrosDiario] = useState<DiarioRegistro[]>([]);
  const [datasComRegistro, setDatasComRegistro] = useState<Date[]>([]);
  const [data, setData] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [etapasStatus, setEtapasStatus] = useState<{[key: string]: 'pendente' | 'em_andamento' | 'concluida'}>({});
  const [numeroPendencias, setNumeroPendencias] = useState(0);
  const [showEditarEtapas, setShowEditarEtapas] = useState(false);
  const [etapasFluxograma, setEtapasFluxograma] = useState<string[]>([]);
  const [etapasConfig, setEtapasConfig] = useState<{ id: string; nome: string; position: { x: number; y: number } }[]>([]);
  const [definicoesQuadro, setDefinicoesQuadro] = useState<DefinicaoQuadro | null>(null);
  const [numeroDefinicoes, setNumeroDefinicoes] = useState({ definir: 0, definido: 0 });
  
  console.log('[DEBUG-INIT] Estado inicial do componente ObraDetalhes');
  console.log('[DEBUG-INIT] numeroDefinicoes inicial:', numeroDefinicoes);
  
  // Log para monitorar o ciclo de vida do componente
  useEffect(() => {
    console.log('[DEBUG-LIFECYCLE] ObraDetalhes montado');
    
    return () => {
      console.log('[DEBUG-LIFECYCLE] ObraDetalhes desmontado');
    };
  }, []);

  const calcularProgresso = (registros: DiarioRegistro[]) => {
    try {
      // Usar as etapas do fluxograma carregadas do banco
      const todasEtapas = etapasFluxograma.length > 0 
        ? etapasFluxograma 
        : [
            'Serviços Preliminares', 'Terraplenagem', 'Fundação', 'Alvenaria', 'Estrutura',
            'Passagens Elétricas', 'Passagens Hidráulicas', 'Laje', 'Cobertura',
            'Instalações Elétricas', 'Instalações Hidráulicas', 'Reboco', 'Regularização',
            'Revestimento', 'Gesso', 'Marmoraria', 'Pintura', 'Esquadrias', 'Limpeza Bruta',
            'Marcenaria', 'Metais', 'Limpeza Final'
          ];

      const etapasStatus: { [key: string]: 'pendente' | 'em_andamento' | 'concluida' } = {};
      todasEtapas.forEach(etapa => {
        etapasStatus[etapa] = 'pendente';
      });

      registros.forEach(registro => {
        registro.etapas_iniciadas?.forEach(etapa => {
          if (etapasStatus[etapa] !== 'concluida') {
            etapasStatus[etapa] = 'em_andamento';
          }
        });

        registro.etapas_concluidas?.forEach(etapa => {
          etapasStatus[etapa] = 'concluida';
        });
      });

      const etapasConcluidas = Object.values(etapasStatus).filter(status => status === 'concluida').length;
      return Math.round((etapasConcluidas / todasEtapas.length) * 100);
    } catch (error) {
      console.error('Erro ao calcular progresso:', error);
      return 0;
    }
  };

  useEffect(() => {
    if (!id) {
      toast({
        title: "Erro",
        description: "ID da obra não fornecido",
        variant: "destructive"
      });
      navigate('/obras');
      return;
    }
    carregarDados();
    carregarEtapasFluxograma();
    carregarPendencias();
  }, [id]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      const obraData = await buscarObra(Number(id));
      if (!obraData) {
        throw new Error('Obra não encontrada');
      }
      
      setObra(obraData);
      setEtapas(obraData.etapas || []);

      const registros = await listarRegistrosDiario(Number(id));
      setRegistrosDiario(registros);
      
      const datas = registros.map(reg => parseISO(reg.data));
      setDatasComRegistro(datas);

      // Carregar pendências e definições explicitamente após ter os dados da obra
      console.log('[DEBUG] Obra carregada no carregarDados, chamando carregarPendencias e carregarDefinicoes');
      await carregarPendencias();
      await carregarDefinicoes();

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados da obra');
      toast({
        title: "Erro ao carregar obra",
        description: error instanceof Error ? error.message : 'Não foi possível carregar os dados da obra. Verifique sua conexão e tente novamente.',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar as etapas do fluxograma do banco de dados
  const carregarEtapasFluxograma = async () => {
    try {
      if (!id) return;
      
      console.log("[DEBUG] Carregando etapas do fluxograma para obra_id:", id);
      
      // Buscar etapas da obra do banco de dados (tabela etapas_fluxograma)
      const { data: etapasFluxogramaDatas, error: errorFluxograma } = await supabase
        .from('etapas_fluxograma')
        .select('*')
        .eq('obra_id', Number(id));

      if (errorFluxograma) {
        console.error("[DEBUG] Erro ao buscar etapas_fluxograma:", errorFluxograma);
        throw errorFluxograma;
      }

      console.log("[DEBUG] Etapas do fluxograma carregadas:", etapasFluxogramaDatas);

      // Se houver etapas cadastradas na tabela etapas_fluxograma, usar essas etapas
      if (etapasFluxogramaDatas && etapasFluxogramaDatas.length > 0) {
        // Extrair apenas os nomes das etapas para o estado etapasFluxograma
        const etapasNomes = etapasFluxogramaDatas.map(etapa => etapa.nome);
        setEtapasFluxograma(etapasNomes);
        
        // Criar configurações completas das etapas para o componente FluxogramaObra
        const etapasConfigCompleto = etapasFluxogramaDatas.map(etapa => ({
          id: etapa.id.toString(),
          nome: etapa.nome,
          position: etapa.position || { x: 0, y: 0 }
        }));
        setEtapasConfig(etapasConfigCompleto);
        
        console.log('[DEBUG] Etapas carregadas da tabela etapas_fluxograma:', etapasNomes);
        console.log('[DEBUG] Configurações completas das etapas:', etapasConfigCompleto);
        return;
      }
      
      // Se não encontrou na tabela etapas_fluxograma, tentar na tabela etapas_datas
      const { data: etapasDatas, error } = await supabase
        .from('etapas_datas')
        .select('etapa_nome')
        .eq('obra_id', Number(id));

      if (error) {
        console.error("[DEBUG] Erro ao buscar etapas_datas:", error);
        throw error;
      }

      // Se houver etapas cadastradas na tabela etapas_datas, usar essas etapas
      if (etapasDatas && etapasDatas.length > 0) {
        const etapasNomes = etapasDatas.map(etapa => etapa.etapa_nome);
        setEtapasFluxograma(etapasNomes);
        console.log('[DEBUG] Etapas carregadas da tabela etapas_datas:', etapasNomes);
        
        // Neste caso, não temos as posições, então usamos o padrão
        setEtapasConfig([]);
      } else {
        // Se não houver etapas cadastradas em nenhuma tabela, usar as etapas padrão
        const etapasPadrao = [
          'Serviços Preliminares', 'Terraplenagem', 'Fundação', 'Alvenaria', 'Estrutura',
          'Passagens Elétricas', 'Passagens Hidráulicas', 'Laje', 'Cobertura',
          'Instalações Elétricas', 'Instalações Hidráulicas', 'Reboco', 'Regularização',
          'Revestimento', 'Gesso', 'Marmoraria', 'Pintura', 'Esquadrias', 'Limpeza Bruta',
          'Marcenaria', 'Metais', 'Limpeza Final'
        ];
        setEtapasFluxograma(etapasPadrao);
        console.log('[DEBUG] Usando etapas padrão:', etapasPadrao);
        
        // Neste caso, não temos as posições, então usamos o padrão
        setEtapasConfig([]);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar etapas do fluxograma:', error);
      // Em caso de erro, usar as etapas padrão
      const etapasPadrao = [
        'Serviços Preliminares', 'Terraplenagem', 'Fundação', 'Alvenaria', 'Estrutura',
        'Passagens Elétricas', 'Passagens Hidráulicas', 'Laje', 'Cobertura',
        'Instalações Elétricas', 'Instalações Hidráulicas', 'Reboco', 'Regularização',
        'Revestimento', 'Gesso', 'Marmoraria', 'Pintura', 'Esquadrias', 'Limpeza Bruta',
        'Marcenaria', 'Metais', 'Limpeza Final'
      ];
      setEtapasFluxograma(etapasPadrao);
      
      // Neste caso, não temos as posições, então usamos o padrão
      setEtapasConfig([]);
    }
  };

  useEffect(() => {
    const carregarStatusEtapas = async () => {
      try {
        console.log('Carregando status das etapas...');
        const { data: etapasDatas, error } = await supabase
          .from('etapas_datas')
          .select('etapa_nome, status')
          .eq('obra_id', Number(id));

        if (error) {
          console.error('Erro ao carregar status das etapas:', error);
          throw error;
        }

        if (etapasDatas) {
          const statusMap = etapasDatas.reduce((acc, etapa) => ({
            ...acc,
            [etapa.etapa_nome]: etapa.status || 'pendente'
          }), {} as { [key: string]: 'pendente' | 'em_andamento' | 'concluida' });

          // Garantir que todas as etapas do fluxograma tenham um status
          const todasEtapas = etapasFluxograma.length > 0 
            ? etapasFluxograma 
            : [
                'Serviços Preliminares', 'Terraplenagem', 'Fundação', 'Alvenaria', 'Estrutura',
                'Passagens Elétricas', 'Passagens Hidráulicas', 'Laje', 'Cobertura',
                'Instalações Elétricas', 'Instalações Hidráulicas', 'Reboco', 'Regularização',
                'Revestimento', 'Gesso', 'Marmoraria', 'Pintura', 'Esquadrias', 'Limpeza Bruta',
                'Marcenaria', 'Metais', 'Limpeza Final'
              ];

          const statusMapCompleto = todasEtapas.reduce((acc, etapa) => ({
            ...acc,
            [etapa]: statusMap[etapa] || 'pendente'
          }), {} as { [key: string]: 'pendente' | 'em_andamento' | 'concluida' });
          
          console.log('Status das etapas carregado:', statusMapCompleto);
          setEtapasStatus(statusMapCompleto);
        }
      } catch (error) {
        console.error('Erro ao carregar status das etapas:', error);
        toast({
          title: "Erro ao carregar etapas",
          description: "Não foi possível carregar o status das etapas. Algumas informações podem estar incompletas.",
          variant: "destructive"
        });
      }
    };

    if (id) {
      carregarStatusEtapas();
    }
  }, [id, etapasFluxograma]);

  useEffect(() => {
    if (obra) {
      console.log('[DEBUG] Obra carregada, chamando carregarPendencias e carregarDefinicoes');
      carregarPendencias();
      carregarDefinicoes();
    }
  }, [obra]);

  const carregarPendencias = async () => {
    try {
      if (!obra) return;

      console.log('[DEBUG] Carregando pendências para obra ID:', obra.id);
      const quadro = await obterQuadroObra(obra.id);
      console.log('[DEBUG] Quadro obtido:', JSON.stringify(quadro));
      
      // Abordagem mais direta para contar pendências
      let totalPendencias = 0;
      
      // Verificar cada lista no quadro
      if (quadro && quadro.lists && Array.isArray(quadro.lists)) {
        console.log('[DEBUG] Número de listas encontradas:', quadro.lists.length);
        
        // Contar todos os cards em todas as listas como pendências
        quadro.lists.forEach(lista => {
          // Usar title ou nome, dependendo de qual estiver disponível
          const listaNome = lista.title || (lista as any).nome;
          console.log(`[DEBUG] Lista: ${listaNome}, Cards: ${lista.cards ? lista.cards.length : 0}`);
          
          // Contar todos os cards, exceto os que estão em listas chamadas "Concluído"
          if (listaNome !== 'Concluído' && lista.cards && Array.isArray(lista.cards)) {
            // Filtrar cards que não têm a etiqueta "Feito" ou "Concluído"
            const cardsSemConclusao = lista.cards.filter(card => {
              if (!card.labels || !Array.isArray(card.labels) || card.labels.length === 0) {
                return true; // Incluir cards sem etiquetas
              }
              
              // Verificar se alguma etiqueta é "Feito" ou "Concluído"
              return !card.labels.some(label => {
                const labelText = typeof label === 'string' ? label : (label.title || label.nome || String(label));
                return labelText.toLowerCase() === 'feito' || labelText.toLowerCase() === 'concluído';
              });
            });
            
            console.log(`[DEBUG] Lista ${listaNome}: ${cardsSemConclusao.length} cards sem etiqueta de conclusão`);
            totalPendencias += cardsSemConclusao.length;
          }
        });
      } else {
        console.log('[DEBUG] Quadro não possui listas ou formato inválido:', quadro);
      }
      
      console.log('[DEBUG] Total de pendências contadas:', totalPendencias);
      setNumeroPendencias(totalPendencias);
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar pendências:', error);
    }
  };

  // Nova função para carregar as definições da obra
  const carregarDefinicoes = async () => {
    try {
      if (!obra?.id) {
        console.log('[DEBUG] Obra ID não disponível para carregar definições');
        return;
      }

      console.log('[DEBUG] Carregando definições para obra ID:', obra.id);
      
      // Buscar ou criar o quadro de definições
      let quadroDefinicoes: DefinicaoQuadro | null = null;
      
      // Verificar se já existe um quadro de definições
      if (obra.definicoes_board_id) {
        try {
          console.log('[DEBUG] Buscando quadro de definições com ID:', obra.definicoes_board_id);
          // Tentar obter o quadro existente
          const { data, error } = await supabase
            .from('definicoes_quadros')
            .select('*')
            .eq('id', obra.definicoes_board_id)
            .single();
          
          if (error) {
            console.error('[DEBUG] Erro na consulta do quadro:', error);
            throw error;
          }
          
          if (data) {
            // Garantir que os dados tenham a estrutura correta 
            quadroDefinicoes = {
              id: data.id,
              title: data.title,
              nome: data.nome,
              lists: Array.isArray(data.lists) ? data.lists : []
            };
            console.log('[DEBUG] Quadro de definições obtido do banco:', JSON.stringify(quadroDefinicoes));
          } else {
            console.log('[DEBUG] Nenhum quadro encontrado com esse ID');
          }
        } catch (error) {
          console.error('[DEBUG] Erro ao buscar quadro de definições:', error);
        }
      } else {
        console.log('[DEBUG] Obra não tem definicoes_board_id');
      }
      
      // Se não existir, criar um novo quadro de definições
      if (!quadroDefinicoes) {
        console.log('[DEBUG] Criando novo quadro de definições para a obra');
        // Criar novo quadro com listas padrão
        quadroDefinicoes = {
          id: `def_${obra.id}_${Date.now()}`,
          title: `Definições - ${obra.nome}`,
          lists: [
            {
              id: `def_list_definir_${Date.now()}`,
              title: "Definir",
              cards: []
            },
            {
              id: `def_list_definido_${Date.now()}`,
              title: "Definido",
              cards: []
            }
          ]
        };
        
        // Salvar o novo quadro no banco de dados
        const { data, error } = await supabase
          .from('definicoes_quadros')
          .insert(quadroDefinicoes)
          .select();
        
        if (error) {
          console.error('[DEBUG] Erro ao inserir novo quadro:', error);
          throw error;
        }
        
        // Atualizar o ID do quadro na obra
        if (data && data.length > 0) {
          console.log('[DEBUG] Atualizando obra com novo definicoes_board_id:', quadroDefinicoes.id);
          await atualizarObra(obra.id, { definicoes_board_id: quadroDefinicoes.id });
        }
        
        console.log('[DEBUG] Novo quadro de definições criado:', quadroDefinicoes);
      }
      
      // Verificar se o quadro tem a estrutura esperada
      if (!quadroDefinicoes || !quadroDefinicoes.lists || !Array.isArray(quadroDefinicoes.lists)) {
        console.error('[DEBUG] Estrutura do quadro inválida:', quadroDefinicoes);
        return;
      }
      
      // Atualizar o estado com o quadro de definições
      setDefinicoesQuadro(quadroDefinicoes);
      
      // Contar o número de cards em cada lista
      let definir = 0;
      let definido = 0;
      
      console.log('[DEBUG] Contando cards nas listas. Total de listas:', quadroDefinicoes.lists.length);
      
      quadroDefinicoes.lists.forEach(lista => {
        const listaTitle = lista.title || '';
        const numCards = Array.isArray(lista.cards) ? lista.cards.length : 0;
        console.log(`[DEBUG] Lista "${listaTitle}" tem ${numCards} cards`);
        
        if (listaTitle.toLowerCase() === "definir" && Array.isArray(lista.cards)) {
          definir = lista.cards.length;
        } else if (listaTitle.toLowerCase() === "definido" && Array.isArray(lista.cards)) {
          definido = lista.cards.length;
        }
      });
      
      console.log('[DEBUG] Resultado da contagem - Definir:', definir, 'Definido:', definido);
      
      // Atualizar o estado com os números corretos
      setNumeroDefinicoes({ 
        definir: definir, 
        definido: definido 
      });
      
      // Atualizar diretamente o estado de exibição também para garantir a atualização na UI
      const total = definido + definir;
      console.log('[DEBUG] Atualizando diretamente definicaoDisplay para:', { definido, total });
      setDefinicaoDisplay({
        definido: definido,
        total: total
      });
      
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar definições:', error);
    }
  };

  const CORES_STATUS = {
    concluido: "#4CAF50",
    em_andamento: "#FFC107",
    pendente: "#F44336"
  };

  const dadosCustoPorEtapa = etapas.map(etapa => ({
    name: etapa.nome,
    value: etapa.custo,
    status: etapa.status
  }));

  const dadosCustoTotal = [
    { name: "Realizado", value: obra?.custoReal || 0 },
    { name: "Restante", value: (obra?.custoPrevisto || 0) - (obra?.custoReal || 0) }
  ];

  const tileClassName = ({ date }: { date: Date }) => {
    return datasComRegistro.some(d => 
      d.getDate() === date.getDate() && 
      d.getMonth() === date.getMonth() && 
      d.getFullYear() === date.getFullYear()
    ) ? 'bg-blue-100' : '';
  };

  const handleVoltar = () => {
    navigate('/obras');
  };

  const handleDiarioClick = () => {
    navigate(`/obras/${id}/diario`);
  };

  // Função para recarregar os dados após editar as etapas
  const handleEtapasEditadas = async () => {
    try {
      console.log("Iniciando recarregamento de dados após edição de etapas");
      setShowEditarEtapas(false);
      
      // Recarregar dados da obra
      await carregarDados();
      
      // Recarregar etapas do fluxograma
      await carregarEtapasFluxograma();
      
      // Forçar atualização do estado para garantir que a UI seja atualizada
      setEtapasStatus(prevState => ({...prevState}));
      
      console.log("Dados recarregados com sucesso após edição de etapas");
      
      toast({
        title: "Sucesso",
        description: "Etapas da obra atualizadas com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao recarregar dados após edição de etapas:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar as etapas da obra.",
        variant: "destructive"
      });
    }
  };

  // Função para navegar para a página de definições
  const handleDefinicoesClick = () => {
    navigate(`/obras/${id}/definicoes`);
  };

  // Calcula o progresso geral da obra com base nos registros
  const progressoGeral = obra?.progresso || calcularProgresso(registrosDiario);

  // Atualiza o display para mostrar definições no formato correto
  const [definicaoDisplay, setDefinicaoDisplay] = useState({
    definido: 0,
    total: 0
  });
  
  // Este useEffect garante que o display seja atualizado sempre que numeroDefinicoes mudar
  useEffect(() => {
    console.log('[DEBUG] Atualizando definicaoDisplay com:', numeroDefinicoes);
    console.log('[DEBUG] Estado atual de definicaoDisplay antes da atualização:', definicaoDisplay);
    
    const total = numeroDefinicoes.definido + numeroDefinicoes.definir;
    
    console.log('[DEBUG] Valores calculados - definido:', numeroDefinicoes.definido, 'total:', total);
    
    setDefinicaoDisplay({
      definido: numeroDefinicoes.definido,
      total: total
    });
    
    // Log após o setState para verificar se o estado foi modificado corretamente
    console.log('[DEBUG] definicaoDisplay deveria estar atualizado para:', {
      definido: numeroDefinicoes.definido,
      total: total
    });
  }, [numeroDefinicoes]);

  // Adicionando um segundo useEffect para monitorar quando definicaoDisplay é atualizado
  useEffect(() => {
    console.log('[DEBUG] definicaoDisplay foi atualizado para:', definicaoDisplay);
  }, [definicaoDisplay]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Carregando dados da obra...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/obras')}>
            Voltar para Obras
          </Button>
          <Button onClick={carregarDados}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-gray-600 mb-4">Obra não encontrada</p>
        <Button onClick={() => navigate('/obras')}>
          Voltar para Obras
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {showEditarEtapas ? (
        <EditarEtapasObra 
          obraId={Number(id)} 
          onClose={() => setShowEditarEtapas(false)} 
          onSave={handleEtapasEditadas} 
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div className="mb-4 md:mb-0">
                <h2 className="text-xl md:text-2xl font-bold truncate">{obra?.nome}</h2>
                <p className="text-gray-600 text-sm md:text-base truncate">{obra?.endereco}</p>
              </div>
              <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                <Button variant="outline" onClick={handleVoltar} className="w-full md:w-auto">
                  Voltar
                </Button>
                <Button onClick={handleDiarioClick} className="w-full md:w-auto">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Diário de Obra
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="p-3 md:p-4 bg-gray-50 rounded-lg">
                <h3 className="text-xs md:text-sm font-medium text-gray-500">Responsável</h3>
                <p className="mt-1 text-base md:text-lg font-semibold truncate">{obra?.responsavel || 'Não informado'}</p>
              </div>
              <div className="p-3 md:p-4 bg-gray-50 rounded-lg">
                <h3 className="text-xs md:text-sm font-medium text-gray-500">Progresso Geral</h3>
                <div className="mt-1">
                  <Progress value={progressoGeral} className="h-2" />
                  <p className="mt-1 text-sm text-gray-600">{progressoGeral}% concluído</p>
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleDefinicoesClick}>
                <h3 className="text-xs md:text-sm font-medium text-gray-500">Definições</h3>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-base md:text-lg font-semibold">
                    {definicaoDisplay.definido} / {definicaoDisplay.total}
                  </p>
                  <FileUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  {numeroDefinicoes.definir} a definir, {numeroDefinicoes.definido} definidos
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <div 
                className="p-3 md:p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" 
                onClick={() => navigate(`/obras/${id}/pendencias`)}
              >
                <h3 className="text-xs md:text-sm font-medium text-gray-500">Pendências</h3>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-base md:text-lg font-semibold">{numeroPendencias}</p>
                  <AlertCircle className={`w-4 h-4 md:w-5 md:h-5 ${numeroPendencias > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  {numeroPendencias === 0 
                    ? 'Nenhuma pendência' 
                    : numeroPendencias === 1 
                      ? '1 pendência' 
                      : `${numeroPendencias} pendências`}
                </p>
              </div>

              <div 
                className="p-3 md:p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" 
                onClick={() => navigate(`/obras/${id}/demanda`)}
              >
                <h3 className="text-xs md:text-sm font-medium text-gray-500">Demanda</h3>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-base md:text-lg font-semibold">0</p>
                  <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  Itens em demanda
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base md:text-lg font-semibold">Fluxograma da Obra</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditarEtapas(true)}
                className="flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Editar Etapas
              </Button>
            </div>
            <div className="relative min-w-[600px]">
              <FluxogramaObra 
                registros={registrosDiario} 
                etapasConfig={etapasConfig.length > 0 ? etapasConfig : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {!showEditarEtapas && (
        <>
          {/* Análise de Duração */}
          <Card className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-semibold mb-2 md:mb-0">Análise de Duração das Etapas</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-end space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#22c55e] mr-2"></div>
                  <span className="text-xs md:text-sm">Concluída</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#eab308] mr-2"></div>
                  <span className="text-xs md:text-sm">Em Andamento</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <GraficoEtapas registros={registrosDiario} />
              </div>
            </div>
          </Card>

          {/* Seção 4 - Calendário */}
          <Card className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-4">Diário de Obra</h3>
            <div className="flex justify-center overflow-x-auto">
              <Calendar
                tileClassName={tileClassName}
                className="border rounded-lg p-2 md:p-4 text-sm md:text-base"
              />
            </div>
          </Card>

          {/* Seção 5 - Relatórios Semanais */}
          <Card className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-4">Relatórios Semanais</h3>
            <div className="space-y-4">
              {registrosDiario.length === 0 ? (
                <div className="flex justify-center items-center h-16 md:h-24 text-sm md:text-base text-gray-500">
                  Nenhum relatório disponível ainda
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    variant="outline" 
                    className="w-full flex justify-between items-center"
                    onClick={() => navigate(`/obras/${id}/relatorios`)}
                  >
                    <span>Ver Relatórios</span>
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Seção 6 - Relatório Final */}
          <Card className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-4">Relatório Final</h3>
            <div className="flex justify-center">
              <Button variant="outline" disabled={true}>
                <FileText className="w-4 h-4 mr-2" />
                Gerar Relatório Final
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default ObraDetalhes; 