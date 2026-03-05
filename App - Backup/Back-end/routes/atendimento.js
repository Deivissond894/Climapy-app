const express = require('express');
const router = express.Router();
const atendimentoController = require('../controllers/atendimentoController');
const { verifyToken } = require('../middleware/auth');

// Listar estágios válidos (deve vir antes de outras rotas)
router.get('/estagios/lista', atendimentoController.listEstagios);

// Criar atendimento
router.post('/', verifyToken, atendimentoController.createAtendimento);

// Listar atendimentos do usuário (via query param)
router.get('/', verifyToken, atendimentoController.listAtendimentos);

// Obter atendimento específico
router.get('/:atendimentoId', verifyToken, atendimentoController.getAtendimento);

// Atualizar atendimento
router.put('/:atendimentoId', verifyToken, atendimentoController.updateAtendimento);

// Atualizar orçamento do atendimento
router.put('/:atendimentoId/orcamento', verifyToken, atendimentoController.updateOrcamento);

// Deletar atendimento
router.delete('/:atendimentoId', verifyToken, atendimentoController.deleteAtendimento);

module.exports = router;
