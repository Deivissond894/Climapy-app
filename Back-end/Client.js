const express = require('express');
const router = express.Router();
const { admin } = require('./firebase-config');

// Função utilitária para garantir campos obrigatórios
function sanitizeClientData(data) {
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
}

// Endpoint para cadastrar cliente
// Montado em index.js via app.use('/clientes', clientRoutes)
// então aqui o caminho deve ser '/' para que o endpoint final seja POST /clientes
router.post('/', async (req, res) => {
	try {
		const { uid, ...clientData } = req.body;
		if (!uid) {
			return res.status(400).json({ success: false, message: 'UID do usuário não informado.' });
		}
		// Sanitiza os dados recebidos
		const sanitizedData = sanitizeClientData(clientData);

	// Referência para coleção de clientes do usuário
	const clientsRef = admin.firestore().collection('Usuarios').doc(uid).collection('Clientes');
	
	// Busca todos os clientes para encontrar o maior código existente
	const snapshot = await clientsRef.get();
	
	let maxNumber = 0;
	snapshot.forEach(doc => {
		const codigo = doc.data().codigo || doc.id;
		// Extrai o número do código (Cli-002 -> 2)
		const match = codigo.match(/Cli-(\d+)/);
		if (match) {
			const num = parseInt(match[1], 10);
			if (num > maxNumber) {
				maxNumber = num;
			}
		}
	});
	
	// Incrementa o maior número encontrado
	const nextNumber = maxNumber + 1;
	const clientCode = `Cli-${String(nextNumber).padStart(3, '0')}`;		// Salva o cliente
		await clientsRef.doc(clientCode).set({
			codigo: clientCode,
			...sanitizedData,
			criadoEm: admin.firestore.FieldValue.serverTimestamp()
		});

		return res.status(201).json({ success: true, message: 'Cliente cadastrado com sucesso!', codigo: clientCode });
	} catch (error) {
		return res.status(500).json({ success: false, message: 'Dados faltando para completar cadastro, Campos obrigatórios sem preenchimento.', error: error.message });
	}
});

// Rota para listar clientes do usuário (GET /clientes/:uid)
// Observação: essa versão exige o UID na URL e não verifica token (modo simples/teste).
router.get('/:uid', async (req, res) => {
	try {
		const uid = req.params.uid;
		if (!uid) {
			return res.status(400).json({ success: false, message: 'UID não informado.' });
		}

		const clientsRef = admin.firestore().collection('Usuarios').doc(uid).collection('Clientes');

		// Tenta ordenar por criadoEm, mas faz fallback caso campo não exista
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
});

// Rota para excluir cliente específico (DELETE /clientes/:uid/:clientId)
// uid = UID do usuário autenticado
// clientId = Código do cliente (ex: Cli-001, Cli-002, etc.)
router.delete('/:uid/:clientId', async (req, res) => {
	try {
		const { uid, clientId } = req.params;
		
		// Validar parâmetros obrigatórios
		if (!uid) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID do usuário não informado.' 
			});
		}
		
		if (!clientId) {
			return res.status(400).json({ 
				success: false, 
				message: 'Código do cliente não informado.' 
			});
		}

		// Referência para o documento específico do cliente
		const clientRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Clientes')
			.doc(clientId);

		// Verificar se o cliente existe antes de tentar excluir
		const clientDoc = await clientRef.get();
		
		if (!clientDoc.exists) {
			return res.status(404).json({
				success: false,
				message: `Cliente com código '${clientId}' não encontrado para este usuário.`
			});
		}

		// Buscar dados do cliente antes da exclusão (para log/auditoria)
		const clientData = clientDoc.data();

		// Excluir o documento
		await clientRef.delete();

		// Log da exclusão para auditoria
		console.log(`🗑️ Cliente excluído:`, {
			uid: uid,
			clientId: clientId,
			clientName: clientData.nome || 'Nome não informado',
			deletedAt: new Date().toISOString(),
			deletedBy: 'API_ENDPOINT'
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
		console.error('❌ Erro ao excluir cliente:', {
			uid: req.params.uid,
			clientId: req.params.clientId,
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Erro interno ao excluir cliente.',
			error: error.message
		});
	}
});

// Rota para editar cliente específico (PUT /clientes/:uid/:clientId)
// uid = UID do usuário autenticado
// clientId = Código do cliente (ex: Cli-001, Cli-002, etc.)
router.put('/:uid/:clientId', async (req, res) => {
	try {
		const { uid, clientId } = req.params;
		const updateData = req.body;
		
		// Validar parâmetros obrigatórios
		if (!uid) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID do usuário não informado.' 
			});
		}
		
		if (!clientId) {
			return res.status(400).json({ 
				success: false, 
				message: 'Código do cliente não informado.' 
			});
		}

		// Validar se há dados para atualizar
		if (!updateData || Object.keys(updateData).length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Nenhum dado fornecido para atualização.'
			});
		}

		// Referência para o documento específico do cliente
		const clientRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Clientes')
			.doc(clientId);

		// Verificar se o cliente existe
		const clientDoc = await clientRef.get();
		
		if (!clientDoc.exists) {
			return res.status(404).json({
				success: false,
				message: `Cliente com código '${clientId}' não encontrado para este usuário.`
			});
		}

		// Buscar dados atuais do cliente
		const currentData = clientDoc.data();

		// Sanitizar e preparar dados para atualização
		const sanitizedUpdateData = sanitizeClientData(updateData);
		
		// Preparar dados finais para atualização (manter código e data de criação)
		const finalUpdateData = {
			...sanitizedUpdateData,
			codigo: clientId, // Manter o código original
			criadoEm: currentData.criadoEm, // Manter data de criação original
			atualizadoEm: admin.firestore.FieldValue.serverTimestamp() // Adicionar timestamp de atualização
		};

		// Atualizar o documento
		await clientRef.update(finalUpdateData);

		// Buscar dados atualizados para retorno
		const updatedDoc = await clientRef.get();
		const updatedData = updatedDoc.data();

		// Log da atualização para auditoria
		console.log(`📝 Cliente atualizado:`, {
			uid: uid,
			clientId: clientId,
			clientName: updatedData.nome || 'Nome não informado',
			updatedFields: Object.keys(sanitizedUpdateData),
			updatedAt: new Date().toISOString(),
			updatedBy: 'API_ENDPOINT'
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
		console.error('❌ Erro ao atualizar cliente:', {
			uid: req.params.uid,
			clientId: req.params.clientId,
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Erro interno ao atualizar cliente.',
			error: error.message
		});
	}
});

module.exports = router;
