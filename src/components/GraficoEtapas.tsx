import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ETAPAS_FLUXOGRAMA } from '../constants/etapas';

interface RegistroDiario {
  data: string;
  etapas_iniciadas: string[];
  etapas_concluidas: string[];
}

interface GraficoEtapasProps {
  registros: RegistroDiario[];
  etapasFluxograma?: { id: string; nome: string }[];
}

interface EtapaInfo {
  etapa_nome: string;
  data_inicio: string;
  data_fim?: string;
  duracao: number;
  status: 'em_andamento' | 'concluida';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const etapa = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-lg shadow border">
        <p className="font-bold">{etapa.etapa_nome}</p>
        <p>Início: {format(parseISO(etapa.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}</p>
        {etapa.data_fim && (
          <p>Fim: {format(parseISO(etapa.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</p>
        )}
        <p>Duração: {etapa.duracao} dias</p>
        <p>Status: {etapa.status === 'concluida' ? 'Concluída' : 'Em andamento'}</p>
      </div>
    );
  }
  return null;
};

export default function GraficoEtapas({ registros, etapasFluxograma = ETAPAS_FLUXOGRAMA }: GraficoEtapasProps) {
  const hoje = new Date();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Adiciona um listener para atualizar o tamanho da janela quando redimensionada
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Processa os registros para obter informações das etapas
  const etapasInfo = new Map<string, EtapaInfo>();
  
  // Primeiro, encontra as datas de início de cada etapa
  registros.forEach(registro => {
    const data = registro.data;
    registro.etapas_iniciadas?.forEach(etapa => {
      if (!etapasInfo.has(etapa)) {
        etapasInfo.set(etapa, {
          etapa_nome: etapa,
          data_inicio: data,
          status: 'em_andamento',
          duracao: 0
        });
      }
    });
  });
  
  // Depois, encontra as datas de conclusão
  registros.forEach(registro => {
    const data = registro.data;
    registro.etapas_concluidas?.forEach(etapa => {
      const info = etapasInfo.get(etapa);
      if (info) {
        info.data_fim = data;
        info.status = 'concluida';
      }
    });
  });
  
  // Calcula a duração de cada etapa
  const dadosGrafico = Array.from(etapasInfo.values()).map(etapa => {
    const dataInicio = parseISO(etapa.data_inicio);
    const dataFim = etapa.data_fim ? parseISO(etapa.data_fim) : hoje;
    const duracao = differenceInDays(dataFim, dataInicio) + 1;
    
    return {
      ...etapa,
      duracao,
      fill: etapa.status === 'concluida' ? '#22c55e' : '#eab308'
    };
  });

  // Ordena as etapas conforme a ordem do fluxograma (mais recentes em cima)
  const ordemEtapas = etapasFluxograma.map(etapa => etapa.nome);
  dadosGrafico.sort((a, b) => {
    const indexA = ordemEtapas.indexOf(a.etapa_nome);
    const indexB = ordemEtapas.indexOf(b.etapa_nome);
    
    // Se a etapa não está na lista de etapasFluxograma, coloca no final
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    // Inverte a ordem: mais recentes (maior índice) ficam em cima
    return indexB - indexA;
  });

  // Calcula o tamanho e espaçamento das barras baseado no número de etapas
  const numEtapas = dadosGrafico.length;
  const barSize = Math.max(20, Math.min(32, 400 / numEtapas)); // Diminui o tamanho da barra conforme aumenta o número de etapas
  const barGap = Math.max(4, Math.min(8, 200 / numEtapas)); // Diminui o espaçamento conforme aumenta o número de etapas
  
  // Ajusta as margens e tamanhos com base no tamanho da tela
  const isMobile = windowWidth < 768;
  const leftMargin = isMobile ? 80 : 150;
  const fontSize = isMobile ? Math.max(8, Math.min(10, 200 / numEtapas)) : Math.max(10, Math.min(12, 240 / numEtapas));
  const chartHeight = isMobile ? Math.max(300, numEtapas * 30) : 400;

  // Se não houver dados, exibe uma mensagem
  if (dadosGrafico.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-gray-500">
        Nenhuma etapa registrada ainda
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: `${chartHeight}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dadosGrafico}
          layout="vertical"
          margin={{ top: 20, right: 30, left: leftMargin, bottom: 5 }}
          barSize={barSize}
          barGap={barGap}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
          <XAxis 
            type="number" 
            label={{ 
              value: 'Dias', 
              position: 'insideBottom', 
              offset: -5 
            }}
            tick={{ fontSize }}
          />
          <YAxis 
            type="category" 
            dataKey="etapa_nome" 
            width={isMobile ? 70 : 140}
            tick={{ fontSize }}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="duracao" 
            background={{ fill: '#f3f4f6' }}
            radius={[4, 4, 4, 4]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 