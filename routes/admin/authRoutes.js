const express = require('express');
const router = express.Router();
const authController = require('../../controllers/admin/authController');

// Регистрация
router.post('/registration', authController.register);

// Логин
router.post('/login', authController.login);

module.exports = router;
