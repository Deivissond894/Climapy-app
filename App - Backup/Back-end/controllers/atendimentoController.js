const { admin } = require('../config/firebase');

const ESTAGIOS_VALIDOS = ['Diagnóstico', 'Sob Consulta', 'Aguardando', 'Aprovado', 'Recusado', 'Executado', 'Garantia'];

const atendimentoController = {
  // Criar novo atendimento
  createAtendimento: async (req, res) => {
    try {
      const uid = req.user.uid; // Obter do token decodificado
      const { clienteNome, clienteEndereco, produto, modelo, data, valorVisita, Status } = req.body;

      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
      }

      const atendimentosRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos');
      const snapshot = await atendimentosRef.get();
      const nextNumber = snapshot.size + 1;
      const codigo = `ATD-${String(nextNumber).padStart(4, '0')}`;

      const atendimentoData = {
        codigo,
        clienteNome: clienteNome || '',
        clienteEndereco: clienteEndereco || '',
        produto: produto || '',
        modelo: modelo || '',
        data: data || new Date().toLocaleDateString('pt-BR'),
        valorVisita: valorVisita || 'R$ 0,00',
        valorTotal: 'R$ 0,00',
        Status: Status || 'Diagnóstico',
        orcamento: null,
        notas: [],
        historico: [`Criado em ${new Date().toLocaleString('pt-BR')}`],
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      };

      await atendimentosRef.doc(codigo).set(atendimentoData);

      // Retornar dados sem FieldValue (que não é serializável)
      const responseData = {
        codigo,
        clienteNome: atendimentoData.clienteNome,
        clienteEndereco: atendimentoData.clienteEndereco,
        produto: atendimentoData.produto,
        modelo: atendimentoData.modelo,
        data: atendimentoData.data,
        valorVisita: atendimentoData.valorVisita,
        valorTotal: atendimentoData.valorTotal,
        Status: atendimentoData.Status,
        orcamento: atendimentoData.orcamento,
        notas: atendimentoData.notas,
        historico: atendimentoData.historico,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      return res.status(201).json({
        success: true,
        message: 'Atendimento criado com sucesso!',
        data: responseData
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar atendimento.',
        error: error.message
      });
    }
  },

  // Listar atendimentos do usuário
  listAtendimentos: async (req, res) => {
    try {
      const uid = req.user.uid; // Obter do token decodificado

      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
      }

      const atendimentosRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos');
      const snapshot = await atendimentosRef.orderBy('criadoEm', 'desc').get();

      const atendimentos = [];
      snapshot.forEach(doc => {
        atendimentos.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return res.status(200).json({
        success: true,
        count: atendimentos.length,
        data: atendimentos
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar atendimentos.',
        error: error.message
      });
    }
  },

  // Obter atendimento específico
  getAtendimento: async (req, res) => {
    try {
      const uid = req.user.uid; // Obter do token decodificado
      const { atendimentoId } = req.params;

      if (!uid || !atendimentoId) {
        return res.status(400).json({ success: false, message: 'UID ou ID do atendimento não informado.' });
      }

      const atendimentoRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos').doc(atendimentoId);
      const doc = await atendimentoRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: 'Atendimento não encontrado.' });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: doc.id,
          ...doc.data()
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar atendimento.',
        error: error.message
      });
    }
  },

  // Atualizar atendimento
  updateAtendimento: async (req, res) => {
    try {
      const uid = req.user.uid; // Obter do token decodificado
      const { atendimentoId } = req.params;
      const updates = req.body;

      if (!uid || !atendimentoId) {
        return res.status(400).json({ success: false, message: 'UID ou ID do atendimento não informado.' });
      }

      const atendimentoRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos').doc(atendimentoId);
      const doc = await atendimentoRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: 'Atendimento não encontrado.' });
      }

      // Validar Status se for alterado
      if (updates.Status && !ESTAGIOS_VALIDOS.includes(updates.Status)) {
        return res.status(400).json({
          success: false,
          message: `Status inválido. Estagios válidos: ${ESTAGIOS_VALIDOS.join(', ')}`
        });
      }

      // Adicionar ao histórico
      const historico = doc.data().historico || [];
      historico.push(`Atualizado em ${new Date().toLocaleString('pt-BR')}`);

      await atendimentoRef.update({
        ...updates,
        historico,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        success: true,
        message: 'Atendimento atualizado com sucesso!',
        data: { id: atendimentoId, ...updates }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar atendimento.',
        error: error.message
      });
    }
  },

  // Atualizar orçamento
  updateOrcamento: async (req, res) => {
    try {
      const { atendimentoId } = req.params;
      const { uid, ...orcamentoData } = req.body;

      if (!uid || !atendimentoId) {
        return res.status(400).json({ success: false, message: 'UID ou ID do atendimento não informado.' });
      }

      const atendimentoRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos').doc(atendimentoId);
      const doc = await atendimentoRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: 'Atendimento não encontrado.' });
      }

      await atendimentoRef.update({
        orcamento: orcamentoData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        success: true,
        message: 'Orçamento atualizado com sucesso!',
        data: { id: atendimentoId, orcamento: orcamentoData }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar orçamento.',
        error: error.message
      });
    }
  },

  // Deletar atendimento
  deleteAtendimento: async (req, res) => {
    try {
      const uid = req.user.uid; // Obter do token decodificado
      const { atendimentoId } = req.params;

      if (!uid || !atendimentoId) {
        return res.status(400).json({ success: false, message: 'UID ou ID do atendimento não informado.' });
      }

      const atendimentoRef = admin.firestore().collection('Usuarios').doc(uid).collection('Atendimentos').doc(atendimentoId);
      const doc = await atendimentoRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, message: 'Atendimento não encontrado.' });
      }

      await atendimentoRef.delete();

      return res.status(200).json({
        success: true,
        message: 'Atendimento deletado com sucesso!',
        data: { id: atendimentoId, deletedAt: new Date().toISOString() }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar atendimento.',
        error: error.message
      });
    }
  },

  // Listar estágios válidos
  listEstagios: async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        estagios: ESTAGIOS_VALIDOS
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar estágios.',
        error: error.message
      });
    }
  }
};

module.exports = atendimentoController;
