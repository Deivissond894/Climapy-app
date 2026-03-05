const { auth, admin } = require('../config/firebase');
const axios = require('axios');

const authController = {
  signup: async (req, res, next) => {
    try {
      const { email, password, displayName } = req.validatedBody;

      const userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName || null,
        emailVerified: false
      });

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
  },

  login: async (req, res, next) => {
    try {
      const { email, password, rememberMe = false } = req.validatedBody;

      const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
      
      if (!FIREBASE_API_KEY) {
        return res.status(500).json({
          success: false,
          message: 'Configuração do Firebase incompleta. Configure FIREBASE_WEB_API_KEY no .env'
        });
      }

      const firebaseResponse = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          email: email,
          password: password,
          returnSecureToken: true
        }
      );

      const firebaseUser = firebaseResponse.data;
      const userRecord = await auth.getUser(firebaseUser.localId);

      const customToken = await auth.createCustomToken(userRecord.uid);

      console.log('✅ [LOGIN] Login bem-sucedido');
      console.log('📦 [LOGIN] Firebase Response:', {
        uid: firebaseUser.localId,
        idToken: firebaseUser.idToken ? `${firebaseUser.idToken.substring(0, 50)}...` : 'AUSENTE',
        email: firebaseUser.email
      });

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          idToken: firebaseUser.idToken,
          emailVerified: userRecord.emailVerified,
          rememberMe: rememberMe,
          sessionType: rememberMe ? 'persistent' : 'temporary',
          suggestedExpiry: rememberMe 
            ? new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
            : new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString()
        }
      });

    } catch (error) {
      console.error('Erro no login:', error);
      
      let message = 'Erro ao fazer login';
      let statusCode = 500;

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
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.response?.data?.error?.message || error.code || 'UNKNOWN_ERROR'
      });
    }
  },

  forgotPassword: async (req, res, next) => {
    try {
      const { email } = req.validatedBody;

      const userRecord = await auth.getUserByEmail(email);

      if (!userRecord) {
        return res.status(404).json({
          success: false,
          message: 'Email inválido ou não cadastrado'
        });
      }

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
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.code
      });
    }
  },

  getProfile: async (req, res, next) => {
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
  }
};

module.exports = authController;
