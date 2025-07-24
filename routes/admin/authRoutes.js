const express = require('express');
const router = express.Router();
const AuthController = require('../../controllers/admin/authController');

// Регистрация
router.post('/registration', AuthController.register);

// Логин
router.post('/login', AuthController.login);

module.exports = router;
