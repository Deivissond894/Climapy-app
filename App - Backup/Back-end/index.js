const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const atendimentoRoutes = require('./routes/atendimento');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://back-end-restless-darkness-2411.fly.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://back-end-restless-darkness-2411.fly.dev"]
    }
  }
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Climapp Backend está funcionando!',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: { signup: 'POST /auth/signup', login: 'POST /auth/login', forgotPassword: 'POST /auth/forgot-password', profile: 'GET /auth/profile' },
      clients: { create: 'POST /clientes', list: 'GET /clientes/:uid', update: 'PUT /clientes/:uid/:clientId', delete: 'DELETE /clientes/:uid/:clientId' },
      atendimentos: { create: 'POST /atendimentos/:uid', list: 'GET /atendimentos/:uid', get: 'GET /atendimentos/:uid/:atendimentoId', update: 'PUT /atendimentos/:uid/:atendimentoId', updateOrcamento: 'PUT /atendimentos/:atendimentoId/orcamento', delete: 'DELETE /atendimentos/:uid/:atendimentoId' },
      ai: { processAudio: 'POST /ai/process-audio', status: 'GET /ai/status' },
      upload: { uploadOrcamento: 'POST /upload/orcamento', deleteOrcamento: 'DELETE /upload/orcamento/:publicId', status: 'GET /upload/status' }
    }
  });
});

app.use('/auth', authRoutes);
app.use('/clientes', clientRoutes);
app.use('/atendimentos', atendimentoRoutes);
app.use('/ai', aiRoutes);
app.use('/upload', uploadRoutes);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    requestedUrl: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

module.exports = app;
