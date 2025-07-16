require('dotenv').config();

const User = require('../../models/User');
const jwt = require('jsonwebtoken');

const authController = {
	register: async (req, res) => {
		try {
			const { username, password } = req.body;

			// Проверка существующего пользователя
			const existingUser = await User.findOne({ username });
			if (existingUser) {
				return res.status(400).json({
					success: false,
					message: 'Username already exists',
				});
			}

			// Создание нового пользователя
			const user = new User({ username, password });
			await user.save();

			res.status(201).json({
				success: true,
				message: 'Admin user created successfully',
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	},

	login: async (req, res) => {
		try {
			const { username, password } = req.body;
			const user = await User.findOne({ username });

			if (!user) {
				return res.status(401).json({
					success: false,
					message: 'Invalid credentials',
				});
			}

			// Проверка пароля
			const isMatch = await user.comparePassword(password);
			if (!isMatch) {
				return res.status(401).json({
					success: false,
					message: 'Invalid credentials',
				});
			}

			// Генерация токена
			const token = jwt.sign(
				{ userId: user._id, role: user.role },
				process.env.JWT_SECRET,
				{ expiresIn: '6h' }
			);

			res.json({
				success: true,
				message: 'Logged in successfully',
				token,
				user: {
					id: user._id,
					username: user.username,
					role: user.role,
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	},
};

module.exports = authController;
