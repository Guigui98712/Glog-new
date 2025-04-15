export interface DemandaItem {
  id: number;
  obra_id: number;
  titulo: string;
  descricao?: string;
  status: 'demanda' | 'pedido' | 'entregue' | 'pago';
  data_criacao: string;
  data_pedido?: string;
  data_entrega?: string;
  data_pagamento?: string;
  valor?: number;
  pedido_completo?: boolean;
  observacao_entrega?: string;
  nota_fiscal?: string;
  tempo_entrega?: string; // Tempo calculado entre pedido e entrega
  created_at: string;
  updated_at: string;
}

export interface ListaDemanda {
  id: string;
  itens: string[];
  obra_id: number;
  created_at: string;
} 