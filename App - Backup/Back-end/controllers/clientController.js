const { admin } = require('../config/firebase');

const sanitizeClientData = (data) => {
  return {
    nome: data.nome || "",
    documento: data.documento || "",
    telefone: data.telefone || "",
    email: data.email || "",
    cep: data.cep || "",
    rua: data.rua || "",
    numero: data.numero || "",
    referencia: data.referencia || "",
    observacoes: data.observacoes || ""
  };
};

const clientController = {
  createClient: async (req, res) => {
    try {
      const { uid, ...clientData } = req.body;
      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
      }

      const sanitizedData = sanitizeClientData(clientData);
      const clientsRef = admin.firestore().collection('Usuarios').doc(uid).collection('Clientes');
      const snapshot = await clientsRef.get();
      const nextNumber = snapshot.size + 1;
      const clientCode = `Cli-${String(nextNumber).padStart(3, '0')}`;

      await clientsRef.doc(clientCode).set({
        codigo: clientCode,
        ...sanitizedData,
        criadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(201).json({ success: true, message: 'Cliente cadastrado com sucesso!', codigo: clientCode });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao cadastrar cliente.', error: error.message });
    }
  },

  listClients: async (req, res) => {
    try {
      const uid = req.params.uid;
      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID não informado.' });
      }

      const clientsRef = admin.firestore().collection('Usuarios').doc(uid).collection('Clientes');

      let snapshot;
      try {
        snapshot = await clientsRef.orderBy('criadoEm', 'asc').get();
      } catch (err) {
        snapshot = await clientsRef.get();
      }

      const clients = [];
      snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));

      return res.status(200).json({ success: true, count: clients.length, data: clients });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erro ao buscar clientes.', error: error.message });
    }
  },

  deleteClient: async (req, res) => {
    try {
      const { uid, clientId } = req.params;
      
      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
      }
      
      if (!clientId) {
        return res.status(400).json({ success: false, message: 'Código do cliente não informado.' });
      }

      const clientRef = admin.firestore()
        .collection('Usuarios')
        .doc(uid)
        .collection('Clientes')
        .doc(clientId);

      const clientDoc = await clientRef.get();
      
      if (!clientDoc.exists) {
        return res.status(404).json({
          success: false,
          message: `Cliente com código '${clientId}' não encontrado para este usuário.`
        });
      }

      const clientData = clientDoc.data();
      await clientRef.delete();

      console.log(`🗑️ Cliente excluído:`, {
        uid: uid,
        clientId: clientId,
        clientName: clientData.nome || 'Nome não informado',
        deletedAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: `Cliente '${clientId}' excluído com sucesso.`,
        data: {
          clientId: clientId,
          clientName: clientData.nome || 'Nome não informado',
          deletedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Erro ao excluir cliente:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao excluir cliente.',
        error: error.message
      });
    }
  },

  updateClient: async (req, res) => {
    try {
      const { uid, clientId } = req.params;
      const updateData = req.body;
      
      if (!uid) {
        return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
      }
      
      if (!clientId) {
        return res.status(400).json({ success: false, message: 'Código do cliente não informado.' });
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum dado fornecido para atualização.'
        });
      }

      const clientRef = admin.firestore()
        .collection('Usuarios')
        .doc(uid)
        .collection('Clientes')
        .doc(clientId);

      const clientDoc = await clientRef.get();
      
      if (!clientDoc.exists) {
        return res.status(404).json({
          success: false,
          message: `Cliente com código '${clientId}' não encontrado para este usuário.`
        });
      }

      const currentData = clientDoc.data();
      const sanitizedUpdateData = sanitizeClientData(updateData);
      
      const finalUpdateData = {
        ...sanitizedUpdateData,
        codigo: clientId,
        criadoEm: currentData.criadoEm,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      };

      await clientRef.update(finalUpdateData);
      const updatedDoc = await clientRef.get();
      const updatedData = updatedDoc.data();

      console.log(`📝 Cliente atualizado:`, {
        uid: uid,
        clientId: clientId,
        clientName: updatedData.nome || 'Nome não informado',
        updatedFields: Object.keys(sanitizedUpdateData),
        updatedAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: `Cliente '${clientId}' atualizado com sucesso.`,
        data: {
          clientId: clientId,
          ...updatedData,
          fieldsUpdated: Object.keys(sanitizedUpdateData)
        }
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao atualizar cliente.',
        error: error.message
      });
    }
  }
};

module.exports = clientController;
