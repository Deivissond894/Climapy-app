const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Processar áudio para gerar orçamento - SEM autenticação obrigatória
router.post('/process-audio', aiController.processAudio);

// Status da API de IA
router.get('/status', aiController.getStatus);

module.exports = router;
