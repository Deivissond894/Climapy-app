const axios = require('axios');

const aiController = {
  // Processar áudio para gerar orçamento
  processAudio: async (req, res) => {
    try {
      const { audioData, audioFormat } = req.body;

      if (!audioData) {
        return res.status(400).json({
          success: false,
          message: 'Dados de áudio não fornecidos.'
        });
      }

      // TODO: Implementar processamento de áudio com IA
      // Por enquanto, retorna resposta genérica
      return res.status(200).json({
        success: true,
        message: 'Áudio recebido. Processamento em andamento...',
        transcript: 'Transcrição do áudio processada',
        data: {
          descricao: 'Produto detectado no áudio',
          diagnostico: 'Diagnóstico baseado no áudio'
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar áudio.',
        error: error.message
      });
    }
  },

  // Status da API de IA
  getStatus: async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        status: 'ok',
        message: 'API de IA está operacional',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar status.',
        error: error.message
      });
    }
  }
};

module.exports = aiController;
