# Implementação de Empresas em Demandas - Guia Completo

## 1. SQL para Executar no Supabase

Execute o arquivo **`create_demanda_empresas.sql`** que foi gerado. Este script irá:

1. ✅ Criar tabela `demanda_empresas` (similar a `demanda_categorias`)
2. ✅ Adicionar coluna `empresa_id` em `demanda_itens`
3. ✅ Adicionar coluna `empresa` em `demanda_itens` (fallback para texto)
4. ✅ Criar índices de performance
5. ✅ Configurar RLS (Row Level Security)

## 2. Modificações Necessárias no Frontend

### 2.1 Atualizar `src/types/demanda.ts`

Adicione a interface para empresas:

```typescript
export interface DemandaEmpresa {
  id: number;
  obra_id: number;
  nome: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Atualizar a interface DemandaItem
export interface DemandaItem {
  id: number;
  obra_id: number;
  titulo: string;
  categoria?: string | null;
  empresa?: string | null;      // Novo
  empresa_id?: number | null;   // Novo
  descricao?: string;
  status: 'demanda' | 'pedido' | 'entregue' | 'pago';
  data_criacao: string;
  data_pedido?: string;
  data_entrega?: string;
  data_pagamento?: string;
  valor?: number;
  pedido_completo?: boolean;
  observacao_entrega?: string;
  nota_fiscal?: string[];
  tempo_entrega?: string;
  created_at: string;
  updated_at: string;
}
```

### 2.2 Atualizar `src/pages/DemandaObra.tsx`

1. **Adicionar estado para empresas** (similar a categorias):

```typescript
const [empresas, setEmpresas] = useState<DemandaEmpresa[]>([]);
const [novaEmpresa, setNovaEmpresa] = useState('');
const [editandoEmpresa, setEditandoEmpresa] = useState<{ id: number; nome: string } | null>(null);
const [editEmpresa, setEditEmpresa] = useState('__sem_empresa__');
```

2. **Adicionar função para carregar empresas** (copiar a lógica de `carregarCategorias`):

```typescript
const carregarEmpresas = useCallback(async () => {
  if (!id || isNaN(Number(id))) {
    return;
  }

  const { data, error } = await supabase
    .from('demanda_empresas')
    .select('id, obra_id, nome, ativo, created_at, updated_at')
    .eq('obra_id', Number(id))
    .order('nome', { ascending: true });

  if (error) {
    console.error('[DEBUG] DemandaObra - Erro ao carregar empresas:', error);
    throw error;
  }

  setEmpresas(
    (data as any[] | null || []).map((empresa) => ({
      id: empresa.id,
      obra_id: empresa.obra_id,
      nome: empresa.nome,
      ativo: empresa.ativo !== false,
      created_at: empresa.created_at,
      updated_at: empresa.updated_at,
    }))
  );
}, [id]);
```

3. **Chamar `carregarEmpresas()` no `useEffect` junto com `carregarCategorias()`**

4. **Adicionar funções CRUD para empresas** (copiar de categorias e adaptar):
   - `handleAdicionarEmpresa()`
   - `handleExcluirEmpresa()`
   - `handleReativarEmpresa()`
   - `handleSalvarEdicaoEmpresa()`

### 2.3 Atualizar `src/components/dialogs/AdicionarDemandaDialog.tsx`

1. **Adicionar `empresas` às props**:

```typescript
interface AdicionarDemandaDialogProps {
  // ... props existentes
  empresas: DemandaEmpresa[];
}
```

2. **Adicionar estado para empresa**:

```typescript
const [empresa, setEmpresa] = useState('__sem_empresa__');
```

3. **Criar seletor de empresas similar ao de categorias** no formulário

4. **Enviar `empresa` ao salvar a demanda**:

```typescript
// INSERT ou UPDATE
{
  // ... campos existentes
  empresa: empresa === '__sem_empresa__' ? null : empresa,
}
```

### 2.4 Adicionar UI para Gerenciar Empresas

Similar ao botão "Categorias", adicione um botão "Empresas" na página `DemandaObra.tsx` que abre um dialog para gerenciar empresas.

## 3. Modificação na Geração de Excel

No arquivo `src/pages/DemandaObra.tsx`, na função `gerarRelatorioMensalExcel()`:

### Adicionar nova aba com resumo por empresa:

```typescript
// Após criar o worksheet 'Relatorio Mensal', adicione:

// === ABA 2: RESUMO POR EMPRESA ===
const worksheetEmpresas = workbook.addWorksheet('Resumo por Empresa');

worksheetEmpresas.columns = [
  { key: 'empresa', width: 22 },
  { key: 'valor', width: 18 },
];

worksheetEmpresas.getCell('A1').value = `Resumo de Demandas por Empresa - ${obraNome}`;
worksheetEmpresas.mergeCells('A1:B1');
worksheetEmpresas.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
worksheetEmpresas.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
worksheetEmpresas.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
worksheetEmpresas.getRow(1).height = 24;

worksheetEmpresas.getCell('A2').value = `Período: ${format(inicioPeriodo, 'dd/MM/yyyy')} até ${format(agora, 'dd/MM/yyyy')}`;
worksheetEmpresas.mergeCells('A2:B2');
worksheetEmpresas.getCell('A2').font = { italic: true, color: { argb: 'FF4B5563' } };
worksheetEmpresas.addRow([]);

// Agrupar itens por empresa
const itensAgrupados_Empresas = new Map<string, number>();
const EMPRESA_SEM_NOME = 'Sem empresa';

itensOrdenados.forEach((item) => {
  const empresa = (item.empresa || '').trim() || EMPRESA_SEM_NOME;
  const valorAtual = itensAgrupados_Empresas.get(empresa) || 0;
  itensAgrupados_Empresas.set(empresa, valorAtual + Number(item.valor ?? 0));
});

// Header
const headerEmpresas = worksheetEmpresas.getRow(4);
headerEmpresas.values = ['Empresa', 'Total (R$)'];
headerEmpresas.font = { bold: true, color: { argb: 'FFFFFFFF' } };
headerEmpresas.alignment = { vertical: 'middle' };
headerEmpresas.height = 22;

['A4', 'B4'].forEach((cellRef) => {
  worksheetEmpresas.getCell(cellRef).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' },
  };
});

// Adicionar dados das empresas
let totalGeral = 0;
const empresasOrdenadas = Array.from(itensAgrupados_Empresas.entries())
  .sort((a, b) => b[1] - a[1]); // Ordenar por valor decrescente

empresasOrdenadas.forEach((empresa, index) => {
  const [nomeEmpresa, valor] = empresa;
  const row = worksheetEmpresas.addRow({
    empresa: nomeEmpresa,
    valor: valor,
  });

  const isPar = row.number % 2 === 0;
  const bgColor = isPar ? 'FFF8FAFC' : 'FFFFFFFF';
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  totalGeral += valor;
});

// Total
const linhaTotalEmpresas = worksheetEmpresas.addRow({
  empresa: 'TOTAL GERAL',
  valor: totalGeral,
});
linhaTotalEmpresas.font = { bold: true, color: { argb: 'FFFFFFFF' } };
linhaTotalEmpresas.eachCell((cell) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } },
  };
});

// Formatar coluna de valores
for (let i = 5; i <= worksheetEmpresas.rowCount; i += 1) {
  worksheetEmpresas.getCell(`B${i}`).numFmt = 'R$ #,##0.00';
  worksheetEmpresas.getCell(`B${i}`).alignment = { horizontal: 'right', vertical: 'middle' };
}
```

## 4. Passos de Implementação

1. ✅ Execute o SQL `create_demanda_empresas.sql` no Supabase
2. ✅ Atualize `src/types/demanda.ts` com novas interfaces
3. ✅ Implemente carregamento de empresas em `DemandaObra.tsx`
4. ✅ Adicione UI para gerenciar empresas
5. ✅ Atualize `AdicionarDemandaDialog.tsx` para suportar seleção de empresa
6. ✅ Modifique `gerarRelatorioMensalExcel()` para criar aba de resumo por empresa
7. ✅ Teste tudo completamente

## 5. Comportamento Esperado

- Página de demandas terá um novo botão "Empresas" (similar a "Categorias")
- Ao adicionar/editar demanda, haverá um dropdown para selecionar a empresa
- Excel terá 2 abas:
  - **"Relatorio Mensal"**: dados detalhados agrupados por categoria (já existente)
  - **"Resumo por Empresa"**: totais por empresa (NOVA)

## 6. Notas Importantes

- A coluna `empresa` em `demanda_itens` armazena o nome como texto (fallback)
- A coluna `empresa_id` referencia o ID da tabela `demanda_empresas`
- Empresas podem ser marcadas como inativas (similar às categorias)
- Usar `empresa_id` é recomendado, mas manter `empresa` garante compatibilidade
