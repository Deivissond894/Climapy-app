const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { auth } = require('./firebase-config');
const { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  validateSchema 
} = require('./validation');

const app = express();
const PORT = process.env.PORT || 10000; // Render usa porta 10000 por padrão
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://climapp-1hxc.onrender.com';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://climapp-1hxc.onrender.com',
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
      connectSrc: ["'self'", "https://climapp-1hxc.onrender.com"]
    }
  }
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela de tempo
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 15 minutos.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de auth por IP por janela de tempo
  message: {
    success: false,
    message: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.'
  }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
      signup: `${BASE_URL}/auth/signup`,
      login: `${BASE_URL}/auth/login`,
      forgotPassword: `${BASE_URL}/auth/forgot-password`,
      profile: `${BASE_URL}/auth/profile`,
      health: `${BASE_URL}/health`
    }
  });
});

// Rota de Signup
app.post('/auth/signup', authLimiter, validateSchema(signupSchema), async (req, res) => {
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
app.post('/auth/login', authLimiter, validateSchema(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // No Firebase Admin SDK não temos como fazer login direto com email/senha
    // O cliente precisa usar o Firebase Client SDK para isso
    // Aqui verificamos se o usuário existe e retornamos informações
    const userRecord = await auth.getUserByEmail(email);

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Gerar token personalizado para o usuário
    const customToken = await auth.createCustomToken(userRecord.uid);

    res.json({
      success: true,
      message: 'Usuário encontrado',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customToken: customToken,
        emailVerified: userRecord.emailVerified,
        note: 'Use este customToken no cliente para fazer signInWithCustomToken'
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    
    let message = 'Erro ao fazer login';
    let statusCode = 500;

    if (error.code === 'auth/user-not-found') {
      message = 'Usuário não encontrado';
      statusCode = 404;
    } else if (error.code === 'auth/invalid-email') {
      message = 'Email inválido';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error: error.code
    });
  }
});

// Rota de Forgot Password
app.post('/auth/forgot-password', authLimiter, validateSchema(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;

    // Verificar se o usuário existe
    const userRecord = await auth.getUserByEmail(email);

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
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
      message = 'Usuário não cadastrado/Email não incorreto';
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
  console.log(`   GET ${BASE_URL}/health - Verificar saúde da API`);
  console.log(`🔒 CORS configurado para: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});