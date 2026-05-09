/*
 * Auth Routes
 * Открывает маршруты входа и регистрации для пользователей админ-панели.
 */
const express = require('express');
const router = express.Router();
const AuthController = require('../../controllers/admin/authController');


router.post('/registration', AuthController.register);

router.get('/captcha', AuthController.captcha);

router.post('/login', AuthController.login);

module.exports = router;
