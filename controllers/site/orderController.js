/*
 * Site Orders
 * Создает заказы с сайта, пересчитывает цены на сервере, двигает остатки и отправляет письма.
 */
const OrdersModel = require('../../models/Orders');
const ProductModel = require('../../models/Product');
const SettingsModel = require('../../models/Settings');
const sendEmail = require('./emailController');
const { logAction } = require('../../utils/auditLogger');
const { syncOrderStock } = require('../../utils/orderStock');
const { applyProductPricing } = require('../../utils/pricing');
const {
	buildAdminOrderEmail,
	buildCustomerOrderEmail,
} = require('./orderEmailTemplates');

const ORDER_NOTIFICATION_EMAILS = [
	'pochta.spam.08@gmail.com',
	'elpro.store@gmail.com',
];

const getDeliveryPrice = async ({ location, isPickup, settings = null }) => {
	if (isPickup) return 0;

	settings = settings || await SettingsModel.findOne().sort({ createdAt: -1 }).lean();
	const deliveryPrices = settings?.deliveryPrices || {};
	const price = deliveryPrices instanceof Map
		? deliveryPrices.get(location)
		: deliveryPrices[location];

	return Number(price || 0);
};

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

			const settings = await SettingsModel.findOne().sort({ createdAt: -1 }).lean();
			const exchangeRate = settings?.usdToTmtRate || 1;
			const productIds = products.map(product =>
				String(product._id || product.id || '').trim()
			);
			const dbProducts = await ProductModel.find({ _id: { $in: productIds } })
				.select('name price discountPrice discountExpiresAt stock')
				.lean();
			const dbProductsById = new Map(
				dbProducts.map(product => [String(product._id), product])
			);

			const normalizedProducts = products.map(product => {
				const productId = String(product._id || product.id || '').trim();
				const dbProduct = dbProductsById.get(productId);

				if (!dbProduct) {
					throw new Error('Один из товаров в заказе не найден');
				}

				applyProductPricing(dbProduct, exchangeRate);

				return {
					_id: productId,
					name: dbProduct.name?.ru || String(product.name || '').trim(),
					quantity: Number(product.quantity),
					price: Number(dbProduct.price),
					originalPrice: dbProduct.originalPrice ? Number(dbProduct.originalPrice) : null,
					hasDiscount: Boolean(dbProduct.hasDiscount),
					discountPercent: Number(dbProduct.discountPercent || 0),
					discountExpiresAt: dbProduct.discountExpiresAt || null,
				};
			});
			const subtotalPrice = normalizedProducts.reduce(
				(total, product) => total + product.price * product.quantity,
				0
			);
			const deliveryPrice = await getDeliveryPrice({ location, isPickup, settings });

			const newOrder = new OrdersModel({
				location,
				isPickup,
				address,
				name,
				phone,
				email,
				comment,
				products: normalizedProducts,
				subtotalPrice,
				deliveryPrice,
				totalPrice: subtotalPrice + deliveryPrice,
			});

			await newOrder.validate();
			const stockResult = await syncOrderStock({
				newOrder: newOrder.toObject(),
			});
			newOrder.stockApplied = stockResult.stockApplied;
			await newOrder.save();

			const savedOrder = newOrder.toObject();
			const adminEmail = buildAdminOrderEmail(savedOrder);
			const emailTasks = [
				sendEmail(
					ORDER_NOTIFICATION_EMAILS.join(','),
					adminEmail.subject,
					adminEmail.text,
					adminEmail.html
				),
			];

			if (email) {
				const customerEmail = buildCustomerOrderEmail(savedOrder);
				emailTasks.push(
					sendEmail(email, customerEmail.subject, customerEmail.text, customerEmail.html)
				);
			}

			const emailResults = await Promise.allSettled(emailTasks);
			const hasEmailError = emailResults.some(
				result => result.status === 'rejected' || result.value?.success === false
			);

			if (hasEmailError) {
				console.error('Заказ создан, но одно или несколько писем не отправились');
			}

			await logAction({
				action: 'create',
				entity: 'order',
				entityId: savedOrder._id,
				entityName: savedOrder.name,
				description: `Новый заказ с сайта от ${savedOrder.name}`,
				meta: { totalPrice: savedOrder.totalPrice, stockDeltas: stockResult.deltas },
			});

			res.status(201).json({
				message: 'Заказ был успешно создан',
				data: {
					id: newOrder._id,
					emailSent: !hasEmailError,
				},
			});
		} catch (error) {
			console.error('Ошибка создания заказа:', error);

			const statusCode =
				error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
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
