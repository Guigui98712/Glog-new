export const pdfStyles = `
  /* Estilos gerais */
  body {
    font-family: 'Helvetica', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 210mm;
    margin: 0 auto;
    padding: 20px;
    background-color: #fff;
  }

  /* Cabeçalho do relatório */
  .header {
    margin-bottom: 30px;
    border-bottom: 2px solid #eee;
    padding-bottom: 15px;
    text-align: center;
  }

  .header h1 {
    margin: 0 0 10px;
    color: #2c3e50;
    font-size: 24px;
  }

  .obra-info, .data {
    margin: 5px 0;
    color: #666;
    font-size: 14px;
  }

  /* Seções */
  .section {
    margin: 20px 0;
    padding: 15px;
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    page-break-inside: avoid;
  }

  .section-title {
    margin: 0 0 15px;
    color: #2c3e50;
    font-size: 18px;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 8px;
  }

  /* Cards */
  .card {
    background-color: #fff;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 15px;
    margin: 10px 0;
    page-break-inside: avoid;
  }

  .card-title {
    margin: 0 0 10px;
    color: #2c3e50;
    font-size: 16px;
  }

  .card-description {
    margin: 10px 0;
    color: #666;
    font-size: 14px;
    white-space: pre-wrap;
  }

  /* Etiquetas */
  .labels-container {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 10px 0;
  }

  .label {
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
  }

  .label-green { background-color: #e3fcef; color: #0a7b3e; }
  .label-yellow { background-color: #fff8e6; color: #946800; }
  .label-red { background-color: #ffe9e9; color: #c92a2a; }
  .label-blue { background-color: #e7f5ff; color: #1864ab; }
  .label-purple { background-color: #f3f0ff; color: #5f3dc4; }
  .label-default { background-color: #f8f9fa; color: #495057; }

  /* Checklist */
  .checklist {
    margin: 15px 0;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 10px;
    background-color: #f8f9fa;
  }

  .checklist-title {
    margin: 0 0 10px;
    font-size: 14px;
    color: #495057;
  }

  .checklist-item {
    margin: 5px 0;
    font-size: 13px;
    color: #495057;
  }

  .checklist-item.completed {
    color: #82c91e;
    text-decoration: line-through;
  }

  /* Data de vencimento */
  .card-due-date {
    margin: 10px 0 0;
    font-size: 12px;
    color: #666;
  }

  /* Estilos de impressão */
  @media print {
    body {
      background-color: #fff !important;
    }

    .section, .card, .checklist {
      page-break-inside: avoid;
    }
  }
`; 