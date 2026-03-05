/**
 * Constantes relacionadas aos atendimentos
 */

/**
 * Estágios válidos para atendimentos
 */
export const ESTAGIOS_VALIDOS = [
  'Diagnóstico',
  'Sob Consulta',
  'Aguardando',
  'Aprovado',
  'Recusado',
  'Executado',
  'Garantia'
] as const;

/**
 * Cores associadas a cada status para badges visuais
 */
export const STATUS_COLORS: Record<string, string> = {
  'Diagnóstico': '#3B82F6',    // Azul
  'Sob Consulta': '#F97316',   // Laranja
  'Aguardando': '#F59E0B',     // Amarelo/Laranja
  'Aprovado': '#10B981',       // Verde
  'Recusado': '#EF4444',       // Vermelho
  'Executado': '#8B5CF6',      // Roxo
  'Garantia': '#06B6D4'        // Ciano
};

/**
 * Descrições de cada estágio
 */
export const STATUS_DESCRIPTIONS: Record<string, string> = {
  'Diagnóstico': 'Atendimento em fase de diagnóstico inicial',
  'Sob Consulta': 'Orçamento enviado, aguardando decisão do cliente',
  'Aguardando': 'Aguardando aprovação ou peças',
  'Aprovado': 'Serviço aprovado pelo cliente',
  'Recusado': 'Serviço recusado pelo cliente',
  'Executado': 'Serviço executado e finalizado',
  'Garantia': 'Atendimento em garantia'
};

/**
 * Type para garantir type-safety nos status
 */
export type StatusAtendimento = typeof ESTAGIOS_VALIDOS[number];

/**
 * Status de orçamentos (subconjunto dos atendimentos "Sob Consulta")
 */
export const STATUS_ORCAMENTO = [
  'Consulta',
  'Finalizado',
  'Executado',
  'Fechado'
] as const;

/**
 * Cores associadas aos status de orçamento
 */
export const STATUS_ORCAMENTO_COLORS: Record<string, string> = {
  'Consulta': '#F59E0B',      // Amarelo/Laranja
  'Finalizado': '#10B981',    // Verde
  'Executado': '#1BAFE0',     // Azul
  'Fechado': '#6B7280'        // Cinza
};

/**
 * Type para status de orçamento
 */
export type StatusOrcamento = typeof STATUS_ORCAMENTO[number];

/**
 * Status padrão quando não informado
 */
export const STATUS_PADRAO: StatusAtendimento = 'Diagnóstico';
