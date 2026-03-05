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
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://back-end-restless-darkness-2411.fly.dev';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://back-end-restless-darkness-2411.fly.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

// Middlewares de segurança
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

// Health check endpoint para Fly.io
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rota raiz com documentação dos endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Climapp Backend está funcionando!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: {
        signup: 'POST /auth/signup',
        login: 'POST /auth/login',
        forgotPassword: 'POST /auth/forgot-password',
        profile: 'GET /auth/profile (protegido)'
      },
      clients: {
        create: 'POST /clientes',
        list: 'GET /clientes/:uid',
        update: 'PUT /clientes/:uid/:clientId',
        delete: 'DELETE /clientes/:uid/:clientId'
      },
      atendimentos: {
        create: 'POST /atendimentos',
        list: 'GET /atendimentos/:uid',
        get: 'GET /atendimentos/:uid/:atendimentoId',
        update: 'PUT /atendimentos/:uid/:atendimentoId',
        updateOrcamento: 'PUT /atendimentos/:atendimentoId/orcamento',
        delete: 'DELETE /atendimentos/:uid/:atendimentoId',
        listEstagios: 'GET /atendimentos/estagios/lista'
      },
      ai: {
        processAudio: 'POST /ai/process-audio',
        status: 'GET /ai/status'
      },
      upload: {
        uploadOrcamento: 'POST /upload/orcamento',
        uploadMultiple: 'POST /upload/orcamento/multiple',
        deleteOrcamento: 'DELETE /upload/orcamento/:publicId',
        status: 'GET /upload/status'
      },
      health: 'GET /health'
    }
  });
});

// Rotas da API
app.use('/auth', authRoutes);
app.use('/clientes', clientRoutes);
app.use('/atendimentos', atendimentoRoutes);
app.use('/ai', aiRoutes);
app.use('/upload', uploadRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    requestedUrl: req.originalUrl
  });
});

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Servidor Climapp Backend iniciado!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📍 Porta: ${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`✅ Endpoints disponíveis:\n`);
  console.log(`🔐 Autenticação:`);
  console.log(`   POST   /auth/signup`);
  console.log(`   POST   /auth/login`);
  console.log(`   POST   /auth/forgot-password`);
  console.log(`   GET    /auth/profile\n`);
  console.log(`👥 Clientes:`);
  console.log(`   POST   /clientes`);
  console.log(`   GET    /clientes/:uid`);
  console.log(`   PUT    /clientes/:uid/:clientId`);
  console.log(`   DELETE /clientes/:uid/:clientId\n`);
  console.log(`📋 Atendimentos:`);
  console.log(`   POST   /atendimentos`);
  console.log(`   GET    /atendimentos/:uid`);
  console.log(`   GET    /atendimentos/:uid/:atendimentoId`);
  console.log(`   PUT    /atendimentos/:uid/:atendimentoId`);
  console.log(`   PUT    /atendimentos/:atendimentoId/orcamento`);
  console.log(`   DELETE /atendimentos/:uid/:atendimentoId`);
  console.log(`   GET    /atendimentos/estagios/lista\n`);
  console.log(`🤖 IA:`);
  console.log(`   POST   /ai/process-audio`);
  console.log(`   GET    /ai/status\n`);
  console.log(`📸 Upload:`);
  console.log(`   POST   /upload/orcamento`);
  console.log(`   POST   /upload/orcamento/multiple`);
  console.log(`   DELETE /upload/orcamento/:publicId`);
  console.log(`   GET    /upload/status\n`);
  console.log(`💚 Saúde:`);
  console.log(`   GET    /health`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

module.exports = app;
