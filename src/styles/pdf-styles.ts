export const pdfStyles = `
  /* Estilos gerais */
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    padding: 20px;
    margin: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 0;
    color: #1e293b;
    break-after: avoid;
    page-break-after: avoid;
  }

  p {
    margin-bottom: 0.8em;
    orphans: 4;
    widows: 4;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    break-inside: avoid;
    page-break-inside: avoid;
  }

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background-color: #f8fafc;
    font-weight: 600;
  }

  .card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .labels-container {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 5px 0;
  }

  .label {
    display: inline-block;
    background-color: #e2e8f0;
    color: #1e293b;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 9px;
    font-weight: 500;
    margin-right: 3px;
    margin-bottom: 3px;
    white-space: nowrap;
  }

  .label.warning {
    background-color: #fef3c7;
    color: #92400e;
  }

  .label.error {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  .label.success {
    background-color: #dcfce7;
    color: #166534;
  }

  .label.info {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 10px;
    break-after: avoid;
    page-break-after: avoid;
  }

  .section {
    margin-bottom: 25px;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .section-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 15px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
    break-after: avoid;
    page-break-after: avoid;
  }

  .divider {
    height: 1px;
    background-color: #e2e8f0;
    margin: 20px 0;
  }

  .checklist-item {
    margin: 6px 0;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    break-inside: avoid;
    page-break-inside: avoid;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .checklist-status {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    margin-right: 6px;
  }

  .status-pending {
    background-color: #fef3c7;
    color: #92400e;
  }

  .status-completed {
    background-color: #dcfce7;
    color: #166534;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      word-break: keep-all;
    }
    
    .page-break {
      break-before: page;
      page-break-before: always;
    }
    
    .no-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    * {
      box-decoration-break: clone;
    }
    
    p, span, div, li {
      word-wrap: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }
  }
`; 