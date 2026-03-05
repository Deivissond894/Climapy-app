/**
 * Tipos compartilhados para geração de PDF
 */

export type PDFStyle = 'moderno' | 'minimalista';

export interface AtendimentoPDFData {
  codigo: string;
  clienteNome: string;
  clienteEndereco: string;
  produto: string;
  modelo: string;
  defeito?: string;
  valorVisita: string;
  status: string;
  data: string;
  hora?: string;
}
