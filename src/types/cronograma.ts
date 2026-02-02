export type CronogramaStatus = 0 | 1 | 2 | 3; // 0 = nenhum, 1 = previsto (azul), 2 = fazendo (amarelo), 3 = efetuado (verde)

export interface Cronograma {
  id: string;
  obra_id: number;
  nome: string;
  data: {
    weeks?: string[]; // dates (Friday) in ISO
    months?: string[]; // month start dates in ISO
    etapas: string[]; // etapa names
    cells: Record<string, CronogramaStatus[]>; // key=etapa, value=array of statuses aligned with weeks or months
  };
  created_at?: string;
}
