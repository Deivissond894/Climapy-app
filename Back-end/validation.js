const Joi = require('joi');

// Schema de validação para signup
const signupSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email deve ter um formato válido',
      'any.required': 'Email é obrigatório'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Senha deve ter pelo menos 6 caracteres',
      'any.required': 'Senha é obrigatória'
    }),
  displayName: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome deve ter no máximo 50 caracteres'
    })
});

// Schema de validação para login
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email deve ter um formato válido',
      'any.required': 'Email é obrigatório'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Senha é obrigatória'
    }),
  rememberMe: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'Lembrar de mim deve ser verdadeiro ou falso'
    })
});

// Schema de validação para forgot password
const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email deve ter um formato válido',
      'any.required': 'Email é obrigatório'
    })
});

// Schema de validação para processamento de áudio com IA
const processAudioSchema = Joi.object({
  audioData: Joi.string()
    .required()
    .messages({
      'any.required': 'Dados de áudio são obrigatórios',
      'string.base': 'Dados de áudio devem estar em formato base64'
    }),
  audioFormat: Joi.string()
    .valid('wav', 'mp3', 'ogg', 'webm', 'flac')
    .default('wav')
    .messages({
      'any.only': 'Formato de áudio deve ser: wav, mp3, ogg, webm ou flac'
    }),
  uid: Joi.string()
    .optional()
    .messages({
      'string.base': 'UID deve ser uma string válida'
    }),
  clientId: Joi.string()
    .optional()
    .messages({
      'string.base': 'ID do cliente deve ser uma string válida'
    })
});

// Middleware de validação
const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  processAudioSchema,
  validateSchema
};