const { auth } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 [AUTH] Authorization Header:', authHeader ? 'PRESENTE' : 'AUSENTE');
    
    const token = authHeader?.split(' ')[1];
    console.log('🔍 [AUTH] Token completo:', token || 'NENHUM');
    console.log('🔍 [AUTH] Token tipo:', typeof token, 'tamanho:', token?.length || 0);
    
    if (!token) {
      console.log('❌ [AUTH] Token não fornecido');
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Log do primeiro e último 50 caracteres para debug
    console.log('🔍 [AUTH] Token inicio:', token.substring(0, 50));
    console.log('🔍 [AUTH] Token fim:', token.substring(Math.max(0, token.length - 50)));

    console.log('⏳ [AUTH] Verificando token com Firebase...');
    console.log('⏳ [AUTH] Firebase auth:', auth ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL');
    
    const decodedToken = await auth.verifyIdToken(token);
    console.log('✅ [AUTH] Token válido! UID:', decodedToken.uid);
    console.log('✅ [AUTH] Token email:', decodedToken.email);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ [AUTH] Erro na verificação do token:', error.message);
    console.error('🔍 [AUTH] Código do erro:', error.code);
    console.error('🔍 [AUTH] Stack completo:', error.stack);
    
    // Verificar se é erro de token inválido
    let errorMessage = 'Token inválido';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expirado';
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'ID Token inválido';
    } else if (error.code === 'auth/invalid-token') {
      errorMessage = 'Token inválido';
    }
    
    res.status(401).json({
      success: false,
      message: errorMessage,
      error: error.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { verifyToken };
