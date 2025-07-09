import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar as CalendarIcon, Upload, ChevronLeft, ChevronRight, Download, ArrowLeft, Trash2, Plus, X, Check } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, startOfMonth, endOfMonth, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { gerarRelatorioSemanal, excluirRelatorio } from "@/lib/api";
import { gerarRelatorioSemanalV2 } from "@/lib/relatorio";
import { Calendar } from "@/components/ui/calendar";
import type { RelatorioSemanal } from "@/types/obra";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import html2pdf from "html2pdf.js";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ETAPAS_FLUXOGRAMA } from "@/constants/etapas";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface para o funcionário
interface Funcionario {
  id: string;
  nome: string;
  presencas: { [key: string]: number }; // data no formato 'yyyy-MM-dd': 0 (ausente), 0.5 (meio período), 1 (período completo)
}

// Interface para armazenar presenças por semana
interface PresencasPorSemana {
  [semanaKey: string]: {
    [funcionarioId: string]: {
      [data: string]: number
    }
  }
}

const Relatorios = () => {
  // Verificar se a função gerarRelatorioSemanal está sendo importada corretamente
  console.log('[DEBUG] Tipo da função gerarRelatorioSemanal:', typeof gerarRelatorioSemanal);
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [semanaAtual, setSemanaAtual] = useState(new Date());
  const [relatoriosAnteriores, setRelatoriosAnteriores] = useState<any[]>([]);
  const [diasComDiario, setDiasComDiario] = useState<Date[]>([]);
  const [gerando, setGerando] = useState(false);
  const [novoFuncionario, setNovoFuncionario] = useState("");
  
  // Estado para os funcionários e suas presenças
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  // Estado para armazenar presenças por semana
  const [presencasPorSemana, setPresencasPorSemana] = useState<PresencasPorSemana>({});

  // Estado para armazenar funcionários por semana
  const [funcionariosPorSemana, setFuncionariosPorSemana] = useState<{[semanaKey: string]: Funcionario[]}>({});

  // Estado para o diálogo de detalhes do diário
  const [diarioSelecionado, setDiarioSelecionado] = useState<any | null>(null);
  const [showDiarioDialog, setShowDiarioDialog] = useState(false);
  
  // Estado para armazenar os dados completos dos diários
  const [diariosCompletos, setDiariosCompletos] = useState<any[]>([]);

  // Estado para controlar se as pendências devem ser incluídas no relatório
  const [incluirPendencias, setIncluirPendencias] = useState(false);

  // Estado para controlar se a tabela de presença deve ser incluída no relatório
  const [incluirPresenca, setIncluirPresenca] = useState(false);

  // Estado para armazenar as etapas do fluxograma
  const [etapasFluxograma, setEtapasFluxograma] = useState<{ id: string; nome: string }[]>([]);

  // Função para obter os dias úteis da semana (segunda a sexta)
  const getDiasUteis = (dataInicio: Date) => {
    const dias = [];
    // Ajustando para garantir que o início da semana seja domingo
    const inicioSemana = startOfWeek(dataInicio, { weekStartsOn: 0 });
    
    // Adicionar dias de segunda (índice 1) a sexta (índice 5)
    for (let i = 1; i <= 5; i++) {
      const dia = addDays(inicioSemana, i);
      dias.push(dia);
    }
    
    return dias;
  };

  // Função para carregar as etapas do fluxograma
  const carregarEtapasFluxograma = async () => {
    try {
      console.log('[DEBUG] Carregando etapas do fluxograma para a obra:', id);
      const { data, error } = await supabase
        .from('etapas_fluxograma')
        .select('*')
        .eq('obra_id', id);

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

  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (id) {
      console.log('[DEBUG] useEffect - Carregando dados para obra:', id);
      carregarRelatoriosAnteriores();
      carregarDiarios();
      carregarEtapasFluxograma();
      
      // Carregar funcionários e presenças do localStorage
      carregarFuncionariosDoLocalStorage();
      
      // Carregar presenças para a semana atual
      const semanaKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      carregarFuncionariosDaSemana(semanaKey);
    } else {
      // Se não houver ID, redirecionar para a lista de obras
      navigate('/obras');
    }
  }, [id]);

  // Efeito para carregar presenças quando a semana muda
  useEffect(() => {
    const semanaKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    console.log('[DEBUG] Mudança de semana. Semana atual:', semanaKey);
    
    // Carregar funcionários para a semana atual
    carregarFuncionariosDaSemana(semanaKey);
  }, [semanaAtual, funcionariosPorSemana]);

  // Função para carregar funcionários do localStorage
  const carregarFuncionariosDoLocalStorage = () => {
    try {
      // Carregar funcionários por semana
      const funcionariosSalvos = localStorage.getItem('funcionariosPorSemana');
      if (funcionariosSalvos) {
        const funcionariosParsed = JSON.parse(funcionariosSalvos);
        console.log('[DEBUG] Carregando funcionários do localStorage:', funcionariosParsed);
        setFuncionariosPorSemana(funcionariosParsed);
      }
      
      // Carregar presenças por semana
      const presencasSalvas = localStorage.getItem('presencasPorSemana');
      if (presencasSalvas) {
        const presencasParsed = JSON.parse(presencasSalvas);
        console.log('[DEBUG] Carregando presenças do localStorage:', presencasParsed);
        setPresencasPorSemana(presencasParsed);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar dados do localStorage:', error);
    }
  };

  // Função para carregar funcionários da semana atual
  const carregarFuncionariosDaSemana = (semanaKey: string) => {
    // Verificar se já temos funcionários para esta semana
    if (funcionariosPorSemana[semanaKey]) {
      console.log('[DEBUG] Usando funcionários já carregados para a semana:', funcionariosPorSemana[semanaKey]);
      setFuncionarios(funcionariosPorSemana[semanaKey]);
    } else {
      // Se não temos funcionários para esta semana, verificar se temos funcionários em outras semanas
      const todasSemanas = Object.keys(funcionariosPorSemana);
      if (todasSemanas.length > 0) {
        // Usar funcionários da semana mais recente
        const semanaRecente = todasSemanas[todasSemanas.length - 1];
        const funcionariosRecentes = funcionariosPorSemana[semanaRecente];
        
        // Criar novos funcionários para esta semana com presença inicializada como 1 (presente)
        const novosFuncionarios = funcionariosRecentes.map(func => {
          // Inicializar presença com valor 1 (presente) para todos os dias da semana
          const presencas = {};
          const diasUteis = getDiasUteis(semanaAtual);
          diasUteis.forEach(dia => {
            const dataString = format(dia, 'yyyy-MM-dd');
            presencas[dataString] = 1; // Inicializa com presente (1)
          });
          
          return {
            ...func,
            presencas: presencas
          };
        });
        
        console.log('[DEBUG] Criando funcionários para nova semana baseados em semana anterior:', novosFuncionarios);
        
        // Atualizar estado
        setFuncionarios(novosFuncionarios);
        setFuncionariosPorSemana(prev => ({
          ...prev,
          [semanaKey]: novosFuncionarios
        }));
        
        // Salvar no localStorage
        salvarFuncionariosNoLocalStorage({
          ...funcionariosPorSemana,
          [semanaKey]: novosFuncionarios
        });
      } else {
        // Verificar se temos dados salvos no localStorage
        const funcionariosSalvos = localStorage.getItem('funcionariosPorSemana');
        
        if (funcionariosSalvos) {
          try {
            const funcionariosParsed = JSON.parse(funcionariosSalvos);
            
            // Verificar se temos funcionários em alguma semana salva
            const semanasLocalStorage = Object.keys(funcionariosParsed);
            
            if (semanasLocalStorage.length > 0) {
              // Usar funcionários da semana mais recente do localStorage
              const semanaRecenteLS = semanasLocalStorage[semanasLocalStorage.length - 1];
              const funcionariosRecentesLS = funcionariosParsed[semanaRecenteLS];
              
              // Criar novos funcionários para esta semana com presença inicializada como 1 (presente)
              const novosFuncionarios = funcionariosRecentesLS.map((func: Funcionario) => {
                // Inicializar presença com valor 1 (presente) para todos os dias da semana
                const presencas = {};
                const diasUteis = getDiasUteis(semanaAtual);
                diasUteis.forEach(dia => {
                  const dataString = format(dia, 'yyyy-MM-dd');
                  presencas[dataString] = 1; // Inicializa com presente (1)
                });
                
                return {
                  ...func,
                  presencas: presencas
                };
              });
              
              console.log('[DEBUG] Criando funcionários para nova semana baseados em localStorage:', novosFuncionarios);
              
              // Atualizar estado
              setFuncionarios(novosFuncionarios);
              setFuncionariosPorSemana(prev => ({
                ...prev,
                [semanaKey]: novosFuncionarios
              }));
              
              // Salvar no localStorage
              salvarFuncionariosNoLocalStorage({
                ...funcionariosPorSemana,
                [semanaKey]: novosFuncionarios
              });
              
              return; // Sair da função, pois já carregamos os funcionários
            }
          } catch (error) {
            console.error('[DEBUG] Erro ao processar funcionários do localStorage:', error);
          }
        }
        
        // Se não temos funcionários em nenhuma semana e não há dados no localStorage, criar funcionários padrão
        const funcionariosPadrao = [];
        
        console.log('[DEBUG] Criando lista vazia de funcionários para a semana');
        
        // Atualizar estado
        setFuncionarios(funcionariosPadrao);
        setFuncionariosPorSemana(prev => ({
          ...prev,
          [semanaKey]: funcionariosPadrao
        }));
        
        // Salvar no localStorage
        salvarFuncionariosNoLocalStorage({
          ...funcionariosPorSemana,
          [semanaKey]: funcionariosPadrao
        });
      }
    }
  };

  // Função para salvar funcionários no localStorage
  const salvarFuncionariosNoLocalStorage = (funcionarios: {[semanaKey: string]: Funcionario[]}) => {
    try {
      localStorage.setItem('funcionariosPorSemana', JSON.stringify(funcionarios));
      console.log('[DEBUG] Funcionários salvos no localStorage');
    } catch (error) {
      console.error('[DEBUG] Erro ao salvar funcionários no localStorage:', error);
    }
  };

  const carregarDiarios = async () => {
    if (!id) return;

    try {
      console.log('[DEBUG] carregarDiarios - Iniciando carregamento para obra:', id);
      const { data, error } = await supabase
        .from('diario_obra')
        .select('*')
        .eq('obra_id', id);

      if (error) {
        console.error('[DEBUG] carregarDiarios - Erro:', error);
        throw error;
      }

      console.log('[DEBUG] carregarDiarios - Dados recebidos:', data);

      // Converter as datas dos diários para objetos Date
      const datas = (data || []).map(d => {
        const data = parseISO(d.data);
        console.log('[DEBUG] carregarDiarios - Data do diário:', format(data, 'dd/MM/yyyy'));
        return data;
      });

      console.log('[DEBUG] carregarDiarios - Total de diários:', datas.length);
      setDiasComDiario(datas);
      setDiariosCompletos(data || []);
    } catch (error) {
      console.error('[DEBUG] carregarDiarios - Erro ao carregar diários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os diários da obra.",
        variant: "destructive"
      });
    }
  };

  const carregarRelatoriosAnteriores = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('relatorios')
        .select('*')
        .eq('obra_id', id)
        .eq('tipo', 'semanal')
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      setRelatoriosAnteriores(data || []);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os relatórios anteriores.",
        variant: "destructive"
      });
    }
  };

  const handleGerarRelatorio = async () => {
    try {
      if (!id) {
        toast({
          title: "Erro",
          description: "ID da obra não encontrado",
          variant: "destructive"
        });
        return;
      }

      console.log('[DEBUG] Gerando relatório para obra:', {
        id: Number(id),
        dataInicio: format(startOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        dataFim: format(endOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      });

      const relatorio = await gerarRelatorioSemanalV2(
        Number(id),
        format(startOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        format(endOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        funcionarios,
        incluirPendencias,
        incluirPresenca
      );

      if (!relatorio) {
        throw new Error('Não foi possível gerar o relatório');
      }

      // Salvar o relatório no banco de dados
      try {
        const { error } = await supabase
          .from('relatorios')
          .insert({
            obra_id: Number(id),
            data_inicio: format(startOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            data_fim: format(endOfWeek(semanaAtual, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            conteudo: relatorio,
            tipo: 'semanal'
          });

        if (error) {
          console.error('[DEBUG] Erro ao salvar relatório no banco:', error);
          throw error;
        }
        
        // Recarregar a lista de relatórios
        await carregarRelatoriosAnteriores();
        
      } catch (saveError) {
        console.error('[DEBUG] Erro ao salvar relatório:', saveError);
        // Não impedir o download mesmo se falhar ao salvar
      }

      // Criar um link para download
      const blob = new Blob([relatorio], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${format(semanaAtual, 'dd-MM-yyyy')}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "Relatório gerado com sucesso!",
      });
    } catch (error) {
      console.error('[DEBUG] Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar relatório",
        variant: "destructive"
      });
    }
  };

  const handleSemanaChange = (direcao: 'anterior' | 'proxima') => {
    // Salvar presenças da semana atual antes de mudar
    const semanaAtualKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    
    // Criar um objeto com as presenças atuais
    const presencasAtuais: {[funcionarioId: string]: {[data: string]: number}} = {};
    funcionarios.forEach(func => {
      presencasAtuais[func.id] = func.presencas;
    });
    
    // Atualizar o estado de presenças por semana
    setPresencasPorSemana(prev => ({
      ...prev,
      [semanaAtualKey]: presencasAtuais
    }));
    
    // Mudar para a nova semana
    setSemanaAtual(data => {
      const novaSemana = direcao === 'anterior' 
        ? subWeeks(data, 1)
        : addWeeks(data, 1);
      
      return novaSemana;
    });
  };

  const handleVisualizarRelatorio = (relatorio: RelatorioSemanal) => {
    if (!id || !relatorio || !relatorio.id) {
      toast({
        title: "Erro",
        description: "Não foi possível determinar o relatório para visualizar.",
        variant: "destructive",
      });
      return;
    }
    // Navega para a nova página de visualização
    navigate(`/obras/${id}/relatorios/${relatorio.id}/view`);
  };

  const handleExcluirRelatorio = async (relatorioId: number) => {
    if (!confirm('Tem certeza que deseja excluir este relatório?')) {
      return;
    }

    try {
      await excluirRelatorio(relatorioId);
      await carregarRelatoriosAnteriores();
      toast({
        title: "Relatório excluído! 🗑️",
        description: "O relatório foi removido permanentemente do sistema.",
      });
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o relatório. Ele pode estar sendo usado em outros lugares do sistema.",
        variant: "destructive"
      });
    }
  };

  // Função para atualizar a presença de um funcionário
  const handlePresencaChange = (funcionarioId: string, data: string, valor: number) => {
    const semanaKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    
    // Atualizar funcionários
    setFuncionarios(prevFuncionarios => {
      const novosFuncionarios = prevFuncionarios.map(func => {
        if (func.id === funcionarioId) {
          return {
            ...func,
            presencas: {
              ...func.presencas,
              [data]: valor
            }
          };
        }
        return func;
      });
      
      // Atualizar funcionários da semana
      setFuncionariosPorSemana(prev => ({
        ...prev,
        [semanaKey]: novosFuncionarios
      }));
      
      return novosFuncionarios;
    });
    
    // Atualizar presenças da semana
    setPresencasPorSemana(prev => ({
      ...prev,
      [semanaKey]: {
        ...prev[semanaKey],
        [funcionarioId]: {
          ...(prev[semanaKey]?.[funcionarioId] || {}),
          [data]: valor
        }
      }
    }));
    
    // Salvar no localStorage
    salvarPresencasNoLocalStorage();
  };

  // Função para salvar presenças no localStorage
  const salvarPresencasNoLocalStorage = () => {
    try {
      localStorage.setItem('presencasPorSemana', JSON.stringify(presencasPorSemana));
    } catch (error) {
      console.error('[DEBUG] Erro ao salvar presenças no localStorage:', error);
    }
  };

  // Filtrar relatórios do mês atual
  const relatoriosDoMes = relatoriosAnteriores.filter(relatorio => {
    const dataRelatorio = new Date(relatorio.data_inicio);
    return isWithinInterval(dataRelatorio, {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    });
  });

  // Filtrar relatórios antigos (excluindo os do mês atual)
  const relatoriosAntigos = relatoriosAnteriores.filter(relatorio => {
    const dataRelatorio = new Date(relatorio.data_inicio);
    return !isWithinInterval(dataRelatorio, {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    });
  });

  const tileClassName = ({ date }: { date: Date }) => {
    const temDiario = diasComDiario.some(d => 
      d.getDate() === date.getDate() &&
      d.getMonth() === date.getMonth() &&
      d.getFullYear() === date.getFullYear()
    );

    return temDiario ? 'bg-primary/10 font-bold cursor-pointer' : '';
  };

  // Obter os dias úteis da semana atual
  const diasUteis = getDiasUteis(startOfWeek(semanaAtual, { weekStartsOn: 0 }));

  const handleDownloadPDF = async (relatorio: RelatorioSemanal) => {
    try {
      toast({
        title: "Processando",
        description: "Preparando o PDF, por favor aguarde...",
      });
      
      // Cria um container temporário para renderizar o conteúdo do relatório
      const tempDiv = document.createElement('div');
      tempDiv.style.width = '900px';
      tempDiv.style.margin = '0 auto';
      tempDiv.style.background = '#fff';
      tempDiv.style.padding = '24px';
      tempDiv.innerHTML = relatorio.conteudo;
      document.body.appendChild(tempDiv);

      // Aguarda renderização
      await new Promise(resolve => setTimeout(resolve, 500));

      // Captura o conteúdo como imagem
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff',
        allowTaint: true,
        foreignObjectRendering: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      // Remove o container temporário
      document.body.removeChild(tempDiv);

      const fileName = `relatorio_${format(parseISO(relatorio.data_inicio), 'dd-MM-yyyy')}_a_${format(parseISO(relatorio.data_fim), 'dd-MM-yyyy')}.pdf`;

      if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
        // Ambiente nativo: salvar ou compartilhar usando Capacitor
        const pdfBlob = pdf.output('blob');
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const filePath = `relatorios/${fileName}`;
        await Filesystem.writeFile({
          path: filePath,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        await Share.share({
          title: fileName,
          text: 'Relatório Semanal',
          url: `file://${filePath}`,
          dialogTitle: 'Compartilhar PDF',
        });
        toast({ title: 'Sucesso', description: 'PDF gerado e pronto para compartilhar!' });
      } else {
        // Web: download normal
        pdf.save(fileName);
        toast({ title: 'Sucesso', description: 'PDF gerado com sucesso!' });
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para adicionar um novo funcionário
  const handleAdicionarFuncionario = () => {
    if (!novoFuncionario.trim()) return;
    
    const semanaKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const novoId = `func-${Date.now()}`;
    
    // Inicializar presença com valor 1 (presente) para todos os dias da semana
    const presencas = {};
    const diasUteis = getDiasUteis(semanaAtual);
    diasUteis.forEach(dia => {
      const dataString = format(dia, 'yyyy-MM-dd');
      presencas[dataString] = 1; // Inicializa com presente (1)
    });
    
    const novoFunc = {
      id: novoId,
      nome: novoFuncionario,
      presencas: presencas
    };
    
    // Atualizar lista de funcionários
    setFuncionarios(prev => [...prev, novoFunc]);
    
    // Atualizar funcionários da semana
    setFuncionariosPorSemana(prev => ({
      ...prev,
      [semanaKey]: [...(prev[semanaKey] || []), novoFunc]
    }));
    
    // Limpar campo
    setNovoFuncionario('');
    
    // Salvar no localStorage
    salvarFuncionariosNoLocalStorage({
      ...funcionariosPorSemana,
      [semanaKey]: [...(funcionariosPorSemana[semanaKey] || []), novoFunc]
    });
  };
  
  // Função para remover um funcionário
  const removerFuncionario = (funcionarioId: string) => {
    const semanaKey = format(startOfWeek(semanaAtual, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    
    // Filtrar o funcionário a ser removido
    const novosFuncionarios = funcionarios.filter(func => func.id !== funcionarioId);
    setFuncionarios(novosFuncionarios);
    
    // Atualizar o estado de funcionários por semana
    const novoFuncionariosPorSemana = {
      ...funcionariosPorSemana,
      [semanaKey]: novosFuncionarios
    };
    
    setFuncionariosPorSemana(novoFuncionariosPorSemana);
    
    // Salvar no localStorage
    salvarFuncionariosNoLocalStorage(novoFuncionariosPorSemana);
    
    toast({
      title: "Sucesso",
      description: "Funcionário removido com sucesso!",
    });
  };

  // Atualizar a função handleDiaClick para ser exatamente igual à da página de diário
  const handleDiaClick = (date: Date | undefined) => {
    if (!date) return;
    
    console.log('[DEBUG] handleDiaClick - Data recebida:', date);
    
    // Ajustar para meio-dia UTC para evitar problemas de fuso horário
    const dataAjustada = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
    console.log('[DEBUG] handleDiaClick - Data ajustada:', dataAjustada);
    
    setSemanaAtual(dataAjustada);
    
    // Verificar se já existe um registro para esta data
    const dataFormatada = format(dataAjustada, 'yyyy-MM-dd');
    console.log('[DEBUG] handleDiaClick - Data formatada:', dataFormatada);
    console.log('[DEBUG] handleDiaClick - Diários completos:', diariosCompletos);
    
    const diario = diariosCompletos.find(d => d.data === dataFormatada);
    console.log('[DEBUG] handleDiaClick - Diário encontrado:', diario);
    
    if (diario) {
      console.log('[DEBUG] handleDiaClick - Abrindo diálogo com diário:', diario);
      setDiarioSelecionado(diario);
      setShowDiarioDialog(true);
    } else {
      console.log('[DEBUG] handleDiaClick - Nenhum diário encontrado para a data:', dataFormatada);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(`/obras/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/obras/${id}/diario`)}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Diário de Obra
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="w-full flex justify-center">
            <h2 className="text-2xl font-semibold mb-6 text-center">Calendário de Registros</h2>
          </div>
          <div className="w-full flex justify-center">
            <Calendar
              mode="single"
              selected={semanaAtual}
              onSelect={handleDiaClick}
              className="mx-auto rounded-lg border-2 border-primary/20 p-3 sm:p-6 bg-white shadow-lg"
              locale={ptBR}
              modifiers={{ 
                hasRegistro: (date) => {
                  try {
                    const dataFormatada = format(date, 'yyyy-MM-dd');
                    return diariosCompletos.some(reg => reg.data === dataFormatada);
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
              defaultMonth={semanaAtual}
              fromDate={new Date(2024, 0, 1)}
              toDate={new Date(2025, 11, 31)}
              disabled={(date) => date > new Date()}
            />
          </div>
          <div className="flex items-center justify-center space-x-4 mt-4">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-primary mr-2"></div>
              <span className="text-sm">Com Registro</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-secondary/20 border-2 border-secondary mr-2"></div>
              <span className="text-sm">Hoje</span>
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <Button
              variant="outline"
              onClick={() => handleSemanaChange('anterior')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Semana Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              {format(startOfWeek(semanaAtual, { weekStartsOn: 1 }), "dd/MM/yyyy")} a{" "}
              {format(endOfWeek(semanaAtual, { weekStartsOn: 1 }), "dd/MM/yyyy")}
            </span>

            <Button
              variant="outline"
              onClick={() => handleSemanaChange('proxima')}
            >
              Próxima Semana
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <h2 className="text-lg font-semibold">Controle de Presença</h2>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Nome do funcionário"
                  value={novoFuncionario}
                  onChange={(e) => setNovoFuncionario(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAdicionarFuncionario();
                    }
                  }}
                />
                <Button onClick={handleAdicionarFuncionario} variant="secondary">
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left min-w-[150px] sticky left-0 bg-muted">Funcionário</th>
                    {diasUteis.map((dia) => (
                      <th key={format(dia, 'yyyy-MM-dd')} className="p-2 text-center min-w-[100px]">
                        {format(dia, 'EEE, dd/MM', { locale: ptBR })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funcionarios.map((funcionario) => (
                    <tr key={funcionario.id} className="border-b">
                      <td className="p-2 sticky left-0 bg-background">{funcionario.nome}</td>
                      {diasUteis.map((dia) => {
                        const dataKey = format(dia, 'yyyy-MM-dd');
                        const presenca = funcionario.presencas[dataKey] || 0;
                        return (
                          <td key={dataKey} className="p-2 text-center">
                            <Select
                              value={presenca.toString()}
                              onValueChange={(value) => handlePresencaChange(funcionario.id, dataKey, Number(value))}
                            >
                              <SelectTrigger className={cn(
                                "w-[120px] mx-auto",
                                presenca === 1 ? "bg-green-100" :
                                presenca === 0.5 ? "bg-yellow-100" :
                                "bg-red-100"
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Presente</SelectItem>
                                <SelectItem value="0.5">Meio período</SelectItem>
                                <SelectItem value="0">Ausente</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <h2 className="text-lg font-semibold">Relatório Semanal</h2>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={incluirPendencias}
                  onCheckedChange={(checked) => setIncluirPendencias(checked as boolean)}
                  id="incluirPendencias"
                />
                <label htmlFor="incluirPendencias">
                  Incluir pendências no relatório
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={incluirPresenca}
                  onCheckedChange={(checked) => setIncluirPresenca(checked as boolean)}
                  id="incluirPresenca"
                />
                <label htmlFor="incluirPresenca">
                  Incluir tabela de presença no relatório
                </label>
              </div>
              <Button onClick={handleGerarRelatorio} className="w-full">
                <FileText className="mr-2 h-4 w-4" /> Gerar Relatório
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Relatórios do Mês Atual */}
      {relatoriosDoMes.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Relatórios do Mês Atual</h2>
          <div className="grid gap-4">
            {relatoriosDoMes.map((relatorio) => (
              <div key={relatorio.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg bg-white space-y-2 sm:space-y-0">
                <div className="space-y-1">
                  <h3 className="font-medium">
                    {format(parseISO(relatorio.data_inicio), 'dd/MM/yyyy')} a {format(parseISO(relatorio.data_fim), 'dd/MM/yyyy')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {relatorio.tipo === 'semanal' ? 'Relatório Semanal' : 'Relatório Final'}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVisualizarRelatorio(relatorio)}
                      className="flex-1 sm:flex-none"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span>Visualizar</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(relatorio)}
                      className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      <span>PDF</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExcluirRelatorio(relatorio.id)}
                      className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Relatórios Antigos */}
      {relatoriosAntigos.length > 0 && (
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Todos os Relatórios</h2>
          <div className="grid gap-4">
            {relatoriosAntigos.map((relatorio) => (
              <div key={relatorio.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg bg-white space-y-2 sm:space-y-0">
                <div className="space-y-1">
                  <h3 className="font-medium">
                    {format(parseISO(relatorio.data_inicio), 'dd/MM/yyyy')} a {format(parseISO(relatorio.data_fim), 'dd/MM/yyyy')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {relatorio.tipo === 'semanal' ? 'Relatório Semanal' : 'Relatório Final'}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVisualizarRelatorio(relatorio)}
                      className="flex-1 sm:flex-none"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span>Visualizar</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(relatorio)}
                      className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      <span>PDF</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExcluirRelatorio(relatorio.id)}
                      className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dialog para mostrar detalhes do diário */}
      <Dialog open={showDiarioDialog} onOpenChange={setShowDiarioDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Diário de Obra - {diarioSelecionado ? format(parseISO(diarioSelecionado.data), 'dd/MM/yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          
          {diarioSelecionado && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Descrição da Atividade</h4>
                <p className="mt-1 text-gray-700 whitespace-pre-line">{diarioSelecionado.descricao}</p>
              </div>
              
              {diarioSelecionado.observacoes && (
                <div>
                  <h4 className="font-medium">Observações</h4>
                  <p className="mt-1 text-gray-700 whitespace-pre-line">{diarioSelecionado.observacoes}</p>
                </div>
              )}
              
              {diarioSelecionado.etapas_iniciadas && diarioSelecionado.etapas_iniciadas.length > 0 && (
                <div>
                  <h4 className="font-medium text-primary">Etapas Iniciadas</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {diarioSelecionado.etapas_iniciadas.map((etapa: string) => (
                      <span key={etapa} className="bg-primary/10 text-primary text-sm px-2 py-1 rounded-md">
                        {etapa}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {diarioSelecionado.etapas_concluidas && diarioSelecionado.etapas_concluidas.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700">Etapas Concluídas</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {diarioSelecionado.etapas_concluidas.map((etapa: string) => (
                      <span key={etapa} className="bg-green-100 text-green-700 text-sm px-2 py-1 rounded-md">
                        {etapa}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {diarioSelecionado.fotos && diarioSelecionado.fotos.length > 0 && (
                <div>
                  <h4 className="font-medium">Fotos ({diarioSelecionado.fotos.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {diarioSelecionado.fotos.map((foto: string, index: number) => (
                      <img
                        key={index}
                        src={foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer"
                        onClick={() => window.open(foto, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relatorios;
