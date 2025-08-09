const OrdersModel = require('../../models/Orders');
const sendEmail = require('./emailController');

class OrderController {
	async createOrder(req, res) {
		try {
			const {
				location,
				isPickup,
				address,
				name,
				phone,
				email,
				comment,
				products,
				totalPrice,
			} = req.body;

			if (!location) {
				throw new Error('Город не указан');
			}

			if (!isPickup && !address) {
				throw new Error('Адрес доставки не указан');
			}

			if (!name) {
				throw new Error('Имя не указано');
			}

			if (!phone) {
				throw new Error('Телефон не указан');
			}

			if (!products || products.length === 0) {
				throw new Error('Не указаны товары в заказе');
			}

			const newOrder = new OrdersModel({
				location,
				isPickup,
				address,
				name,
				phone,
				email,
				comment,
				products,
				totalPrice,
			});

			await newOrder.validate();
			await newOrder.save();

			sendEmail();

			// Себе тоже отправляем уведомление
			sendEmail(
				'eshretnohurov@yandex.ru',
				'elpro - Новый заказ',
				`${totalPrice}тмт`
			);

			res.status(201).json({ message: 'Заказ был успешно создан' });
		} catch (error) {
			console.error('Ошибка создания заказа:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				error: errorMessage,
			});
		}
	}
}

module.exports = new OrderController();
