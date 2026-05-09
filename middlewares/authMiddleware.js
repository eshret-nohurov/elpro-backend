/*
 * Auth Guard
 * Проверяет JWT, загружает пользователя и передает его дальше в защищенные маршруты.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
	try {

		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				message: 'Access denied. No token provided.',
			});
		}

		const token = authHeader.split(' ')[1];


		const decoded = jwt.verify(token, process.env.JWT_SECRET);


		const user = await User.findById(decoded.userId).select('-password');
		if (!user) {
			return res.status(401).json({
				message: 'Invalid token. User not found.',
			});
		}


		req.user = user;
		next();
	} catch (error) {
		if (error.name === 'TokenExpiredError') {
			return res.status(401).json({
				message: 'Token expired. Please log in again.',
			});
		}

		res.status(400).json({
			message: 'Invalid token.',
		});
	}
};

module.exports = authMiddleware;
