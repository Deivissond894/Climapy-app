const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configurar Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurar multer para armazenar em memória
const storage = multer.memoryStorage();
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 10 * 1024 * 1024 // Limite de 10MB
	},
	fileFilter: (req, file, cb) => {
		// Aceitar apenas imagens
		if (file.mimetype.startsWith('image/')) {
			cb(null, true);
		} else {
			cb(new Error('Apenas arquivos de imagem são permitidos'), false);
		}
	}
});

/**
 * Endpoint para upload de imagens do orçamento
 * POST /upload/orcamento
 * 
 * FormData esperado:
 * - image: arquivo da imagem
 * - atendimentoId: ID do atendimento
 * - userId: ID do usuário
 */
router.post('/orcamento', upload.single('image'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: 'Nenhuma imagem foi enviada',
				error: 'MISSING_IMAGE'
			});
		}

		const { atendimentoId, userId } = req.body;

		if (!atendimentoId || !userId) {
			return res.status(400).json({
				success: false,
				message: 'atendimentoId e userId são obrigatórios',
				error: 'MISSING_REQUIRED_FIELDS'
			});
		}

		console.log(`📸 Iniciando upload da imagem do atendimento ${atendimentoId}...`);

		// Criar nome único para a imagem
		const timestamp = Date.now();
		const publicId = `climapp/atendimentos/${userId}/${atendimentoId}/${timestamp}`;

		// Upload para Cloudinary usando stream
		const uploadPromise = new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder: `climapp/atendimentos/${userId}/${atendimentoId}`,
					public_id: `${timestamp}`,
					resource_type: 'image',
					transformation: [
						{ width: 1200, height: 1200, crop: 'limit' }, // Redimensionar se maior que 1200x1200
						{ quality: 'auto:good' }, // Otimizar qualidade automaticamente
						{ fetch_format: 'auto' } // Formato automático (WebP quando suportado)
					]
				},
				(error, result) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				}
			);

			// Enviar buffer para o stream
			uploadStream.end(req.file.buffer);
		});

		const result = await uploadPromise;

		console.log('✅ Upload concluído com sucesso');

		return res.status(200).json({
			success: true,
			message: 'Imagem enviada com sucesso',
			data: {
				url: result.secure_url,
				publicId: result.public_id,
				width: result.width,
				height: result.height,
				format: result.format,
				bytes: result.bytes
			}
		});

	} catch (error) {
		console.error('❌ Erro ao fazer upload da imagem:', {
			message: error.message,
			stack: error.stack
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao fazer upload da imagem',
			error: error.message
		});
	}
});

/**
 * Endpoint para upload de múltiplas imagens
 * POST /upload/orcamento/multiple
 * 
 * FormData esperado:
 * - images: array de arquivos de imagem
 * - atendimentoId: ID do atendimento
 * - userId: ID do usuário
 */
router.post('/orcamento/multiple', upload.array('images', 10), async (req, res) => {
	try {
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Nenhuma imagem foi enviada',
				error: 'MISSING_IMAGES'
			});
		}

		const { atendimentoId, userId } = req.body;

		if (!atendimentoId || !userId) {
			return res.status(400).json({
				success: false,
				message: 'atendimentoId e userId são obrigatórios',
				error: 'MISSING_REQUIRED_FIELDS'
			});
		}

		console.log(`📸 Iniciando upload de ${req.files.length} imagens do atendimento ${atendimentoId}...`);

		// Upload de todas as imagens em paralelo
		const uploadPromises = req.files.map((file, index) => {
			return new Promise((resolve, reject) => {
				const timestamp = Date.now() + index;
				const uploadStream = cloudinary.uploader.upload_stream(
					{
						folder: `climapp/atendimentos/${userId}/${atendimentoId}`,
						public_id: `${timestamp}`,
						resource_type: 'image',
						transformation: [
							{ width: 1200, height: 1200, crop: 'limit' },
							{ quality: 'auto:good' },
							{ fetch_format: 'auto' }
						]
					},
					(error, result) => {
						if (error) {
							reject(error);
						} else {
							resolve({
								url: result.secure_url,
								publicId: result.public_id,
								width: result.width,
								height: result.height,
								format: result.format,
								bytes: result.bytes
							});
						}
					}
				);

				uploadStream.end(file.buffer);
			});
		});

		const results = await Promise.all(uploadPromises);

		console.log(`✅ Upload de ${results.length} imagens concluído com sucesso`);

		return res.status(200).json({
			success: true,
			message: `${results.length} imagens enviadas com sucesso`,
			data: {
				images: results,
				count: results.length
			}
		});

	} catch (error) {
		console.error('❌ Erro ao fazer upload das imagens:', {
			message: error.message,
			stack: error.stack
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao fazer upload das imagens',
			error: error.message
		});
	}
});

/**
 * Endpoint para deletar imagem do Cloudinary
 * DELETE /upload/orcamento/:publicId
 */
router.delete('/orcamento/:publicId(*)', async (req, res) => {
	try {
		const publicId = req.params.publicId;

		if (!publicId) {
			return res.status(400).json({
				success: false,
				message: 'publicId é obrigatório',
				error: 'MISSING_PUBLIC_ID'
			});
		}

		console.log(`🗑️ Deletando imagem: ${publicId}`);

		const result = await cloudinary.uploader.destroy(publicId);

		if (result.result === 'ok') {
			console.log('✅ Imagem deletada com sucesso');
			return res.status(200).json({
				success: true,
				message: 'Imagem deletada com sucesso'
			});
		} else {
			return res.status(404).json({
				success: false,
				message: 'Imagem não encontrada',
				error: 'IMAGE_NOT_FOUND'
			});
		}

	} catch (error) {
		console.error('❌ Erro ao deletar imagem:', {
			message: error.message,
			stack: error.stack
		});

		return res.status(500).json({
			success: false,
			message: 'Erro ao deletar imagem',
			error: error.message
		});
	}
});

/**
 * Endpoint para verificar configuração do Cloudinary
 * GET /upload/status
 */
router.get('/status', (req, res) => {
	const isConfigured = !!(
		process.env.CLOUDINARY_CLOUD_NAME &&
		process.env.CLOUDINARY_API_KEY &&
		process.env.CLOUDINARY_API_SECRET
	);

	res.json({
		success: true,
		message: 'Status do serviço de upload',
		data: {
			cloudinary_configured: isConfigured,
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'not_set',
			max_file_size: '10MB',
			supported_formats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
			endpoints: {
				single: 'POST /upload/orcamento',
				multiple: 'POST /upload/orcamento/multiple',
				delete: 'DELETE /upload/orcamento/:publicId'
			},
			status: isConfigured ? 'ready' : 'not_configured'
		}
	});
});

module.exports = router;
