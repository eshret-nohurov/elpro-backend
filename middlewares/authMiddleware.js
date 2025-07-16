const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
	try {
		// Получаем токен из заголовка Authorization
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				success: false,
				message: 'Access denied. No token provided.',
			});
		}

		const token = authHeader.split(' ')[1];

		// Верификация токена
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Поиск пользователя в базе
		const user = await User.findById(decoded.userId).select('-password');
		if (!user) {
			return res.status(401).json({
				success: false,
				message: 'Invalid token. User not found.',
			});
		}

		// Добавляем пользователя в объект запроса
		req.user = user;
		next();
	} catch (error) {
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				success: false,
				message: 'Token expired. Please log in again.',
			});
		}

		res.status(400).json({
			success: false,
			message: 'Invalid token.',
		});
	}
};

module.exports = authMiddleware;
