const errorHandler = (err, req, res, next) => {
  console.error('Erro:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err : undefined,
    timestamp: new Date().toISOString()
  });
};

module.exports = { errorHandler };
