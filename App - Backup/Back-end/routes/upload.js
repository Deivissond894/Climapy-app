const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const multer = require('multer');

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// Upload de orçamento - SEM autenticação obrigatória
router.post('/orcamento', upload.single('image'), uploadController.uploadOrcamento);

// Upload múltiplo de orçamentos - SEM autenticação obrigatória
router.post('/orcamento/multiple', upload.array('images', 10), uploadController.uploadMultiple);

// Deletar orçamento - SEM autenticação obrigatória
router.delete('/orcamento/:publicId(*)', uploadController.deleteOrcamento);

// Status da API de upload
router.get('/status', uploadController.getStatus);

module.exports = router;
