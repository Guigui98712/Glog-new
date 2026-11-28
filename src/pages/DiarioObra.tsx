import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { buscarObra, salvarRegistroDiario, listarRegistrosDiario, excluirRegistroDiario, atualizarRegistroDiario, uploadFoto } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, MoreVertical, Pencil, Trash2, FileText, ChevronDown, Camera, Image as ImageIcon } from 'lucide-react';
import { FaCamera } from 'react-icons/fa';
import { differenceInDays } from 'date-fns';
import { ETAPAS_FLUXOGRAMA } from "../constants/etapas";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { ImageViewerDialog } from '@/components/dialogs/ImageViewerDialog';

interface Etapa {
  id: number;
  nome: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  created_at: string;
  obra_id: number;
}

interface RegistroDiario {
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

// Função para capitalizar a primeira letra de cada frase
const capitalizarPrimeiraLetra = (texto: string) => {
  if (!texto) return texto;
  
  // Divide o texto em frases (considerando pontos, exclamações e interrogações)
  return texto.split(/([.!?]\s+)/).map(frase => {
    // Se a frase estiver vazia ou for apenas pontuação, retorna como está
    if (!frase.trim() || /^[.!?]\s+$/.test(frase)) return frase;
    
    // Capitaliza a primeira letra da frase
    return frase.charAt(0).toUpperCase() + frase.slice(1);
  }).join('');
};

const DiarioObra = () => {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Inicializa a data como hoje à meia-noite no fuso horário local
  const [data, setData] = useState<Date>(() => {
    const hoje = new Date();
    // Garantir que a data seja criada sem problemas de fuso horário
    return new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0));
  });
  
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosEdicaoPendentes, setFotosEdicaoPendentes] = useState<File[]>([]);
  const [registrosAnteriores, setRegistrosAnteriores] = useState<RegistroDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [registroSelecionado, setRegistroSelecionado] = useState<RegistroDiario | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [registroEmEdicao, setRegistroEmEdicao] = useState<RegistroDiario | null>(null);
  const [etapasIniciadas, setEtapasIniciadas] = useState<string[]>([]);
  const [etapasConcluidas, setEtapasConcluidas] = useState<string[]>([]);
  const [etapasDisponiveis, setEtapasDisponiveis] = useState<string[]>([]);
  const [etapasEmAndamento, setEtapasEmAndamento] = useState<string[]>([]);
  const [etapasFluxograma, setEtapasFluxograma] = useState<{ id: string; nome: string }[]>([]);
  const [platform, setPlatform] = useState<string>('web');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const previewsFotos = useMemo(() => fotos.map(foto => URL.createObjectURL(foto)), [fotos]);
  const previewsFotosEdicao = useMemo(
    () => fotosEdicaoPendentes.map(foto => URL.createObjectURL(foto)),
    [fotosEdicaoPendentes]
  );

  useEffect(() => () => {
    previewsFotos.forEach(url => URL.revokeObjectURL(url));
    previewsFotosEdicao.forEach(url => URL.revokeObjectURL(url));
  }, [previewsFotos, previewsFotosEdicao]);

  useEffect(() => {
    const checkPlatform = async () => {
      const currentPlatform = Capacitor.getPlatform();
      setPlatform(currentPlatform);
      console.log('[DEBUG] Plataforma detectada:', currentPlatform);
    };
    checkPlatform();

    const init = async () => {
      try {
        if (!obraId) {
          toast({
            title: "Erro",
            description: "ID da obra não fornecido",
            variant: "destructive"
          });
          navigate('/obras');
          return;
        }
        await carregarDados();
        await carregarEtapasFluxograma();
      } catch (error) {
        console.error('Erro na inicialização:', error);
        setError('Erro ao inicializar a página');
      }
    };
    
    init();
  }, [obraId]);

  useEffect(() => {
    const atualizarEtapasDisponiveis = () => {
      // Todas as etapas que já foram iniciadas em registros anteriores
      const todasEtapasIniciadas = registrosAnteriores.flatMap(reg => reg.etapas_iniciadas || []);
      // Todas as etapas que já foram concluídas
      const todasEtapasConcluidas = registrosAnteriores.flatMap(reg => reg.etapas_concluidas || []);
      
      // Etapas que estão em andamento (iniciadas mas não concluídas)
      const emAndamento = todasEtapasIniciadas.filter(etapa => !todasEtapasConcluidas.includes(etapa));
      
      // Etapas disponíveis para iniciar (não iniciadas ainda)
      const disponiveis = etapasFluxograma
        .filter(etapa => !todasEtapasIniciadas.includes(etapa.id) && !todasEtapasIniciadas.includes(etapa.nome))
        .map(etapa => etapa.nome);
      
      console.log('[DEBUG] Etapas em andamento:', emAndamento);
      console.log('[DEBUG] Etapas disponíveis:', disponiveis);
      
      setEtapasEmAndamento(emAndamento);
      setEtapasDisponiveis(disponiveis);
    };

    atualizarEtapasDisponiveis();
  }, [registrosAnteriores, etapasFluxograma]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DEBUG] Carregando dados para obra:', obraId);

      if (!obraId) {
        throw new Error('ID da obra não fornecido');
      }

      const registros = await listarRegistrosDiario(Number(obraId));
      console.log('[DEBUG] Registros carregados:', registros);
      
      if (!Array.isArray(registros)) {
        throw new Error('Formato de dados inválido');
      }
      
      const registrosProcessados = registros.map(reg => ({
        ...reg,
        fotos: Array.isArray(reg.fotos) ? reg.fotos : []
      }));
      
      setRegistrosAnteriores(registrosProcessados);

    } catch (error) {
      console.error('[DEBUG] Erro ao carregar dados:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar os registros do diário';
      setError(mensagem);
      toast({
        title: "Erro",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarEtapasFluxograma = async () => {
    try {
      console.log('[DEBUG] Carregando etapas do fluxograma para a obra:', obraId);
      const { data, error } = await supabase
        .from('etapas_fluxograma')
        .select('*')
        .eq('obra_id', obraId);

      if (error) {
        console.error('[DEBUG] Erro ao carregar etapas:', error);
        setEtapasFluxograma(ETAPAS_FLUXOGRAMA);
        console.log('[DEBUG] Usando etapas padrão:', ETAPAS_FLUXOGRAMA);
        return;
      }

      if (data && data.length > 0) {
        const etapasFormatadas = data.map(etapa => ({
          id: etapa.id.toString(),
          nome: etapa.nome
        }));
        setEtapasFluxograma(etapasFormatadas);
        console.log('[DEBUG] Etapas carregadas do banco:', etapasFormatadas);
      } else {
        setEtapasFluxograma(ETAPAS_FLUXOGRAMA);
        console.log('[DEBUG] Nenhuma etapa encontrada, usando padrão:', ETAPAS_FLUXOGRAMA);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao processar etapas:', error);
      setEtapasFluxograma(ETAPAS_FLUXOGRAMA);
    }
  };

  const handleSalvar = async () => {
    if (!obraId || !descricao.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Por favor, preencha a descrição da atividade realizada na obra.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSalvando(true);
      console.log('[DEBUG] Iniciando salvamento do registro');
      
      const fotosUrls = [];
      for (const foto of fotos) {
        try {
          console.log('[DEBUG] Processando foto:', {
            nome: foto.name,
            tipo: foto.type,
            tamanho: foto.size
          });

          const resultado = await uploadFoto(foto);
          fotosUrls.push(resultado);
          console.log('[DEBUG] Foto processada com sucesso:', resultado);
        } catch (error) {
          console.error('[DEBUG] Erro ao fazer upload da foto:', error);
          toast({
            title: "Erro no upload de imagens",
            description: error instanceof Error ? error.message : "Não foi possível enviar uma ou mais fotos. Verifique o tamanho e formato das imagens.",
            variant: "destructive"
          });
          setSalvando(false);
          return;
        }
      }
      
      // Formata a data mantendo o dia correto, usando UTC para evitar problemas de fuso horário
      const dataObj = new Date(data);
      const dataFormatada = format(new Date(Date.UTC(dataObj.getFullYear(), dataObj.getMonth(), dataObj.getDate(), 12, 0, 0)), 'yyyy-MM-dd');
      
      // Capitalizar os textos antes de salvar
      const descricaoCapitalizada = capitalizarPrimeiraLetra(descricao);
      const observacoesCapitalizadas = capitalizarPrimeiraLetra(observacoes);
      
      // Converter IDs para nomes de etapas
      const etapasIniciadasNomes = etapasIniciadas.map(id => {
        const etapa = etapasFluxograma.find(e => e.id === id);
        return etapa ? etapa.nome : id;
      });
      
      const registro = {
        obra_id: Number(obraId),
        data: dataFormatada,
        descricao: descricaoCapitalizada,
        observacoes: observacoesCapitalizadas,
        fotos: fotosUrls,
        etapas_iniciadas: etapasIniciadasNomes,
        etapas_concluidas: etapasConcluidas
      };

      console.log('[DEBUG] Registro a ser salvo:', JSON.stringify(registro, null, 2));
      
      try {
        const resultado = await salvarRegistroDiario(registro);
        console.log('[DEBUG] Resultado do salvamento:', resultado);
        await carregarDados();
        
        setDescricao('');
        setObservacoes('');
        setFotos([]);
        setEtapasIniciadas([]);
        setEtapasConcluidas([]);

        toast({
          title: "Registro salvo com sucesso! 📝",
          description: "O registro do diário de obra foi salvo e está disponível para consulta.",
        });
      } catch (err) {
        console.error('[DEBUG] Erro específico ao salvar no Supabase:', err);
        toast({
          title: "Erro no banco de dados",
          description: `Não foi possível salvar o registro: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Tente novamente mais tarde.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao salvar registro:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível salvar o registro.",
        variant: "destructive"
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleEditarRegistro = (registro: RegistroDiario) => {
    setRegistroEmEdicao(registro);
    setFotosEdicaoPendentes([]);
    setShowEditDialog(true);
  };

  const handleSalvarEdicao = async () => {
    if (!registroEmEdicao || !obraId) return;

    try {
      setSalvando(true);
      console.log('[DEBUG] Iniciando atualização do registro:', registroEmEdicao.id);

      const novasFotos: string[] = [];
      for (const foto of fotosEdicaoPendentes) {
        novasFotos.push(await uploadFoto(foto));
      }
      
      // Converter IDs para nomes de etapas se necessário
      let etapasIniciadas = registroEmEdicao.etapas_iniciadas;
      
      // Se algumas etapas estão como ID, converta para nome
      if (etapasIniciadas && etapasIniciadas.some(id => etapasFluxograma.some(e => e.id === id))) {
        etapasIniciadas = etapasIniciadas.map(id => {
          const etapa = etapasFluxograma.find(e => e.id === id);
          return etapa ? etapa.nome : id;
        });
      }
      
      // Preparar dados para atualização
      const dadosAtualizacao = {
        descricao: registroEmEdicao.descricao,
        observacoes: registroEmEdicao.observacoes,
        fotos: [...(registroEmEdicao.fotos || []), ...novasFotos],
        etapas_iniciadas: etapasIniciadas || [],
        etapas_concluidas: registroEmEdicao.etapas_concluidas || [],
        obra_id: Number(obraId)
      };
      
      console.log('[DEBUG] Dados para atualização:', dadosAtualizacao);
      
      await atualizarRegistroDiario(registroEmEdicao.id, dadosAtualizacao);
      await carregarDados();
      setShowEditDialog(false);
      setRegistroEmEdicao(null);
      setFotosEdicaoPendentes([]);
      
      toast({
        title: "Registro atualizado! ✅",
        description: "As informações do registro foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('[DEBUG] Erro na atualização:', error);
      toast({
        title: "Erro na atualização",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o registro. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirRegistro = async (registro: RegistroDiario) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      await excluirRegistroDiario(registro.id);
      await carregarDados();
      
      toast({
        title: "Registro excluído! 🗑️",
        description: "O registro foi removido permanentemente do diário de obra.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o registro. Ele pode estar sendo referenciado em outros lugares.",
        variant: "destructive"
      });
    }
  };

  const handleVisualizarImagens = (fotos: string[]) => {
    if (!fotos || fotos.length === 0) {
      toast({
        title: "Nenhuma foto",
        description: "Este registro não possui fotos para visualizar.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedImages(fotos);
    setShowImageViewer(true);
  };

  const handleDiaClick = (date: Date | undefined) => {
    if (!date) return;
    
    // Ajustar para meio-dia UTC para evitar problemas de fuso horário
    const dataAjustada = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
    console.log('[DEBUG] Data selecionada:', date);
    console.log('[DEBUG] Data ajustada:', dataAjustada);
    
    setData(dataAjustada);
    
    // Verificar se já existe um registro para esta data
    const dataFormatada = format(dataAjustada, 'yyyy-MM-dd');
    const registroExistente = registrosAnteriores.find(r => r.data === dataFormatada);
    
    if (registroExistente) {
      setRegistroSelecionado(registroExistente);
    } else {
      setRegistroSelecionado(null);
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (!dateStr) return;
    
    // Criar data a partir da string, ajustando para meio-dia UTC
    const dateParts = dateStr.split('-').map(Number);
    const novaData = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0));
    console.log('[DEBUG] Nova data do input:', novaData);
    
    setData(novaData);
    
    // Verificar se já existe um registro para esta data
    const registroExistente = registrosAnteriores.find(r => r.data === dateStr);
    
    if (registroExistente) {
      setRegistroSelecionado(registroExistente);
    } else {
      setRegistroSelecionado(null);
    }
  };

  const tileClassName = ({ date }: { date: Date }) => {
    // Formata a data mantendo o dia correto
    const dataFormatada = format(date, 'yyyy-MM-dd');
    
    return registrosAnteriores.some(reg => reg.data === dataFormatada)
      ? 'bg-primary/20 hover:bg-primary/30 cursor-pointer'
      : '';
  };

  const handleEtapasIniciadasChange = (novasEtapas: string[]) => {
    try {
      setEtapasIniciadas(novasEtapas);
      
      // Atualiza a descrição automaticamente com as etapas iniciadas
      const etapasAdicionadas = novasEtapas.filter(etapa => !etapasIniciadas.includes(etapa));
      if (etapasAdicionadas.length > 0) {
        const novaDescricao = descricao + (descricao ? '\n\n' : '') + 
          etapasAdicionadas.map(etapa => `Iniciada a etapa: ${etapa}`).join('\n');
        setDescricao(novaDescricao);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao atualizar etapas iniciadas:', error);
    }
  };

  const handleEtapasConcluidasChange = (novasEtapas: string[]) => {
    try {
      setEtapasConcluidas(novasEtapas);
      
      // Atualiza a descrição automaticamente com as etapas concluídas
      const etapasFinalizadas = novasEtapas.filter(etapa => !etapasConcluidas.includes(etapa));
      if (etapasFinalizadas.length > 0) {
        const dataAtual = format(data, 'yyyy-MM-dd');
        
        // Encontra a data de início de cada etapa
        const etapasInfo = etapasFinalizadas.map(etapa => {
          const registroInicio = registrosAnteriores.find(reg => 
            reg.etapas_iniciadas?.includes(etapa)
          );
          
          if (registroInicio) {
            const dataInicio = parseISO(registroInicio.data);
            const duracao = differenceInDays(parseISO(dataAtual), dataInicio) + 1;
            return `Concluída a etapa: ${etapa} (Duração: ${duracao} dias)`;
          }
          return `Concluída a etapa: ${etapa}`;
        });
        
        const novaDescricao = descricao + (descricao ? '\n\n' : '') + etapasInfo.join('\n');
        setDescricao(novaDescricao);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao atualizar etapas concluídas:', error);
    }
  };

  const handleAdicionarFoto = async (source: CameraSource, emEdicao = false) => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source
      });

      if (!image.base64String) {
        throw new Error('Imagem não capturada');
      }

      const formato = image.format.toLowerCase();
      const tiposImagem: Record<string, { mime: string; extensao: string }> = {
        jpg: { mime: 'image/jpeg', extensao: 'jpg' },
        jpeg: { mime: 'image/jpeg', extensao: 'jpg' },
        png: { mime: 'image/png', extensao: 'png' },
        webp: { mime: 'image/webp', extensao: 'webp' },
        gif: { mime: 'image/gif', extensao: 'gif' },
        avif: { mime: 'image/avif', extensao: 'avif' },
        heic: { mime: 'image/heic', extensao: 'heic' },
        heif: { mime: 'image/heif', extensao: 'heif' }
      };
      const tipoImagem = tiposImagem[formato];
      if (!tipoImagem) {
        throw new Error(`Formato de imagem não suportado: ${formato}`);
      }

      const response = await fetch(`data:${tipoImagem.mime};base64,${image.base64String}`);
      const blob = await response.blob();
      const timestamp = new Date().getTime();
      const fileName = `foto_${source === CameraSource.Camera ? 'camera' : 'galeria'}_${timestamp}.${tipoImagem.extensao}`;
      const file = new File([blob], fileName, { type: tipoImagem.mime });

      if (emEdicao) {
        setFotosEdicaoPendentes(prevFotos => [...prevFotos, file]);
      } else {
        setFotos(prevFotos => [...prevFotos, file]);
      }
      toast({
        title: source === CameraSource.Camera ? "Foto capturada" : "Foto selecionada",
        description: "A foto foi adicionada com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      if (msg.toLowerCase().includes('cancel')) return;
      toast({
        title: source === CameraSource.Camera ? "Erro ao capturar imagem" : "Erro ao selecionar foto",
        description: msg,
        variant: "destructive"
      });
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, emEdicao = false) => {
    if (event.target.files) {
      const arquivosSelecionados = Array.from(event.target.files);
      if (emEdicao) {
        setFotosEdicaoPendentes(prevFotos => [...prevFotos, ...arquivosSelecionados]);
      } else {
        setFotos(prevFotos => [...prevFotos, ...arquivosSelecionados]);
      }
      toast({
        title: "Arquivos Selecionados",
        description: `${arquivosSelecionados.length} arquivo(s) adicionado(s) para upload.`
      });
      event.target.value = '';
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-red-600 mb-4">{error}</div>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/obras')}>
            Voltar para Obras
          </Button>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-4 p-3 sm:space-y-8 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/obras/${obraId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 flex-1 text-2xl font-bold text-gray-800 sm:text-3xl">Diário de Obra</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(`/obras/${obraId}/relatorios`)}
        >
          <FileText className="mr-2 h-4 w-4" /> Relatórios
        </Button>
      </div>

      <div className="w-full min-w-0 space-y-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>

        {/* Calendário */}
        <Card className="min-w-0 p-3 sm:p-6">
          <div className="flex flex-col items-center">
            <h2 className="mb-4 text-xl font-semibold sm:mb-6 sm:text-2xl">Calendário de Registros</h2>
            <div className="flex w-full max-w-full justify-center overflow-x-auto">
              <Calendar
                mode="single"
                selected={data}
                onSelect={handleDiaClick}
                className="mx-auto rounded-lg border-2 border-primary/20 p-3 sm:p-6 bg-white shadow-lg"
                locale={ptBR}
                modifiers={{ 
                  hasRegistro: (date) => {
                    try {
                      const dataFormatada = format(date, 'yyyy-MM-dd');
                      return registrosAnteriores.some(reg => reg.data === dataFormatada);
                    } catch (error) {
                      console.error('Erro ao verificar registros:', error);
                      return false;
                    }
                  }
                }}
                modifiersClassNames={{
                  hasRegistro: 'bg-primary text-primary-foreground font-bold hover:bg-primary/80',
                  today: 'bg-secondary/20 font-bold border-2 border-secondary',
                  selected: 'bg-primary/80 text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                }}
                defaultMonth={data}
                fromDate={new Date(2024, 0, 1)}
                toDate={new Date()}
                disabled={(date) => date > new Date()}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-primary mr-2"></div>
                <span className="text-sm">Com Registro</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-secondary/20 border-2 border-secondary mr-2"></div>
                <span className="text-sm">Hoje</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Formulário */}
        <Card className="min-w-0 space-y-6 p-3 sm:p-6">
          <div>
            <Label>Data do Registro</Label>
            <Input
              type="date"
              value={format(data, 'yyyy-MM-dd')}
              onChange={handleDateInputChange}
              className="mt-1 w-full"
              max={format(new Date(), 'yyyy-MM-dd')} // Impede seleção de datas futuras
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="descricao">Descrição das Atividades</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[100px]"
                placeholder="Descreva as atividades realizadas hoje..."
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="min-h-[100px]"
                placeholder="Adicione observações importantes..."
                spellCheck="true"
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>

            {etapasFluxograma && etapasFluxograma.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Label>Etapas Iniciadas</Label>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        Selecione as etapas iniciadas
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {etapasDisponiveis.length > 0 ? (
                            etapasDisponiveis.map((etapaNome) => {
                              const etapa = etapasFluxograma.find(e => e.nome === etapaNome);
                              if (!etapa) return null;
                              return (
                                <div key={`iniciada-${etapa.id}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`iniciada-${etapa.id}`}
                                    checked={etapasIniciadas.includes(etapa.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setEtapasIniciadas([...etapasIniciadas, etapa.id]);
                                      } else {
                                        setEtapasIniciadas(etapasIniciadas.filter(id => id !== etapa.id));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`iniciada-${etapa.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {etapa.nome}
                                  </label>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-gray-500 text-center py-2">Todas as etapas já foram iniciadas</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div className="flex flex-col space-y-2">
                  <Label>Etapas Finalizadas</Label>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        Selecione as etapas a serem finalizadas
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {etapasEmAndamento.map((etapa) => (
                            <div key={`finalizada-${etapa}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`finalizada-${etapa}`}
                                checked={etapasConcluidas.includes(etapa)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setEtapasConcluidas([...etapasConcluidas, etapa]);
                                  } else {
                                    setEtapasConcluidas(etapasConcluidas.filter(id => id !== etapa));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`finalizada-${etapa}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {etapa}
                              </label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            )}

            {/* Seção de Fotos (Condicional por Plataforma) */}
            <div className="space-y-2">
              <Label htmlFor="fotos">Fotos ({fotos.length})</Label>
              <div className="flex flex-wrap items-center gap-2">
                {/* ---- Lógica Condicional ---- */}
                {platform === 'web' ? (
                  // Opção para Web: Input de Arquivo
                  <div className="relative flex-1 sm:flex-none">
                    <Input
                      id="file-upload-input" // ID para o label (opcional)
                      type="file"
                      multiple
                      accept="image/*,.heic,.heif" // Tenta aceitar HEIC
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload-input')?.click()}
                      title="Selecionar arquivos do computador"
                      className="min-h-11 w-full"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Selecionar Arquivos
                    </Button>
                  </div>
                ) : (
                  // Opção para Nativo: Botão Capacitor Camera
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAdicionarFoto(CameraSource.Photos)}
                    title="Selecionar fotos da galeria"
                    className="min-h-11 flex-1 sm:flex-none"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Selecionar da Galeria
                  </Button>
                )}
                {/* ---- Fim da Lógica Condicional ---- */}

                {/* Botão Tirar Foto (Comum a todas as plataformas) */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleAdicionarFoto(CameraSource.Camera)}
                  title="Tirar foto com a câmera"
                  aria-label="Tirar foto com a câmera"
                  className="h-11 w-11 shrink-0 bg-primary text-white hover:bg-primary/90"
                >
                  <FaCamera className="h-4 w-4" />
                </Button>

                {/* Botão Limpar Fotos (Comum) */}
                {fotos.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFotos([])}
                    className="min-h-11 flex-1 sm:flex-none"
                  >
                    Limpar Fotos
                  </Button>
                )}
              </div>
              {/* Preview das fotos (Comum) */}
              {fotos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {fotos.map((foto, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={previewsFotos[index]}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                        onError={(e) => {
                          console.warn("Erro ao carregar preview da imagem:", foto.name);
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Preview+Indisponível';
                          (e.target as HTMLImageElement).alt = 'Preview indisponível';
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        type="button"
                        aria-label={`Remover foto ${index + 1}`}
                        className="absolute right-1 top-1 h-11 w-11 opacity-90 sm:h-8 sm:w-8 sm:opacity-75 sm:group-hover:opacity-100"
                        onClick={() => setFotos(fotos.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={handleSalvar} 
            className="w-full"
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : 'Salvar Registro'}
          </Button>
        </Card>

        {/* Registros Anteriores */}
        <Card className="min-w-0 p-3 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">Registros Anteriores</h2>
          {registrosAnteriores.length === 0 ? (
            <div className="flex justify-center items-center h-[200px] text-gray-500">
              Nenhum registro disponível
            </div>
          ) : (
            <div className="space-y-4">
              {registrosAnteriores.map((registro) => (
                <Card key={registro.id} className="p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 break-words">
                      <p className="font-medium">
                        {format(parseISO(registro.data), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Descrição:</strong> {registro.descricao}
                      </p>
                      {registro.observacoes && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>Observações:</strong> {registro.observacoes}
                        </p>
                      )}
                      {registro.etapas_iniciadas && registro.etapas_iniciadas.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-primary">Etapas Iniciadas:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {registro.etapas_iniciadas.map((etapa) => (
                              <span key={etapa} className="bg-primary/10 text-primary text-sm px-2 py-1 rounded-md">
                                {etapa}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {registro.etapas_concluidas && registro.etapas_concluidas.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-green-700">Etapas Concluídas:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {registro.etapas_concluidas.map((etapa) => (
                              <span key={etapa} className="bg-green-100 text-green-700 text-sm px-2 py-1 rounded-md">
                                {etapa}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {registro.fotos && registro.fotos.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Fotos:</strong> {registro.fotos.length} foto(s)
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {registro.fotos.map((foto, index) => (
                              <img
                                key={index}
                                src={foto}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleVisualizarImagens(registro.fotos)}
                                onError={(e) => {
                                  console.error('[DEBUG] Erro ao carregar imagem:', foto);
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x100?text=Erro+ao+carregar+imagem';
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditarRegistro(registro)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleExcluirRegistro(registro)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Dialog de Edição */}
        <Dialog
          open={showEditDialog}
          onOpenChange={(open) => {
            if (salvando && !open) return;
            setShowEditDialog(open);
            if (!open) {
              setRegistroEmEdicao(null);
              setFotosEdicaoPendentes([]);
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:max-h-[90vh] sm:p-6">
            <DialogHeader>
              <DialogTitle>Editar Registro</DialogTitle>
            </DialogHeader>
            {registroEmEdicao && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-descricao">Descrição das Atividades</Label>
                  <Textarea
                    id="edit-descricao"
                    value={registroEmEdicao.descricao}
                    onChange={(e) => setRegistroEmEdicao(prev => prev ? {...prev, descricao: e.target.value} : null)}
                    onBlur={(e) => setRegistroEmEdicao(prev => prev ? {...prev, descricao: capitalizarPrimeiraLetra(e.target.value)} : null)}
                    placeholder="Descreva as atividades realizadas na obra"
                    className="min-h-[100px]"
                    spellCheck={true}
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    lang="pt-BR"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-observacoes">Observações</Label>
                  <Textarea
                    id="edit-observacoes"
                    value={registroEmEdicao.observacoes}
                    onChange={(e) => setRegistroEmEdicao(prev => prev ? {...prev, observacoes: e.target.value} : null)}
                    onBlur={(e) => setRegistroEmEdicao(prev => prev ? {...prev, observacoes: capitalizarPrimeiraLetra(e.target.value)} : null)}
                    placeholder="Adicione observações importantes sobre a obra"
                    className="min-h-[100px]"
                    spellCheck={true}
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    lang="pt-BR"
                  />
                </div>

                {/* Etapas Iniciadas */}
                <div className="flex flex-col space-y-2">
                  <Label>Etapas Iniciadas</Label>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        Selecione as etapas iniciadas
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {etapasDisponiveis.length > 0 ? (
                            etapasDisponiveis.map((etapaNome) => {
                              const etapa = etapasFluxograma.find(e => e.nome === etapaNome);
                              if (!etapa) return null;
                              return (
                                <div key={`iniciada-${etapa.id}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`iniciada-${etapa.id}`}
                                    checked={etapasIniciadas.includes(etapa.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setEtapasIniciadas([...etapasIniciadas, etapa.id]);
                                      } else {
                                        setEtapasIniciadas(etapasIniciadas.filter(id => id !== etapa.id));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`iniciada-${etapa.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {etapa.nome}
                                  </label>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-gray-500 text-center py-2">Todas as etapas já foram iniciadas</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Etapas Finalizadas */}
                <div className="flex flex-col space-y-2">
                  <Label>Etapas Finalizadas</Label>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        Selecione as etapas a serem finalizadas
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {etapasEmAndamento.map((etapa) => (
                            <div key={`edit-finalizada-${etapa}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-finalizada-${etapa}`}
                                checked={registroEmEdicao.etapas_concluidas?.includes(etapa)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setRegistroEmEdicao(prev => {
                                      if (!prev) return null;
                                      const novasEtapas = [...(prev.etapas_concluidas || []), etapa];
                                      return { ...prev, etapas_concluidas: novasEtapas };
                                    });
                                  } else {
                                    setRegistroEmEdicao(prev => {
                                      if (!prev) return null;
                                      const novasEtapas = (prev.etapas_concluidas || []).filter(id => id !== etapa);
                                      return { ...prev, etapas_concluidas: novasEtapas };
                                    });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`edit-finalizada-${etapa}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {etapa}
                              </label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Upload de Novas Fotos */}
                <div>
                  <Label>Adicionar Novas Fotos</Label>
                  <div className="mt-2 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {platform === 'web' ? (
                        <>
                          <Input
                            id="file-upload-edit-input"
                            type="file"
                            multiple
                            accept="image/*,.heic,.heif"
                            onChange={(e) => handleFileInputChange(e, true)}
                            disabled={salvando}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('file-upload-edit-input')?.click()}
                            disabled={salvando}
                            className="min-h-11 flex-1 sm:flex-none"
                          >
                            <ImageIcon className="mr-2 h-4 w-4" />
                            Selecionar arquivos
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleAdicionarFoto(CameraSource.Photos, true)}
                          disabled={salvando}
                          className="min-h-11 flex-1 sm:flex-none"
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Selecionar da galeria
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAdicionarFoto(CameraSource.Camera, true)}
                        disabled={salvando}
                        aria-label="Tirar foto com a câmera"
                        className="min-h-11 flex-1 sm:flex-none"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Tirar foto
                      </Button>
                    </div>

                    {fotosEdicaoPendentes.length > 0 && (
                      <div>
                        <Label>Novas fotos ({fotosEdicaoPendentes.length})</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {fotosEdicaoPendentes.map((foto, index) => (
                            <div key={`${foto.name}-${index}`} className="relative">
                              <img
                                src={previewsFotosEdicao[index]}
                                alt={`Nova foto ${index + 1}`}
                                className="h-24 w-full rounded-lg object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                aria-label={`Remover nova foto ${index + 1}`}
                                disabled={salvando}
                                className="absolute right-1 top-1 h-11 w-11 sm:h-8 sm:w-8"
                                onClick={() => setFotosEdicaoPendentes(prev => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview das fotos atuais */}
                    {registroEmEdicao.fotos && registroEmEdicao.fotos.length > 0 && (
                      <div className="mt-4">
                        <Label>Fotos atuais ({registroEmEdicao.fotos.length})</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                          {registroEmEdicao.fotos.map((foto, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={foto}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                                onError={(e) => {
                                  console.error('[DEBUG] Erro ao carregar preview da imagem:', foto);
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x100?text=Erro+ao+carregar+imagem';
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                aria-label={`Remover foto ${index + 1}`}
                                disabled={salvando}
                                className="absolute right-1 top-1 h-11 w-11 opacity-90 sm:h-8 sm:w-8 sm:opacity-75 sm:group-hover:opacity-100"
                                onClick={() => {
                                  setRegistroEmEdicao(prev => {
                                    if (!prev) return null;
                                    const novasFotos = prev.fotos.filter((_, i) => i !== index);
                                    return { ...prev, fotos: novasFotos };
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleSalvarEdicao} className="min-h-11 w-full" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={!!registroSelecionado} onOpenChange={() => setRegistroSelecionado(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:max-h-[90vh] sm:p-6">
            <DialogHeader>
              <DialogTitle>
                Registro do dia {registroSelecionado && format(parseISO(registroSelecionado.data), "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </DialogTitle>
            </DialogHeader>
            {registroSelecionado && (
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <p className="mt-1 text-sm">{registroSelecionado.descricao}</p>
                </div>
                {registroSelecionado.observacoes && (
                  <div>
                    <Label>Observações</Label>
                    <p className="mt-1 text-sm">{registroSelecionado.observacoes}</p>
                  </div>
                )}
                {registroSelecionado.fotos && registroSelecionado.fotos.length > 0 && (
                  <div>
                    <Label>Fotos ({registroSelecionado.fotos.length})</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                      {registroSelecionado.fotos.map((foto, index) => (
                        <div key={index} className="relative aspect-square group">
                          <img
                            src={foto}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg cursor-pointer transition-transform hover:scale-105"
                            onClick={() => handleVisualizarImagens(registroSelecionado.fotos)}
                            onError={(e) => {
                              console.error('[DEBUG] Erro ao carregar imagem:', foto);
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Erro+ao+carregar+imagem';
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVisualizarImagens(registroSelecionado.fotos);
                              }}
                            >
                              Ver Ampliado
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleEditarRegistro(registroSelecionado)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleExcluirRegistro(registroSelecionado);
                      setRegistroSelecionado(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Visualizador de Imagens */}
        <ImageViewerDialog
          images={selectedImages}
          open={showImageViewer}
          onOpenChange={setShowImageViewer}
          title="Fotos do Registro"
        />
      </div>
    </div>
  );
};

export default DiarioObra;
