const express = require('express');
const router = express.Router();
const { validateSchema } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const authController = require('../controllers/authController');
const { signupSchema, loginSchema, forgotPasswordSchema } = require('../validation');

router.post('/signup', validateSchema(signupSchema), authController.signup);
router.post('/login', validateSchema(loginSchema), authController.login);
router.post('/forgot-password', validateSchema(forgotPasswordSchema), authController.forgotPassword);
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
