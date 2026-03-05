import type { AtendimentoPDFData } from './pdfTypes';

export const generateModernoHTML = (data: AtendimentoPDFData): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordem de Serviço - ${data.codigo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      padding: 20px;
      color: #333;
      background: #fff;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 0;
    }
    
    .header {
      background: linear-gradient(135deg, #1BAFE0 0%, #7902E0 100%);
      color: white;
      padding: 20px;
      text-align: center;
      border-bottom: 3px solid #000;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .info-section {
      padding: 15px 20px;
      border-bottom: 1px solid #ddd;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #7902E0;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #7902E0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    
    .info-item {
      margin-bottom: 8px;
    }
    
    .info-label {
      font-size: 11px;
      color: #666;
      font-weight: bold;
      text-transform: uppercase;
      display: block;
      margin-bottom: 3px;
    }
    
    .info-value {
      font-size: 13px;
      color: #000;
      padding: 6px 8px;
      background: #f5f5f5;
      border-radius: 4px;
      min-height: 28px;
      display: block;
    }
    
    .full-width {
      grid-column: 1 / -1;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 13px;
      color: white;
      background: #7902E0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    table th {
      background: #f0f0f0;
      padding: 10px;
      text-align: left;
      font-size: 12px;
      border: 1px solid #ddd;
      font-weight: bold;
    }
    
    table td {
      padding: 10px;
      border: 1px solid #ddd;
      font-size: 12px;
      min-height: 35px;
    }
    
    .footer {
      padding: 20px;
      background: #f9f9f9;
      border-top: 2px solid #000;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
    }
    
    .signature-line {
      border-top: 2px solid #000;
      margin-top: 50px;
      padding-top: 8px;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }
    
    .total-section {
      margin-top: 20px;
      padding: 15px;
      background: #f0f0f0;
      border-radius: 8px;
      text-align: right;
    }
    
    .total-value {
      font-size: 20px;
      font-weight: bold;
      color: #7902E0;
    }
    
    .metadata {
      font-size: 10px;
      color: #999;
      text-align: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ORDEM DE SERVIÇO</h1>
      <div class="subtitle">Climapy - Assistência Técnica</div>
      <div class="subtitle" style="margin-top: 5px;">O.S. Nº ${data.codigo}</div>
    </div>
    
    <div class="info-section">
      <div class="section-title">Dados do Cliente</div>
      <div class="info-grid">
        <div class="info-item full-width">
          <span class="info-label">Nome do Cliente</span>
          <span class="info-value">${data.clienteNome || ''}</span>
        </div>
        <div class="info-item full-width">
          <span class="info-label">Endereço</span>
          <span class="info-value">${data.clienteEndereco || ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Telefone</span>
          <span class="info-value"></span>
        </div>
        <div class="info-item">
          <span class="info-label">CPF/CNPJ</span>
          <span class="info-value"></span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="section-title">Dados do Equipamento</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Produto</span>
          <span class="info-value">${data.produto || ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Modelo</span>
          <span class="info-value">${data.modelo || ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Número de Série</span>
          <span class="info-value"></span>
        </div>
        <div class="info-item">
          <span class="info-label">Marca</span>
          <span class="info-value"></span>
        </div>
        <div class="info-item full-width">
          <span class="info-label">Defeito Reclamado</span>
          <span class="info-value">${data.defeito || ''}</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="section-title">Dados do Atendimento</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Data do Atendimento</span>
          <span class="info-value">${data.data || ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Horário</span>
          <span class="info-value">${data.hora || 'Horário Comercial'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value"><span class="status-badge">${data.status || 'Diagnóstico'}</span></span>
        </div>
        <div class="info-item">
          <span class="info-label">Técnico Responsável</span>
          <span class="info-value"></span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="section-title">Serviços Executados</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Descrição do Serviço</th>
            <th style="width: 15%;">Qtd</th>
            <th style="width: 20%;">Valor Unit.</th>
            <th style="width: 15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Visita Técnica</td>
            <td>1</td>
            <td>${data.valorVisita || 'R$ 0,00'}</td>
            <td>${data.valorVisita || 'R$ 0,00'}</td>
          </tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
      
      <div class="total-section">
        <span class="total-value">TOTAL: ${data.valorVisita || 'R$ 0,00'}</span>
      </div>
    </div>
    
    <div class="info-section">
      <div class="section-title">Peças Utilizadas</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Descrição da Peça</th>
            <th style="width: 15%;">Qtd</th>
            <th style="width: 20%;">Valor Unit.</th>
            <th style="width: 15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <div class="signature-section">
        <div><div class="signature-line">Técnico Responsável</div></div>
        <div><div class="signature-line">Assinatura do Cliente</div></div>
      </div>
      
      <div class="metadata">
        Documento gerado em ${dataAtual} às ${horaAtual} | Climapy - Assistência Técnica
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateMinimalistaHTML = (data: AtendimentoPDFData): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 30px; color: #111; background: #fff; }
    .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #4CAF50; }
    .header h1 { font-size: 24px; color: #4CAF50; margin-bottom: 5px; }
    .header .os-number { font-size: 18px; color: #666; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #4CAF50; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .row { display: flex; margin-bottom: 10px; }
    .label { width: 180px; font-size: 12px; color: #666; font-weight: 600; }
    .value { flex: 1; font-size: 12px; color: #111; padding: 5px; background: #f9f9f9; border-left: 3px solid #4CAF50; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table th { background: #4CAF50; color: white; padding: 8px; text-align: left; font-size: 11px; }
    table td { padding: 8px; border: 1px solid #ddd; font-size: 11px; }
    .total { text-align: right; margin-top: 15px; font-size: 18px; font-weight: bold; color: #4CAF50; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; }
    .signature { text-align: center; flex: 1; }
    .signature-line { border-top: 1px solid #111; margin-top: 40px; padding-top: 5px; font-size: 10px; }
    .meta { font-size: 9px; color: #999; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ordem de Serviço</h1>
    <div class="os-number">O.S. Nº ${data.codigo}</div>
    <div class="meta" style="margin-top: 5px;">Climapy - Assistência Técnica</div>
  </div>
  
  <div class="section">
    <div class="section-title">Cliente</div>
    <div class="row"><div class="label">Nome:</div><div class="value">${data.clienteNome}</div></div>
    <div class="row"><div class="label">Endereço:</div><div class="value">${data.clienteEndereco}</div></div>
    <div class="row"><div class="label">Telefone:</div><div class="value"></div></div>
    <div class="row"><div class="label">CPF/CNPJ:</div><div class="value"></div></div>
  </div>
  
  <div class="section">
    <div class="section-title">Equipamento</div>
    <div class="row"><div class="label">Produto:</div><div class="value">${data.produto}</div></div>
    <div class="row"><div class="label">Modelo:</div><div class="value">${data.modelo}</div></div>
    <div class="row"><div class="label">Defeito:</div><div class="value">${data.defeito || ''}</div></div>
  </div>
  
  <div class="section">
    <div class="section-title">Atendimento</div>
    <div class="row"><div class="label">Data:</div><div class="value">${data.data}</div></div>
    <div class="row"><div class="label">Horário:</div><div class="value">${data.hora || 'Horário Comercial'}</div></div>
    <div class="row"><div class="label">Status:</div><div class="value">${data.status}</div></div>
    <div class="row"><div class="label">Técnico:</div><div class="value"></div></div>
  </div>
  
  <div class="section">
    <div class="section-title">Serviços</div>
    <table>
      <thead><tr><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td>Visita Técnica</td><td>1</td><td>${data.valorVisita}</td><td>${data.valorVisita}</td></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      </tbody>
    </table>
    <div class="total">TOTAL: ${data.valorVisita || 'R$ 0,00'}</div>
  </div>
  
  <div class="footer">
    <div class="signature"><div class="signature-line">Técnico Responsável</div></div>
    <div class="signature"><div class="signature-line">Assinatura do Cliente</div></div>
  </div>
  
  <div class="meta">Gerado em ${dataAtual} às ${horaAtual}</div>
</body>
</html>
  `;
};
