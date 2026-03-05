const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
require('dotenv').config();
const { auth } = require('./firebase-config');
const { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  validateSchema 
} = require('./validation');
const clientRoutes = require('./Client');
const aiRoutes = require('./AI');
const atendimentoRoutes = require('./Atendimento');
const uploadRoutes = require('./Upload');

const app = express();
const PORT = process.env.PORT || 10000; // Fly.io usa porta 10000 por padrão
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://back-end-falling-shadow-6301.fly.dev';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://back-end-falling-shadow-6301.fly.dev',
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
      connectSrc: ["'self'", "https://back-end-falling-shadow-6301.fly.dev"]
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
app.use('/clientes', clientRoutes);
app.use('/ai', aiRoutes);
app.use('/atendimentos', atendimentoRoutes);
app.use('/upload', uploadRoutes);

// Health check endpoint para Fly.io
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Climapp Backend está funcionando!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: {
        signup: `${BASE_URL}/auth/signup`,
        login: `${BASE_URL}/auth/login`,
        forgotPassword: `${BASE_URL}/auth/forgot-password`,
        profile: `${BASE_URL}/auth/profile`
      },
      clients: {
        create: `${BASE_URL}/clientes`,
        list: `${BASE_URL}/clientes/:uid`,
        update: `${BASE_URL}/clientes/:uid/:clientId`,
        delete: `${BASE_URL}/clientes/:uid/:clientId`
      },
      atendimentos: {
        create: `${BASE_URL}/atendimentos`,
        list: `${BASE_URL}/atendimentos/:uid`,
        get: `${BASE_URL}/atendimentos/:uid/:atendimentoId`,
        update: `${BASE_URL}/atendimentos/:uid/:atendimentoId`,
        delete: `${BASE_URL}/atendimentos/:uid/:atendimentoId`
      },
      ai: {
        processAudio: `${BASE_URL}/ai/process-audio`,
        status: `${BASE_URL}/ai/status`
      },
      health: `${BASE_URL}/health`
    }
  });
});

// Rota de Signup
app.post('/auth/signup', validateSchema(signupSchema), async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Criar usuário no Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName || null,
      emailVerified: false
    });

    // Gerar token personalizado
    const customToken = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customToken: customToken,
        emailVerified: userRecord.emailVerified
      }
    });

  } catch (error) {
    console.error('Erro no signup:', error);
    
    let message = 'Erro ao criar usuário';
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists') {
      message = 'Este email já está em uso';
      statusCode = 409;
    } else if (error.code === 'auth/invalid-email') {
      message = 'Email inválido';
      statusCode = 400;
    } else if (error.code === 'auth/weak-password') {
      message = 'Senha muito fraca. Use pelo menos 6 caracteres';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error: error.code
    });
  }
});

// Rota de Login
app.post('/auth/login', validateSchema(loginSchema), async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Verificar credenciais usando Firebase Auth REST API
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    
    if (!FIREBASE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Configuração do Firebase incompleta. Configure FIREBASE_WEB_API_KEY no .env'
      });
    }

    // Fazer requisição para Firebase Auth REST API
    const firebaseResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email: email,
        password: password,
        returnSecureToken: true
      }
    );

    // Se chegou até aqui, as credenciais estão corretas
    const firebaseUser = firebaseResponse.data;
    
    // Buscar dados completos do usuário no Firebase Admin
    const userRecord = await auth.getUser(firebaseUser.localId);

    // Definir claims personalizados baseado na opção "lembrar de mim"
    const customClaims = {
      rememberMe: rememberMe,
      sessionType: rememberMe ? 'persistent' : 'temporary',
      loginTime: Date.now(),
      suggestedExpiry: rememberMe 
        ? Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 dias
        : Date.now() + (24 * 60 * 60 * 1000) // 1 dia
    };

    // Gerar token personalizado com claims customizados
    const customToken = await auth.createCustomToken(userRecord.uid, customClaims);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customToken: customToken,
        emailVerified: userRecord.emailVerified,
        rememberMe: rememberMe,
        sessionType: customClaims.sessionType,
        suggestedExpiry: new Date(customClaims.suggestedExpiry).toISOString(),
        note: rememberMe 
          ? 'Token configurado para sessão persistente (30 dias)' 
          : 'Token configurado para sessão temporária (1 dia)'
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    
    let message = 'Erro ao fazer login';
    let statusCode = 500;

    // Tratar erros específicos da API do Firebase
    if (error.response?.data?.error) {
      const firebaseError = error.response.data.error;
      
      switch (firebaseError.message) {
        case 'INVALID_PASSWORD':
        case 'EMAIL_NOT_FOUND':
          message = 'Email e/ou senha incorretos';
          statusCode = 401;
          break;
        case 'INVALID_EMAIL':
          message = 'Email inválido';
          statusCode = 400;
          break;
        case 'USER_DISABLED':
          message = 'Usuário desabilitado';
          statusCode = 403;
          break;
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
          message = 'Muitas tentativas. Tente novamente mais tarde';
          statusCode = 429;
          break;
        default:
          message = 'Email e/ou senha incorretos';
          statusCode = 400;
      }
    } else if (error.code === 'auth/user-not-found') {
      message = 'Email e/ou senha incorretos';
      statusCode = 401;
    } else if (error.code === 'auth/invalid-email') {
      message = 'Email inválido';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error: error.response?.data?.error?.message || error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Rota de Forgot Password
app.post('/auth/forgot-password', validateSchema(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;

    // Verificar se o usuário existe
    const userRecord = await auth.getUserByEmail(email);

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'Email inválido ou não cadastrado'
      });
    }

    // Gerar link de redefinição de senha (sem URL customizada para evitar erro de autorização)
    const resetLink = await auth.generatePasswordResetLink(email);

    res.json({
      success: true,
      message: 'Link de redefinição de senha gerado com sucesso',
      data: {
        email: email,
        resetLink: resetLink,
        note: 'Em produção, este link seria enviado por email'
      }
    });

  } catch (error) {
    console.error('Erro no forgot password:', error);
    
    let message = 'Erro ao gerar link de redefinição';
    let statusCode = 500;

    if (error.code === 'auth/user-not-found') {
      message = 'Email inválido ou não cadastrado';
      statusCode = 404;
    } else if (error.code === 'auth/invalid-email') {
      message = 'Email inválido';
      statusCode = 400;
    } else if (error.code === 'auth/unauthorized-continue-uri') {
      message = 'URL de continuação não autorizada no Firebase';
      statusCode = 400;
    } else if (error.code === 'auth/invalid-continue-uri') {
      message = 'URL de continuação inválida';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error: error.code
    });
  }
});

// Middleware de verificação de token (para rotas protegidas)
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: error.code
    });
  }
};

// Rota protegida de exemplo
app.get('/auth/profile', verifyToken, async (req, res) => {
  try {
    const userRecord = await auth.getUser(req.user.uid);
    
    res.json({
      success: true,
      message: 'Perfil do usuário',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime
      }
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil do usuário'
    });
  }
});

// Rota para verificar saúde da API
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API está saudável',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Middleware de tratamento de erros
app.use(errorHandler);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    requestedUrl: req.originalUrl
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Climapp Backend rodando na porta ${PORT}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📱 Acesse: ${BASE_URL}`);
  console.log(`🔐 Endpoints de autenticação disponíveis:`);
  console.log(`   POST ${BASE_URL}/auth/signup - Criar usuário`);
  console.log(`   POST ${BASE_URL}/auth/login - Fazer login`);
  console.log(`   POST ${BASE_URL}/auth/forgot-password - Redefinir senha`);
  console.log(`   GET ${BASE_URL}/auth/profile - Ver perfil (protegido)`);
  console.log(`👥 Endpoints de clientes disponíveis:`);
  console.log(`   POST ${BASE_URL}/clientes - Criar cliente`);
  console.log(`   GET ${BASE_URL}/clientes/:uid - Listar clientes`);
  console.log(`   PUT ${BASE_URL}/clientes/:uid/:clientId - Atualizar cliente`);
  console.log(`   DELETE ${BASE_URL}/clientes/:uid/:clientId - Excluir cliente`);
  console.log(`📋 Endpoints de atendimentos disponíveis:`);
  console.log(`   POST ${BASE_URL}/atendimentos - Criar atendimento`);
  console.log(`   GET ${BASE_URL}/atendimentos/:uid - Listar atendimentos`);
  console.log(`   GET ${BASE_URL}/atendimentos/:uid/:atendimentoId - Buscar atendimento`);
  console.log(`   PUT ${BASE_URL}/atendimentos/:uid/:atendimentoId - Atualizar atendimento`);
  console.log(`   DELETE ${BASE_URL}/atendimentos/:uid/:atendimentoId - Excluir atendimento`);
  console.log(`🤖 Endpoints de IA disponíveis:`);
  console.log(`   POST ${BASE_URL}/ai/process-audio - Processar áudio com IA`);
  console.log(`   GET ${BASE_URL}/ai/status - Status do serviço de IA`);
  console.log(`   GET ${BASE_URL}/health - Verificar saúde da API`);
  console.log(`🔒 CORS configurado para: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});