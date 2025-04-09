export const pdfStyles = `
  /* Estilos gerais */
  body {
    font-family: 'Helvetica', sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  /* Cabeçalho do relatório */
  .report-header {
    margin-bottom: 30px;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 15px;
  }

  .report-header h1 {
    font-size: 24px;
    color: #1a365d;
    margin: 0 0 10px 0;
  }

  .report-header .obra-nome {
    font-size: 18px;
    color: #4a5568;
    margin: 0 0 5px 0;
  }

  .report-header .data {
    color: #718096;
    font-size: 14px;
  }

  /* Seções */
  .section {
    margin-bottom: 25px;
    padding: 15px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .section-title {
    font-size: 20px;
    color: #2d3748;
    margin: 0 0 15px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }

  /* Cards */
  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .card-title {
    font-size: 16px;
    font-weight: bold;
    color: #2d3748;
    margin: 0 0 8px 0;
  }

  /* Etiquetas */
  .labels-container {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .label {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .label-green { background: #C6F6D5; color: #22543D; }
  .label-yellow { background: #FEFCBF; color: #744210; }
  .label-red { background: #FED7D7; color: #822727; }
  .label-blue { background: #BEE3F8; color: #2A4365; }
  .label-purple { background: #E9D8FD; color: #44337A; }
  .label-orange { background: #FEEBC8; color: #7B341E; }

  /* Checklist */
  .checklist {
    margin-top: 10px;
  }

  .checklist-title {
    font-size: 14px;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 8px;
  }

  .checklist-item {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }

  .checklist-item.completed {
    color: #718096;
    text-decoration: line-through;
  }

  /* Status */
  .status {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
  }

  .status-concluido {
    background: #C6F6D5;
    color: #22543D;
  }

  .status-fazendo {
    background: #FEFCBF;
    color: #744210;
  }

  /* Paginação */
  .page-number {
    text-align: center;
    font-size: 12px;
    color: #718096;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
  }
`; 