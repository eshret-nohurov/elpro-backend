/*
 * Order Admin
 * Управляет заказами из админки, синхронизирует остатки и отправляет уведомления.
 */
const OrdersModel = require('../../models/Orders');
const SettingsModel = require('../../models/Settings');
const sendEmail = require('../site/emailController');
const { logAction } = require('../../utils/auditLogger');
const { syncOrderStock } = require('../../utils/orderStock');
const {
	buildAdminOrderEmail,
	buildCustomerOrderEmail,
} = require('../site/orderEmailTemplates');

const ORDER_NOTIFICATION_EMAILS = [
	'pochta.spam.08@gmail.com',
	'elpro.store@gmail.com',
];

const statusLabels = {
	pending: 'Новый',
	processing: 'В обработке',
	completed: 'Завершен',
	cancelled: 'Отменен',
};

const transformOrder = order => ({
	...order,
	id: order._id,
	statusLabel: statusLabels[order.status] || order.status,
	productsCount: order.products.reduce((total, product) => total + product.quantity, 0),
	deliveryType: order.isPickup ? 'Самовывоз' : 'Доставка',
	subtotalPrice:
		order.subtotalPrice ??
		order.products.reduce((total, product) => total + product.price * product.quantity, 0),
	deliveryPrice: order.deliveryPrice || 0,
});

const badRequest = message => {
	const error = new Error(message);
	error.statusCode = 400;
	throw error;
};

const forbidden = message => {
	const error = new Error(message);
	error.statusCode = 403;
	throw error;
};

const getDeliveryPrice = async ({ location, isPickup }) => {
	if (isPickup) return 0;

	const settings = await SettingsModel.findOne().sort({ createdAt: -1 }).lean();
	const deliveryPrices = settings?.deliveryPrices || {};
	const price = deliveryPrices instanceof Map
		? deliveryPrices.get(location)
		: deliveryPrices[location];

	return Number(price || 0);
};

const normalizeOrderPayload = async payload => {
	const {
		location,
		isPickup = false,
		address = '',
		name,
		phone,
		email = '',
		comment = '',
		products,
		status = 'pending',
	} = payload;

	if (!location) badRequest('Город не указан');
	if (!isPickup && !address) badRequest('Адрес доставки не указан');
	if (!name) badRequest('Имя не указано');
	if (!phone) badRequest('Телефон не указан');
	if (!Array.isArray(products) || products.length === 0) {
		badRequest('Добавьте хотя бы один товар');
	}
	if (!Object.keys(statusLabels).includes(status)) {
		badRequest('Неверный статус заказа');
	}

	const normalizedProducts = products.map(product => ({
		_id: String(product._id || product.id || '').trim(),
		name: String(product.name || '').trim(),
		quantity: Number(product.quantity),
		price: Number(product.price),
		originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
		hasDiscount: Boolean(product.hasDiscount),
		discountPercent: Number(product.discountPercent || 0),
		discountExpiresAt: product.discountExpiresAt || null,
	}));

	if (
		normalizedProducts.some(
			product =>
				!product._id ||
				!product.name ||
				!Number.isFinite(product.quantity) ||
				product.quantity < 1 ||
				!Number.isFinite(product.price) ||
				product.price < 0
		)
	) {
		badRequest('Проверьте товары, количество и цены');
	}

	const subtotalPrice = normalizedProducts.reduce(
		(total, product) => total + product.price * product.quantity,
		0
	);
	const deliveryPrice = await getDeliveryPrice({ location, isPickup });

	return {
		location,
		isPickup,
		address: isPickup ? '' : address,
		name,
		phone,
		email,
		comment,
		products: normalizedProducts,
		subtotalPrice,
		deliveryPrice,
		totalPrice: subtotalPrice + deliveryPrice,
		status,
	};
};

const getErrorStatus = error =>
	error.statusCode || (error.name === 'ValidationError' ? 400 : 500);

const sendOrderEmails = async order => {
	const adminEmail = buildAdminOrderEmail(order);
	const emailTasks = [
		sendEmail(
			ORDER_NOTIFICATION_EMAILS.join(','),
			adminEmail.subject,
			adminEmail.text,
			adminEmail.html
		),
	];

	if (order.email) {
		const customerEmail = buildCustomerOrderEmail(order);
		emailTasks.push(
			sendEmail(
				order.email,
				customerEmail.subject,
				customerEmail.text,
				customerEmail.html
			)
		);
	}

	const emailResults = await Promise.allSettled(emailTasks);
	return !emailResults.some(
		result => result.status === 'rejected' || result.value?.success === false
	);
};

class AdminOrderController {
	async getOrders(req, res) {
		try {
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const status = req.query.status;
			const skip = (page - 1) * limit;
			const filter = status ? { status } : {};

			const [totalCount, orders] = await Promise.all([
				OrdersModel.countDocuments(filter),
				OrdersModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			]);

			const totalPages = Math.ceil(totalCount / limit);

			res.status(200).json({
				data: orders.map(transformOrder),
				meta: {
					total: totalCount,
					page,
					limit,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
			});
		} catch (error) {
			console.error('Ошибка получения заказов:', error);
			res.status(500).json({ error: 'Не удалось получить список заказов' });
		}
	}

	async getOrderById(req, res) {
		try {
			const order = await OrdersModel.findById(req.params.id).lean();

			if (!order) {
				return res.status(404).json({ error: 'Заказ не найден' });
			}

			res.status(200).json({ data: transformOrder(order) });
		} catch (error) {
			console.error('Ошибка получения заказа:', error);
			res.status(500).json({ error: 'Не удалось получить заказ' });
		}
	}

	async updateOrderStatus(req, res) {
		try {
			const { status } = req.body;
			const allowedStatuses = Object.keys(statusLabels);

			if (!allowedStatuses.includes(status)) {
				return res.status(400).json({ error: 'Неверный статус заказа' });
			}

			const existingOrder = await OrdersModel.findById(req.params.id).lean();

			if (!existingOrder) {
				return res.status(404).json({ error: 'Заказ не найден' });
			}

			const nextOrder = { ...existingOrder, status };
			const stockResult = await syncOrderStock({
				oldOrder: existingOrder,
				newOrder: nextOrder,
			});

			const order = await OrdersModel.findByIdAndUpdate(
				req.params.id,
				{ status, stockApplied: stockResult.stockApplied },
				{ new: true, runValidators: true }
			).lean();

			await logAction({
				req,
				action: 'update',
				entity: 'order',
				entityId: order._id,
				entityName: order.name,
				description: `Изменил статус заказа ${order.name}: ${statusLabels[existingOrder.status]} → ${statusLabels[status]}`,
				meta: { oldStatus: existingOrder.status, newStatus: status, stockDeltas: stockResult.deltas },
			});

			res.status(200).json({
				data: transformOrder(order),
				message: 'Статус заказа обновлен',
			});
		} catch (error) {
			console.error('Ошибка обновления статуса заказа:', error);
			res.status(getErrorStatus(error)).json({
				error: error.message || 'Не удалось обновить статус заказа',
			});
		}
	}

	async createOrder(req, res) {
		try {
			const orderPayload = await normalizeOrderPayload(req.body);
			const stockResult = await syncOrderStock({
				newOrder: orderPayload,
			});
			const order = await OrdersModel.create({
				...orderPayload,
				stockApplied: stockResult.stockApplied,
			});
			const orderObject = order.toObject();
			const emailSent = await sendOrderEmails(orderObject);

			await logAction({
				req,
				action: 'create',
				entity: 'order',
				entityId: orderObject._id,
				entityName: orderObject.name,
				description: `Создал заказ для ${orderObject.name}`,
				meta: { totalPrice: orderObject.totalPrice, stockDeltas: stockResult.deltas },
			});

			res.status(201).json({
				data: {
					...transformOrder(orderObject),
					emailSent,
				},
				message: emailSent
					? 'Заказ создан, письма отправлены'
					: 'Заказ создан, но одно или несколько писем не отправились',
			});
		} catch (error) {
			console.error('Ошибка создания заказа из админки:', error);
			res.status(getErrorStatus(error)).json({
				error:
					error.name === 'ValidationError'
						? Object.values(error.errors)
								.map(err => err.message)
								.join(', ')
						: error.message,
			});
		}
	}

	async updateOrder(req, res) {
		try {
			const orderPayload = await normalizeOrderPayload(req.body);
			const existingOrder = await OrdersModel.findById(req.params.id).lean();
			if (!existingOrder) {
				return res.status(404).json({ error: 'Заказ не найден' });
			}

			const nextOrder = {
				...orderPayload,
				_id: existingOrder._id,
			};
			const stockResult = await syncOrderStock({
				oldOrder: existingOrder,
				newOrder: nextOrder,
			});
			const order = await OrdersModel.findByIdAndUpdate(req.params.id, orderPayload, {
				new: true,
				runValidators: true,
			}).lean();

			if (!order) {
				return res.status(404).json({ error: 'Заказ не найден' });
			}

			const updatedOrder = await OrdersModel.findByIdAndUpdate(
				req.params.id,
				{ stockApplied: stockResult.stockApplied },
				{ new: true, runValidators: true }
			).lean();

			await logAction({
				req,
				action: 'update',
				entity: 'order',
				entityId: updatedOrder._id,
				entityName: updatedOrder.name,
				description: `Редактировал заказ ${updatedOrder.name}`,
				meta: { oldStatus: existingOrder.status, newStatus: updatedOrder.status, stockDeltas: stockResult.deltas },
			});

			res.status(200).json({
				data: transformOrder(updatedOrder),
				message: 'Заказ обновлен',
			});
		} catch (error) {
			console.error('Ошибка обновления заказа:', error);
			res.status(getErrorStatus(error)).json({
				error:
					error.name === 'ValidationError'
						? Object.values(error.errors)
								.map(err => err.message)
								.join(', ')
						: error.message,
			});
		}
	}

	async deleteOrder(req, res) {
		try {
			if (req.user?.username !== 'eshret') {
				forbidden('Удалять заказы может только пользователь eshret');
			}

			const existingOrder = await OrdersModel.findById(req.params.id).lean();
			if (!existingOrder) {
				return res.status(404).json({ error: 'Заказ не найден' });
			}

			await syncOrderStock({
				oldOrder: existingOrder,
				newOrder: {
					...existingOrder,
					status: 'cancelled',
				},
			});

			await OrdersModel.findByIdAndDelete(req.params.id);

			res.status(200).json({
				message: 'Заказ удален',
			});
		} catch (error) {
			console.error('Ошибка удаления заказа:', error);
			res.status(getErrorStatus(error)).json({
				error: error.message || 'Не удалось удалить заказ',
			});
		}
	}
}

module.exports = new AdminOrderController();
