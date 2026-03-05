/**
 * Tipos e interfaces para Atendimentos
 * Garante tipagem consistente entre frontend e backend
 */

/**
 * Dados brutos do atendimento conforme retorna a API
 * Esto é o formato que o backend retorna em GET, POST, PUT
 */
export interface AtendimentoRaw {
  // Identificadores
  id?: string;
  codigo?: string;
  codigoPedido?: string;
  _id?: string;

  // Cliente
  uid?: string;
  clienteCodigo?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteCPF?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  cliente?: string;
  Cliente?: string;

  // Endereço
  clienteEndereco?: string;
  endereco?: string;
  Endereco?: string;
  rua?: string;
  numero?: string;

  // Produto/Serviço
  Produto?: string;
  produto?: string;
  modelo?: string;

  // Datas e horários
  data?: string;
  hora?: string;
  dataAgendamento?: string;

  // Valores
  valorVisita?: string | number;
  valorTotal?: string | number;
  preco?: string | number;

  // Status e descrição
  Status?: string;
  status?: string;
  descricaoDefeito?: string;
  descricao?: string;

  // Extras
  notas?: string[];
  historico?: string[];
  notas_internas?: string;
  observacoes?: string;
  foto?: string | null;

  // Timestamp (opcional)
  createdAt?: string;
  updatedAt?: string;
  data_criacao?: string;
  data_atualizacao?: string;

  // Campos adicionais que podem vir
  [key: string]: any;
}

/**
 * Resposta padrão da API para criar/atualizar atendimento
 */
export interface AtendimentoAPIResponse {
  success: boolean;
  message?: string;
  data?: AtendimentoRaw;
  codigo?: string;
  id?: string;
  atendimento?: AtendimentoRaw;

  // Fallback para estruturas diferentes
  [key: string]: any;
}

/**
 * Interface normalizada para UI (usado em Order e cards)
 * Este é o formato final que a UI consome
 */
export interface AtendimentoNormalizado {
  id: string;
  codigo: string;
  clienteNome: string;
  clienteEndereco: string;
  produto: string;
  data: string;
  hora: string;
  status: string;
  valorVisita: string;
  valorTotal: string;
  descricaoDefeito?: string;
  notas?: string[];
  historico?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Função para extrair ID primário de um atendimento
 * Tenta múltiplas opções em ordem de prioridade
 */
export const extrairAtendimentoId = (atendimento: AtendimentoRaw | undefined): string => {
  if (!atendimento) return '';

  // Prioridade: codigo > id > codigoPedido > _id
  const id = 
    String(atendimento.codigo || atendimento.id || atendimento.codigoPedido || atendimento._id || '').trim();

  return id;
};

/**
 * Função para validar se um atendimento tem dados mínimos necessários
 */
export const validarAtendimentoMinimo = (atendimento: AtendimentoRaw | undefined): boolean => {
  if (!atendimento) return false;
  
  // Se é um objeto vazio, rejeitar
  if (typeof atendimento !== 'object' || Object.keys(atendimento).length === 0) return false;

  const id = extrairAtendimentoId(atendimento);
  const clienteNome = (atendimento.clienteNome || atendimento.cliente || atendimento.Cliente || '').trim();

  // Precisa ter ID OU código
  // Precisa ter nome do cliente
  const temId = id.length > 0;
  const temCliente = clienteNome.length > 0;
  
  return temId && temCliente;
};

/**
 * Normalizar atendimento bruto para formato padrão
 * Garante que todos os campos existem com valores seguros
 */
export const normalizarAtendimento = (raw: AtendimentoRaw | undefined): AtendimentoNormalizado | null => {
  if (!raw || !validarAtendimentoMinimo(raw)) {
    return null;
  }

  const id = extrairAtendimentoId(raw);
  
  const clienteNome = (
    raw.clienteNome ||
    raw.cliente ||
    raw.Cliente ||
    'Cliente não informado'
  ).trim();

  const clienteEndereco = (
    raw.clienteEndereco ||
    raw.endereco ||
    raw.Endereco ||
    raw.address ||
    'Endereço não informado'
  ).trim();

  const produto = (
    raw.Produto ||
    raw.produto ||
    raw.modelo ||
    ''
  ).trim();

  const data = (raw.data || raw.dataAgendamento || 'Data não informada').trim();
  const hora = (raw.hora || 'Horário comercial').trim();

  const status = (raw.Status || raw.status || 'Diagnóstico').trim();

  const valorVisita = String(raw.valorVisita || raw.preco || 'R$ 0,00').trim();
  const valorTotal = String(raw.valorTotal || raw.preco || 'R$ 0,00').trim();

  return {
    id,
    codigo: id,
    clienteNome,
    clienteEndereco,
    produto,
    data,
    hora,
    status,
    valorVisita,
    valorTotal,
    descricaoDefeito: (raw.descricaoDefeito || raw.descricao || '').trim(),
    notas: Array.isArray(raw.notas) ? raw.notas : [],
    historico: Array.isArray(raw.historico) ? raw.historico : [],
    createdAt: raw.createdAt || raw.data_criacao,
    updatedAt: raw.updatedAt || raw.data_atualizacao,
  };
};
