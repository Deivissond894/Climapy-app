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
  validateSchema
};