const express = require('express');
const router = express.Router();
const { admin } = require('./firebase-config');

// Estágios válidos para o status do atendimento
const ESTAGIOS_VALIDOS = [
	'Diagnóstico',
	'Aguardando',
	'Aprovado',
	'Recusado',
	'Executado',
	'Garantia'
];

/**
 * Endpoint para atualizar orçamento do atendimento
 * PUT /atendimentos/:atendimentoId/orcamento
 */
router.put('/:atendimentoId/orcamento', async (req, res) => {
	try {
		const { atendimentoId } = req.params;
		const { 
			userId, 
			clienteNome, 
			produto,
			materiais,
			servicos,
			imagens,
			garantia,
			visitaRecebida,
			valorVisita,
			valorTotal,
			timestamp
		} = req.body;

		// Validação básica
		if (!userId) {
			return res.status(400).json({
				success: false,
				message: 'userId é obrigatório',
				error: 'MISSING_USER_ID'
			});
		}

		if (!atendimentoId) {
			return res.status(400).json({
				success: false,
				message: 'atendimentoId é obrigatório',
				error: 'MISSING_ATENDIMENTO_ID'
			});
		}

		console.log(`💼 Salvando orçamento do atendimento ${atendimentoId}...`);
		console.log(`👤 userId: ${userId}`);

		const db = admin.firestore();
		
		// Caminho correto: Usuarios/{userId}/Atendimentos/{atendimentoId}
		const atendimentoRef = db.collection('Usuarios').doc(userId).collection('Atendimentos').doc(atendimentoId);

		// Verificar se o atendimento existe
		const atendimentoDoc = await atendimentoRef.get();
		
		if (!atendimentoDoc.exists) {
			console.log(`❌ Atendimento ${atendimentoId} não encontrado em Usuarios/${userId}/Atendimentos/`);
			return res.status(404).json({
				success: false,
				message: 'Atendimento não encontrado',
				error: 'ATENDIMENTO_NOT_FOUND'
			});
		}

		console.log(`✅ Atendimento encontrado, preparando dados do orçamento...`);

		// Preparar dados do orçamento para atualização
		const orcamentoData = {
			materiais: materiais || [],
			servicos: servicos || [],
			imagens: imagens || [],
			garantia: garantia || {
				temGarantia: false,
				tipo: '',
				tempo: ''
			},
			visitaRecebida: visitaRecebida !== undefined ? visitaRecebida : false,
			valorVisita: valorVisita || '0,00',
			valorTotal: valorTotal || 'R$ 0,00',
			timestamp: timestamp || new Date().toISOString(),
			salvoEm: new Date().toISOString(),
			preenchido: true
		};

		// Atualizar APENAS o campo orcamento dentro do documento
		await atendimentoRef.update({
			'orcamento': orcamentoData,
			'Status': 'Aguardando',
			'atualizadoEm': new Date().toISOString()
		});

		console.log('✅ Orçamento atualizado com sucesso no documento do atendimento');

		return res.status(200).json({
			success: true,
			message: 'Orçamento atualizado com sucesso',
			data: {
				atendimentoId,
				orcamento: orcamentoData
			}
		});

	} catch (error) {
		console.error('❌ Erro ao atualizar orçamento:', {
			message: error.message,
			stack: error.stack
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao atualizar orçamento',
			error: error.message
		});
	}
});

// Estágios válidos para o status do atendimento
const ESTAGIOS_VALIDOS_OLD = [
	'Diagnóstico',
	'Aguardando',
	'Aprovado',
	'Recusado',
	'Executado',
	'Garantia'
];

// Função para validar e normalizar o status
function normalizarStatus(status) {
	// Se status for null, undefined ou vazio, retorna "Diagnóstico"
	if (!status || status.trim() === '') {
		return 'Diagnóstico';
	}
	
	// Verifica se o status está na lista de estágios válidos
	if (ESTAGIOS_VALIDOS_OLD.includes(status)) {
		return status;
	}
	
	// Se não for válido, retorna "Diagnóstico" como padrão
	console.warn(`⚠️ Status inválido recebido: "${status}". Usando "Diagnóstico" como padrão.`);
	return 'Diagnóstico';
}

// Função utilitária para garantir campos obrigatórios
function sanitizeAtendimentoData(data) {
	return {
		Produto: data.Produto || "",
		clienteCodigo: data.clienteCodigo || "",
		clienteNome: data.clienteNome || "",
		data: data.data || "",
		descricaoDefeito: data.descricaoDefeito || "",
		foto: data.foto || null,
		hora: data.hora || "",
		modelo: data.modelo || "",
		valorVisita: data.valorVisita || "",
		Status: normalizarStatus(data.Status), // Normaliza o status
		// Campos do orçamento inicializados como null
		orcamento: {
			materiais: null,
			servicos: null,
			imagens: null,
			garantia: null,
			visitaRecebida: null,
			valorVisita: null,
			valorTotal: null,
			timestamp: null,
			preenchido: false
		}
	};
}

// Endpoint para criar novo atendimento
// POST /atendimentos
router.post('/', async (req, res) => {
	try {
		const { uid, ...atendimentoData } = req.body;
		
		if (!uid) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID do usuário não informado.' 
			});
		}

		// Sanitiza os dados recebidos
		const sanitizedData = sanitizeAtendimentoData(atendimentoData);

		// Referência para coleção de atendimentos do usuário
		const atendimentosRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Atendimentos');
		
		// Busca todos os atendimentos para encontrar o maior código existente
		const snapshot = await atendimentosRef.get();
		
		let maxNumber = 0;
		snapshot.forEach(doc => {
			const codigo = doc.data().codigo || doc.id;
			// Extrai o número do código (Atend-002 -> 2)
			const match = codigo.match(/Atend-(\d+)/);
			if (match) {
				const num = parseInt(match[1], 10);
				if (num > maxNumber) {
					maxNumber = num;
				}
			}
		});
		
		// Incrementa o maior número encontrado
		const nextNumber = maxNumber + 1;
		const atendimentoCode = `Atend-${String(nextNumber).padStart(2, '0')}`;

		// Salva o atendimento
		await atendimentosRef.doc(atendimentoCode).set({
			codigo: atendimentoCode,
			...sanitizedData,
			criadoEm: admin.firestore.FieldValue.serverTimestamp()
		});

		// Log para auditoria
		console.log(`✅ Atendimento criado:`, {
			uid: uid,
			codigo: atendimentoCode,
			cliente: sanitizedData.clienteNome,
			produto: sanitizedData.Produto,
			status: sanitizedData.Status,
			criadoEm: new Date().toISOString()
		});

		return res.status(201).json({ 
			success: true, 
			message: 'Atendimento iniciado com sucesso!', 
			codigo: atendimentoCode,
			data: {
				codigo: atendimentoCode,
				...sanitizedData
			}
		});

	} catch (error) {
		console.error('❌ Erro ao criar atendimento:', {
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({ 
			success: false, 
			message: 'Erro ao iniciar atendimento.', 
			error: error.message 
		});
	}
});

// Endpoint para listar os estágios válidos de status
// GET /atendimentos/estagios
router.get('/estagios/lista', async (req, res) => {
	try {
		return res.status(200).json({
			success: true,
			message: 'Lista de estágios válidos para atendimento',
			data: {
				estagios: ESTAGIOS_VALIDOS,
				padrao: 'Diagnóstico',
				descricao: {
					'Diagnóstico': 'Atendimento em fase de diagnóstico inicial',
					'Aguardando': 'Aguardando aprovação ou peças',
					'Aprovado': 'Serviço aprovado pelo cliente',
					'Recusado': 'Serviço recusado pelo cliente',
					'Executado': 'Serviço executado e finalizado',
					'Garantia': 'Atendimento em garantia'
				}
			}
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: 'Erro ao buscar estágios',
			error: error.message
		});
	}
});

// Endpoint para listar atendimentos do usuário
// GET /atendimentos/:uid
router.get('/:uid', async (req, res) => {
	try {
		const uid = req.params.uid;
		
		if (!uid) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID não informado.' 
			});
		}

		const atendimentosRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Atendimentos');

		// Tenta ordenar por criadoEm, mas faz fallback caso campo não exista
		let snapshot;
		try {
			snapshot = await atendimentosRef.orderBy('criadoEm', 'desc').get();
		} catch (err) {
			snapshot = await atendimentosRef.get();
		}

		const atendimentos = [];
		
		// Para cada atendimento, buscar dados do cliente (rua e numero)
		for (const doc of snapshot.docs) {
			const atendimentoData = { id: doc.id, ...doc.data() };
			
			// Se existe clienteCodigo, buscar dados do cliente
			if (atendimentoData.clienteCodigo) {
				try {
					const clienteRef = admin.firestore()
						.collection('Usuarios')
						.doc(uid)
						.collection('Clientes')
						.doc(atendimentoData.clienteCodigo);
					
					const clienteDoc = await clienteRef.get();
					
					if (clienteDoc.exists) {
						const clienteData = clienteDoc.data();
						// Adicionar apenas rua e numero
						atendimentoData.rua = clienteData.rua || "";
						atendimentoData.numero = clienteData.numero || "";
					}
				} catch (clientError) {
					console.warn(`⚠️ Erro ao buscar cliente ${atendimentoData.clienteCodigo}:`, clientError.message);
					// Se der erro, deixa os campos vazios
					atendimentoData.rua = "";
					atendimentoData.numero = "";
				}
			}
			
			atendimentos.push(atendimentoData);
		}

		return res.status(200).json({ 
			success: true, 
			count: atendimentos.length, 
			data: atendimentos 
		});

	} catch (error) {
		console.error('❌ Erro ao buscar atendimentos:', {
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({ 
			success: false, 
			message: 'Erro ao buscar atendimentos.', 
			error: error.message 
		});
	}
});

// Endpoint para buscar um atendimento específico
// GET /atendimentos/:uid/:atendimentoId
router.get('/:uid/:atendimentoId', async (req, res) => {
	try {
		const { uid, atendimentoId } = req.params;
		
		if (!uid || !atendimentoId) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID ou código do atendimento não informado.' 
			});
		}

		const atendimentoRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Atendimentos')
			.doc(atendimentoId);

		const doc = await atendimentoRef.get();
		
		if (!doc.exists) {
			return res.status(404).json({
				success: false,
				message: `Atendimento '${atendimentoId}' não encontrado.`
			});
		}

		return res.status(200).json({
			success: true,
			data: { id: doc.id, ...doc.data() }
		});

	} catch (error) {
		console.error('❌ Erro ao buscar atendimento:', {
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({ 
			success: false, 
			message: 'Erro ao buscar atendimento.', 
			error: error.message 
		});
	}
});

// Endpoint para atualizar atendimento
// PUT /atendimentos/:uid/:atendimentoId
router.put('/:uid/:atendimentoId', async (req, res) => {
	try {
		const { uid, atendimentoId } = req.params;
		const updateData = req.body;
		
		if (!uid || !atendimentoId) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID ou código do atendimento não informado.' 
			});
		}

		if (!updateData || Object.keys(updateData).length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Nenhum dado fornecido para atualização.'
			});
		}

		const atendimentoRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Atendimentos')
			.doc(atendimentoId);

		const doc = await atendimentoRef.get();
		
		if (!doc.exists) {
			return res.status(404).json({
				success: false,
				message: `Atendimento '${atendimentoId}' não encontrado.`
			});
		}

		const currentData = doc.data();

		// Prepara dados para atualização
		const finalUpdateData = {
			...updateData,
			codigo: atendimentoId, // Manter o código original
			criadoEm: currentData.criadoEm, // Manter data de criação
			atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
		};

		await atendimentoRef.update(finalUpdateData);

		const updatedDoc = await atendimentoRef.get();
		const updatedData = updatedDoc.data();

		console.log(`📝 Atendimento atualizado:`, {
			uid: uid,
			codigo: atendimentoId,
			updatedAt: new Date().toISOString()
		});

		return res.status(200).json({
			success: true,
			message: `Atendimento '${atendimentoId}' atualizado com sucesso.`,
			data: updatedData
		});

	} catch (error) {
		console.error('❌ Erro ao atualizar atendimento:', {
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao atualizar atendimento.',
			error: error.message
		});
	}
});

// Endpoint para excluir atendimento
// DELETE /atendimentos/:uid/:atendimentoId
router.delete('/:uid/:atendimentoId', async (req, res) => {
	try {
		const { uid, atendimentoId } = req.params;
		
		if (!uid || !atendimentoId) {
			return res.status(400).json({ 
				success: false, 
				message: 'UID ou código do atendimento não informado.' 
			});
		}

		const atendimentoRef = admin.firestore()
			.collection('Usuarios')
			.doc(uid)
			.collection('Atendimentos')
			.doc(atendimentoId);

		const doc = await atendimentoRef.get();
		
		if (!doc.exists) {
			return res.status(404).json({
				success: false,
				message: `Atendimento '${atendimentoId}' não encontrado.`
			});
		}

		const atendimentoData = doc.data();

		await atendimentoRef.delete();

		console.log(`🗑️ Atendimento excluído:`, {
			uid: uid,
			codigo: atendimentoId,
			cliente: atendimentoData.clienteNome,
			deletedAt: new Date().toISOString()
		});

		return res.status(200).json({
			success: true,
			message: `Atendimento '${atendimentoId}' excluído com sucesso.`,
			data: {
				codigo: atendimentoId,
				deletedAt: new Date().toISOString()
			}
		});

	} catch (error) {
		console.error('❌ Erro ao excluir atendimento:', {
			error: error.message,
			timestamp: new Date().toISOString()
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao excluir atendimento.',
			error: error.message
		});
	}
});

module.exports = router;
