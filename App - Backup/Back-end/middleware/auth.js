const { auth } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 [AUTH] Authorization Header:', authHeader ? 'PRESENTE' : 'AUSENTE');
    
    const token = authHeader?.split(' ')[1];
    console.log('🔍 [AUTH] Token completo:', token || 'NENHUM');
    
    if (!token) {
      console.log('❌ [AUTH] Token não fornecido');
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    console.log('⏳ [AUTH] Verificando token com Firebase...');
    const decodedToken = await auth.verifyIdToken(token);
    console.log('✅ [AUTH] Token válido! UID:', decodedToken.uid);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ [AUTH] Erro na verificação do token:', error.message);
    console.error('🔍 [AUTH] Código do erro:', error.code);
    console.error('🔍 [AUTH] Stack completo:', error.stack);
    res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: error.code
    });
  }
};

module.exports = { verifyToken };
