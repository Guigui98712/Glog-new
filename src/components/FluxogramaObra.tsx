import React, { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useReactFlow,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface DiarioRegistro {
  data: string;
  etapas_iniciadas: string[];
  etapas_concluidas: string[];
}

interface EtapaConfig {
  id: string;
  nome: string;
  position: { x: number; y: number };
}

interface FluxogramaObraProps {
  registros: DiarioRegistro[];
  editMode?: boolean;
  onEtapasChange?: (etapas: EtapaConfig[]) => void;
  onNodeClick?: (node: Node) => void;
  selectedNodeId?: string | null;
  etapasConfig?: EtapaConfig[];
}

// Configuração base das etapas
const getEtapasConfig = (isMobile: boolean) => {
  // Fator de escala para dispositivos móveis
  const scale = isMobile ? 0.7 : 1;
  // Espaçamento horizontal entre etapas
  const horizontalSpacing = isMobile ? 150 : 200;
  // Espaçamento vertical entre etapas paralelas
  const verticalSpacing = isMobile ? 70 : 100;
  
  return [
    // Seção 1
    { id: '1', nome: 'Serviços Preliminares', position: { x: 0 * horizontalSpacing, y: 0 } },
    // Seção 2
    { id: '2', nome: 'Terraplenagem', position: { x: 1 * horizontalSpacing, y: 0 } },
    // Seção 3
    { id: '3', nome: 'Fundação', position: { x: 2 * horizontalSpacing, y: 0 } },
    // Seção 4 - Alvenaria e Estrutura (paralelo)
    { id: '4', nome: 'Alvenaria', position: { x: 3 * horizontalSpacing, y: -0.5 * verticalSpacing } },
    { id: '5', nome: 'Estrutura', position: { x: 3 * horizontalSpacing, y: 0.5 * verticalSpacing } },
    // Seção 5 - Passagens e Laje (paralelo)
    { id: '6', nome: 'Passagens Elétricas', position: { x: 4 * horizontalSpacing, y: -1 * verticalSpacing } },
    { id: '7', nome: 'Passagens Hidráulicas', position: { x: 4 * horizontalSpacing, y: 0 } },
    { id: '8', nome: 'Laje', position: { x: 4 * horizontalSpacing, y: 1 * verticalSpacing } },
    // Seção 6 - Cobertura e Instalações (paralelo)
    { id: '9', nome: 'Cobertura', position: { x: 5 * horizontalSpacing, y: -1 * verticalSpacing } },
    { id: '10', nome: 'Instalações Elétricas', position: { x: 5 * horizontalSpacing, y: 0 } },
    { id: '11', nome: 'Instalações Hidráulicas', position: { x: 5 * horizontalSpacing, y: 1 * verticalSpacing } },
    // Seção 7 - Reboco e Regularização
    { id: '12', nome: 'Reboco', position: { x: 6 * horizontalSpacing, y: -0.5 * verticalSpacing } },
    { id: '13', nome: 'Regularização', position: { x: 6 * horizontalSpacing, y: 0.5 * verticalSpacing } },
    // Seção 8 - Revestimento, Gesso e Marmoraria (paralelo)
    { id: '14', nome: 'Revestimento', position: { x: 7 * horizontalSpacing, y: -1 * verticalSpacing } },
    { id: '15', nome: 'Gesso', position: { x: 7 * horizontalSpacing, y: 0 } },
    { id: '16', nome: 'Marmoraria', position: { x: 7 * horizontalSpacing, y: 1 * verticalSpacing } },
    // Seção 9 - Pintura
    { id: '17', nome: 'Pintura', position: { x: 8 * horizontalSpacing, y: 0 } },
    // Seção 10 - Esquadrias
    { id: '18', nome: 'Esquadrias', position: { x: 9 * horizontalSpacing, y: 0 } },
    // Seção 11 - Limpeza Bruta
    { id: '19', nome: 'Limpeza Bruta', position: { x: 10 * horizontalSpacing, y: 0 } },
    // Seção 12 - Marcenaria e Metais (paralelo)
    { id: '20', nome: 'Marcenaria', position: { x: 11 * horizontalSpacing, y: -0.5 * verticalSpacing } },
    { id: '21', nome: 'Metais', position: { x: 11 * horizontalSpacing, y: 0.5 * verticalSpacing } },
    // Seção 13 - Limpeza Final
    { id: '22', nome: 'Limpeza Final', position: { x: 12 * horizontalSpacing, y: 0 } },
  ];
};

const FluxogramaObra: React.FC<FluxogramaObraProps> = ({ 
  registros, 
  editMode = false, 
  onEtapasChange,
  onNodeClick,
  selectedNodeId,
  etapasConfig: etapasConfigProp
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [etapasConfig, setEtapasConfig] = useState<EtapaConfig[]>(
    etapasConfigProp || getEtapasConfig(window.innerWidth < 768)
  );
  
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
  
  // Atualizar as etapas quando as props mudarem
  useEffect(() => {
    console.log("FluxogramaObra - etapasConfigProp atualizado:", etapasConfigProp);
    if (etapasConfigProp) {
      console.log("Atualizando etapasConfig com etapasConfigProp");
      setEtapasConfig(etapasConfigProp);
    } else if (!editMode) {
      console.log("Atualizando etapasConfig com getEtapasConfig");
      setEtapasConfig(getEtapasConfig(windowWidth < 768));
    }
  }, [etapasConfigProp, windowWidth, editMode]);
  
  const isMobile = windowWidth < 768;
  
  // Processa os registros para determinar o status atual de cada etapa
  const getEtapaStatus = (etapaNome: string) => {
    let status = 'pendente';
    
    for (const registro of registros) {
      if (registro.etapas_concluidas?.includes(etapaNome)) {
        status = 'concluida';
        break;
      } else if (registro.etapas_iniciadas?.includes(etapaNome)) {
        status = 'em_andamento';
      }
    }
    
    return status;
  };

  const getStatusColor = (etapaNome: string) => {
    const status = getEtapaStatus(etapaNome);
    
    switch (status) {
      case 'concluida':
        return '#4CAF50'; // Verde
      case 'em_andamento':
        return '#FFC107'; // Amarelo
      default:
        return '#F44336'; // Vermelho para pendente
    }
  };

  // Ajusta o tamanho do nó com base no dispositivo
  const nodeWidth = isMobile ? 120 : 150;
  const nodeHeight = isMobile ? 40 : 50;
  const fontSize = isMobile ? 10 : 12;

  const nodes: Node[] = etapasConfig.map((etapa) => {
    const status = getEtapaStatus(etapa.nome);
    const color = editMode 
      ? (selectedNodeId === etapa.id ? '#3b82f6' : '#9ca3af') // Azul se selecionado, cinza se em modo de edição
      : getStatusColor(etapa.nome);
    
    return {
      id: etapa.id,
      data: { 
        label: (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center',
            padding: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {etapa.nome}
          </div>
        ) 
      },
      position: etapa.position,
      style: {
        width: nodeWidth,
        height: nodeHeight,
        backgroundColor: color,
        borderRadius: '4px',
        border: selectedNodeId === etapa.id ? '2px solid #3b82f6' : '1px solid #ddd',
        cursor: editMode ? 'pointer' : 'default',
      },
      draggable: editMode,
    };
  });

  // Conexões entre as etapas
  const edges: Edge[] = [
    // Conexões lineares principais
    { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
    { id: 'e2-3', source: '2', target: '3', type: 'smoothstep' },
    
    // Conexões para etapas paralelas na seção 4
    { id: 'e3-4', source: '3', target: '4', type: 'smoothstep' },
    { id: 'e3-5', source: '3', target: '5', type: 'smoothstep' },
    
    // Conexões das etapas paralelas da seção 4 para as etapas paralelas da seção 5
    { id: 'e4-6', source: '4', target: '6', type: 'smoothstep' },
    { id: 'e5-7', source: '5', target: '7', type: 'smoothstep' },
    { id: 'e5-8', source: '5', target: '8', type: 'smoothstep' },
    
    // Conexões das etapas paralelas da seção 5 para as etapas paralelas da seção 6
    { id: 'e6-9', source: '6', target: '9', type: 'smoothstep' },
    { id: 'e7-10', source: '7', target: '10', type: 'smoothstep' },
    { id: 'e8-11', source: '8', target: '11', type: 'smoothstep' },
    
    // Conexões das etapas paralelas da seção 6 para as etapas da seção 7
    { id: 'e9-12', source: '9', target: '12', type: 'smoothstep' },
    { id: 'e10-12', source: '10', target: '12', type: 'smoothstep' },
    { id: 'e11-13', source: '11', target: '13', type: 'smoothstep' },
    
    // Conexões das etapas da seção 7 para as etapas paralelas da seção 8
    { id: 'e12-14', source: '12', target: '14', type: 'smoothstep' },
    { id: 'e12-15', source: '12', target: '15', type: 'smoothstep' },
    { id: 'e13-16', source: '13', target: '16', type: 'smoothstep' },
    
    // Conexões das etapas paralelas da seção 8 para a etapa da seção 9
    { id: 'e14-17', source: '14', target: '17', type: 'smoothstep' },
    { id: 'e15-17', source: '15', target: '17', type: 'smoothstep' },
    { id: 'e16-17', source: '16', target: '17', type: 'smoothstep' },
    
    // Conexões lineares finais
    { id: 'e17-18', source: '17', target: '18', type: 'smoothstep' },
    { id: 'e18-19', source: '18', target: '19', type: 'smoothstep' },
    
    // Conexões para etapas paralelas na seção 12
    { id: 'e19-20', source: '19', target: '20', type: 'smoothstep' },
    { id: 'e19-21', source: '19', target: '21', type: 'smoothstep' },
    
    // Conexões das etapas paralelas da seção 12 para a etapa final
    { id: 'e20-22', source: '20', target: '22', type: 'smoothstep' },
    { id: 'e21-22', source: '21', target: '22', type: 'smoothstep' },
  ];

  // Função para lidar com mudanças nas posições dos nós
  const handleNodesChange = (changes: any) => {
    if (editMode && onEtapasChange) {
      // Atualiza as posições das etapas
      const updatedEtapas = [...etapasConfig];
      
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.id) {
          const index = updatedEtapas.findIndex(etapa => etapa.id === change.id);
          if (index !== -1 && change.position) {
            updatedEtapas[index] = {
              ...updatedEtapas[index],
              position: change.position
            };
          }
        }
      });
      
      setEtapasConfig(updatedEtapas);
      onEtapasChange(updatedEtapas);
    }
  };

  // Função para lidar com cliques nos nós
  const handleNodeClick: NodeMouseHandler = (event, node) => {
    if (editMode && onNodeClick) {
      console.log("Nó clicado no FluxogramaObra:", node);
      event.stopPropagation(); // Impedir propagação do evento
      onNodeClick(node);
    }
  };

  return (
    <div style={{ height: isMobile ? '300px' : '400px', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
        onNodesChange={handleNodesChange}
        nodesDraggable={editMode}
        onNodeClick={handleNodeClick}
        nodesConnectable={false}
        elementsSelectable={editMode}
      >
        <Controls showInteractive={false} />
        <Background color="#f8f8f8" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default FluxogramaObra; 