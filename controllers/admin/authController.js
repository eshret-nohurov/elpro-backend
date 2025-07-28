require('dotenv').config();

const User = require('../../models/User');
const jwt = require('jsonwebtoken');

class AuthController {
	async register(req, res) {
		try {
			const { username, password } = req.body;

			const existingUser = await User.findOne({ username });
			if (existingUser) {
				return res.status(400).json({
					message: 'Username already exists',
				});
			}

			const user = new User({ username, password });
			await user.save();

			res.status(201).json({
				message: 'Admin user created successfully',
			});
		} catch (error) {
			res.status(500).json({
				message: error.message,
			});
		}
	}

	async login(req, res) {
		try {
			const { username, password } = req.body;
			const user = await User.findOne({ username });

			if (!user) {
				return res.status(401).json({
					message: 'Неправильный логин или пароль',
				});
			}

			// Проверка пароля
			const isMatch = await user.comparePassword(password);
			if (!isMatch) {
				return res.status(401).json({
					message: 'Неправильный логин или пароль',
				});
			}

			// Генерация токена
			const token = jwt.sign(
				{ userId: user._id, role: user.role },
				process.env.JWT_SECRET,
				{ expiresIn: '12h' }
			);

			res.json({
				message: 'Вход успешен!',
				token,
				user: {
					id: user._id,
					username: user.username,
					role: user.role,
				},
			});
		} catch (error) {
			res.status(500).json({
				message: error.message,
			});
		}
	}

	async getUsers(req, res) {
		try {
			const users = await User.find()
				.sort({ _id: -1 })
				.select('-__v -password -createdAt')
				.lean();

			res.status(200).json({
				data: users,
			});
		} catch (error) {
			console.error('Ошибка получения списка пользователей:', error);

			res.status(500).json({
				error: 'Не удалось получить список пользователей!',
			});
		}
	}

	async getUserById(req, res) {
		try {
			const { id } = req.params;

			const user = await User.findById(id)
				.select('-__v -password -createdAt')
				.lean();

			if (!user) {
				return res.status(404).json({
					error: 'Пользователь не найден',
				});
			}

			res.status(200).json({
				data: user,
			});
		} catch (error) {
			console.error('Ошибка получения:', error);

			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить',
			});
		}
	}

	async createUser(req, res) {
		try {
			const { username, password, role } = req.body;

			const existingUser = await User.findOne({ username });
			if (existingUser) {
				return res.status(400).json({
					message: 'Пользователь с таким имененем уже существует',
				});
			}

			if (password.length < 8) {
				return res
					.status(400)
					.json({ error: 'Пароль должен быть не менее 8 символов' });
			}

			const user = new User({ username, password, role });
			await user.save();

			res.status(201).json({
				message: 'Пользователь успешно создан!',
			});
		} catch (error) {
			console.error('Ошибка создания пользователя:', error);
			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			res.status(statusCode).json({
				error: error.message,
			});
		}
	}

	async updateUsers(req, res) {
		try {
			const { id } = req.params;
			const { newPassword, role } = req.body;

			const user = await User.findById(id);
			if (!user) {
				return res.status(404).json({ error: 'Пользователь не найден' });
			}

			if (role) {
				user.role = role;
			}

			if (newPassword) {
				if (newPassword.length < 8) {
					return res.status(400).json({
						error: 'Пароль должен быть не менее 8 символов',
					});
				}
				user.password = newPassword;
			}

			await user.validate();
			await user.save();

			const userData = user.toObject();
			delete userData.password;
			delete userData.__v;

			res.status(200).json({
				message: 'Данные пользователя успешно обновлены!',
				user: userData,
			});
		} catch (error) {
			console.error('Ошибка обновления пользователя:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			res.status(statusCode).json({
				error: error.message.includes('validation failed')
					? 'Некорректные данные пользователя'
					: error.message,
			});
		}
	}

	async deleteUser(req, res) {
		try {
			const { id } = req.params;

			const user = await User.findById(id);
			if (!user) {
				return res.status(404).json({
					error: 'Пользователь не найден',
				});
			}

			await user.deleteOne();

			res.status(200).json({
				message: 'Пользовательо удален',
				deletedId: id,
			});
		} catch (error) {
			console.error('Ошибка удаления пользователя:', error);

			res.status(500).json({
				error: 'Не удалось удалить пользователя',
				details: error.message,
			});
		}
	}
}

module.exports = new AuthController();
