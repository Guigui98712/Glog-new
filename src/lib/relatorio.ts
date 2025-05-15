import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { obterQuadroObra } from './trello-local';

// Função para gerar relatório semanal (versão alternativa)
export const gerarRelatorioSemanalV2 = async (
  obraId: number, 
  dataInicio: string, 
  dataFim: string, 
  presencas: any[] = [],
  incluirPendencias: boolean = true,
  incluirPresenca: boolean = true,
  etapasFluxograma?: { id: string; nome: string }[]
) => {
  console.log('[DEBUG] Iniciando geração de relatório semanal V2...', {
    obraId,
    dataInicio,
    dataFim,
    incluirPendencias,
    incluirPresenca
  });

  try {
    // Buscar dados da obra
    const { data: obra, error: obraError } = await supabase
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .single();

    if (obraError) {
      console.error('[DEBUG] Erro ao buscar obra:', obraError);
      throw new Error('Não foi possível encontrar a obra');
    }

    if (!obra) {
      console.error('[DEBUG] Obra não encontrada:', { obraId });
      throw new Error('Obra não encontrada');
    }

    console.log('[DEBUG] Obra encontrada:', obra);

    // Buscar o primeiro registro do diário
    const { data: primeiroRegistro, error: erroRegistro } = await supabase
      .from('diario_obra')
      .select('data')
      .eq('obra_id', obraId)
      .order('data', { ascending: true })
      .limit(1)
      .single();

    // Buscar registros do período
    const { data: registros = [], error: registrosError } = await supabase
      .from('diario_obra')
      .select('*')
      .eq('obra_id', obraId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: true });

    if (registrosError) {
      console.error('[DEBUG] Erro ao buscar registros:', registrosError);
    }

    console.log('[DEBUG] Registros encontrados:', registros.length);
    console.log('[DEBUG] Registros:', registros);

    // Buscar pendências da obra (quadro Trello)
    let pendencias = { lists: [] };
    try {
      pendencias = await obterQuadroObra(obraId);
      console.log('[DEBUG] Pendências encontradas:', pendencias);
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar pendências:', error);
    }

    // Buscar etapas em andamento
    const etapasEmAndamento = [];
    const etapasConcluidas = [];
    const etapasInfo = new Map();

    try {
      // Buscar todos os registros do diário para análise de etapas
      const { data: todosRegistros = [] } = await supabase
        .from('diario_obra')
        .select('data, etapas_iniciadas, etapas_concluidas')
        .eq('obra_id', obraId)
        .order('data', { ascending: true });

      // Processar etapas iniciadas e concluídas
      todosRegistros.forEach(registro => {
        const data = registro.data;
        
        // Registrar etapas iniciadas
        registro.etapas_iniciadas?.forEach(etapa => {
          if (!etapasInfo.has(etapa)) {
            // Verificar se a etapa existe no fluxograma
            const etapaExiste = etapasFluxograma ? etapasFluxograma.some(e => e.nome === etapa) : true;
            
            if (etapaExiste) {
              etapasInfo.set(etapa, {
                nome: etapa,
                data_inicio: data,
                status: 'em_andamento'
              });
            }
          }
        });
        
        // Registrar etapas concluídas
        registro.etapas_concluidas?.forEach(etapa => {
          const info = etapasInfo.get(etapa);
          if (info) {
            info.data_fim = data;
            info.status = 'concluida';
          }
        });
      });

      // Separar etapas em andamento e concluídas
      etapasInfo.forEach(info => {
        if (info.status === 'em_andamento') {
          etapasEmAndamento.push(info);
        } else {
          etapasConcluidas.push(info);
        }
      });

      console.log('[DEBUG] Etapas em andamento:', etapasEmAndamento);
      console.log('[DEBUG] Etapas concluídas:', etapasConcluidas);
    } catch (error) {
      console.error('[DEBUG] Erro ao processar etapas:', error);
    }

    // Ajustar as datas
    const dataInicioObj = parseISO(dataInicio);
    const dataFimObj = parseISO(dataFim);

    // String para armazenar o HTML das observações, para ser inserido no final
    const observacoesHtml = `
      ${registros
        .filter(registro => registro.observacoes?.trim())
        .map(registro => `
          <div class="registro-observacoes bg-gray-50 p-3 rounded-md mb-3 italic text-gray-700 text-sm">
            ${registro.observacoes.replace(/\\n/g, '<br>')}
          </div>
        `).join('')}
      ${registros.filter(registro => registro.observacoes?.trim()).length === 0 ?
        '<p class="text-sm text-gray-500">Nenhuma observação registrada para o período.</p>' : ''}
    `;

    // Gerar HTML do relatório
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório Semanal - ${obra.nome}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            margin: 15mm;
            size: A4;
          }
          body {
            font-family: Arial, sans-serif; /* Mantém fonte padrão para impressão */
            -webkit-print-color-adjust: exact; /* Força impressão de cores */
            print-color-adjust: exact;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Estilos específicos para impressão que o Tailwind pode não cobrir */
          @media print {
            body { background-color: white !important; }
            .no-print { display: none; }
            .info-block, .registro, .foto-container, .presenca-table, .pendencia-item {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body class="bg-gray-100 p-2 md:p-4">
        <div class="container mx-auto bg-white p-4 md:p-6 rounded-lg shadow-md max-w-4xl print-avoid-break">
          <div class="header text-center mb-6">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-800">${obra.nome}</h1>
            <p class="text-lg md:text-xl text-gray-600">Relatório Semanal</p>
            <p class="text-sm text-gray-500">${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}</p>
          </div>

          <!-- Atividades e Etapas -->
          <div class="info-block mb-6 print-avoid-break">
            <h3 class="text-lg md:text-xl font-semibold text-gray-700 border-b pb-2 mb-3">Atividades e Etapas</h3>
            ${registros.length === 0 ? '<p class="text-sm text-gray-500">Nenhum registro de atividade no período.</p>' :
              registros.map(registro => {
                const descricaoLinhas = registro.descricao
                  ? registro.descricao.split('\\n').filter(linha => linha.trim())
                  : [];

                return `
                  <div class="registro mb-4 pb-4 border-b last:border-b-0 print-avoid-break">
                    <div class="mt-2 text-sm text-gray-700 space-y-2">
                      <div>${descricaoLinhas.join('<br>')}</div>

                      ${registro.etapas_iniciadas?.length ? `
                        <div class="space-y-1">
                          ${registro.etapas_iniciadas.map(etapa =>
                            `<div class="flex items-center text-xs md:text-sm bg-green-100 text-green-800 px-3 py-1.5 rounded-md">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                              <span>Iniciada: ${etapa}</span>
                             </div>`
                          ).join('')}
                        </div>
                      ` : ''}

                      ${registro.etapas_concluidas?.length ? `
                        <div class="space-y-1">
                          ${registro.etapas_concluidas.map(etapa =>
                            `<div class="flex items-center text-xs md:text-sm bg-orange-100 text-orange-800 px-3 py-1.5 rounded-md">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                              <span>Concluída: ${etapa}</span>
                             </div>`
                          ).join('')}
                        </div>
                      ` : ''}
                    </div>

                    ${registro.fotos?.length ? `
                      <div class="foto-container mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 print-avoid-break">
                        ${registro.fotos.map(foto =>
                          `<img src="${foto}" alt="Foto da atividade" class="w-full h-auto rounded-md object-cover border" onerror="this.style.display='none'">`
                        ).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')
            }
          </div>

          <!-- Etapas em Andamento -->
          <div class="info-block mb-6 print-avoid-break">
            <h3 class="text-lg md:text-xl font-semibold text-gray-700 border-b pb-2 mb-3">Etapas em Andamento</h3>
            ${etapasEmAndamento.length > 0 ? `
              <div class="space-y-2">
                ${etapasEmAndamento.map(etapa => `
                  <div class="etapa-andamento bg-blue-100 text-blue-800 p-3 rounded-md text-sm">
                    ${etapa.nome}
                    <div class="text-xs text-blue-600 mt-1">Iniciada em: ${format(parseISO(etapa.data_inicio), 'dd/MM/yyyy')}</div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-sm text-gray-500">Nenhuma etapa em andamento no momento.</p>'}
          </div>

          <!-- Pendências -->
          ${incluirPendencias ? `
          <div class="info-block mb-6 print-avoid-break">
            <h3 class="text-lg md:text-xl font-semibold text-gray-700 border-b pb-2 mb-3">Pendências da Obra</h3>
            ${pendencias.lists.length > 0 ? `
              <div class="space-y-4">
                ${pendencias.lists.map(lista => `
                  <div>
                    <div class="lista-titulo font-semibold text-gray-600 mb-2 text-base">${lista.title}</div>
                    ${lista.cards && lista.cards.length > 0 ?
                      lista.cards
                        .filter(card => !card.labels?.some(label => (typeof label === 'string' ? label : (label.title || label.toString())) === 'Feito'))
                        .map(card => `
                          <div class="pendencia-item bg-gray-50 p-3 rounded-md mb-2 border print-avoid-break">
                            <div class="pendencia-titulo font-medium text-sm text-gray-800">${card.title}</div>
                            ${card.description ? `<div class="pendencia-descricao text-xs text-gray-600 mt-1">${card.description.replace(/\\n/g, '<br>')}</div>` : ''}
                            ${card.labels && card.labels.length > 0 ? `
                              <div class="mt-2 flex flex-wrap gap-1.5">
                                ${card.labels.map(label => {
                                  const labelText = typeof label === 'string' ? label : (label.title || label.toString());
                                  let bgColorClass = 'bg-gray-500';
                                  if (labelText === 'Urgente') bgColorClass = 'bg-red-500';
                                  else if (labelText === 'Fazendo') bgColorClass = 'bg-yellow-500';
                                  else if (labelText === 'Feito') bgColorClass = 'bg-green-500';
                                  return `<span class="text-xs text-white ${bgColorClass} px-2 py-0.5 rounded-full">${labelText}</span>`;
                                }).join('')}
                              </div>
                            ` : ''}
                          </div>
                        `).join('') : '<p class="text-xs text-gray-500">Nenhuma pendência nesta lista.</p>'
                    }
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-sm text-gray-500">Nenhuma pendência registrada para esta obra.</p>'}
          </div>
          ` : ''}

          <!-- Controle de Presença -->
          ${incluirPresenca && presencas?.length ? `
            <div class="info-block mb-6 print-avoid-break">
              <h3 class="text-lg md:text-xl font-semibold text-gray-700 border-b pb-2 mb-3">Controle de Presença</h3>
              <div class="overflow-x-auto">
                <table class="presenca-table w-full border-collapse border border-gray-200 text-xs md:text-sm print-avoid-break">
                  <thead>
                    <tr class="bg-gray-100">
                      <th class="border border-gray-200 p-2 text-left font-medium text-gray-600">Funcionário</th>
                      ${(() => {
                        const diasUteis = [];
                        const inicioSemana = parseISO(dataInicio);
                        for (let i = 0; i < 5; i++) {
                          const dia = new Date(inicioSemana);
                          dia.setDate(inicioSemana.getDate() + i);
                          diasUteis.push(format(dia, 'yyyy-MM-dd'));
                        }
                        return diasUteis.map(data => `
                          <th class="border border-gray-200 p-2 text-center font-medium text-gray-600 whitespace-nowrap">
                            ${format(parseISO(data), 'EEE, dd/MM', { locale: ptBR })}
                          </th>`).join('');
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    ${presencas.map((funcionario: any) => `
                      <tr class="border-b border-gray-200">
                        <td class="border border-gray-200 p-2 whitespace-nowrap">${funcionario.nome}</td>
                        ${(() => {
                          const diasUteis = [];
                          const inicioSemana = parseISO(dataInicio);
                          for (let i = 0; i < 5; i++) {
                            const dia = new Date(inicioSemana);
                            dia.setDate(inicioSemana.getDate() + i);
                            diasUteis.push(format(dia, 'yyyy-MM-dd'));
                          }
                          return diasUteis.map(data => {
                            const presenca = funcionario.presencas[data];
                            let classe = 'bg-red-100 text-red-700';
                            let texto = '✗';
                            if (presenca === 1) {
                              classe = 'bg-green-100 text-green-700';
                              texto = '✓';
                            } else if (presenca === 0.5) {
                              classe = 'bg-yellow-100 text-yellow-700';
                              texto = '½';
                            }
                            return `<td class="border border-gray-200 p-2 text-center font-bold ${classe}">${texto}</td>`;
                          }).join('');
                        })()}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Observações do Período -->
          <div class="info-block mb-6 print-avoid-break">
            <h3 class="text-lg md:text-xl font-semibold text-gray-700 border-b pb-2 mb-3">Observações do Período</h3>
            ${observacoesHtml}
          </div>
        </div>

        <!-- Footer -->
        <div class="footer mt-8 text-center text-xs text-gray-500 pt-4 border-t print-avoid-break">
          <p>Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          <p>${obra.nome} - Todos os direitos reservados</p>
        </div>
      </body>
      </html>
    `;

    return html;
  } catch (error) {
    console.error('[DEBUG] Erro ao gerar relatório:', error);
    throw error;
  }
}; 