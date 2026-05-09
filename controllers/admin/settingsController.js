/*
 * Settings Admin
 * Управляет настройками магазина, курсом валют, контактами и ценами доставки.
 */
const Settings = require('../../models/Settings');

const normalizeDeliveryPrices = deliveryPrices => {
	if (!deliveryPrices) return {};
	if (deliveryPrices instanceof Map) return Object.fromEntries(deliveryPrices);
	return Object.fromEntries(Object.entries(deliveryPrices));
};

const normalizeDeliveryPricesForResponse = settings => ({
	...settings,
	deliveryPrices: normalizeDeliveryPrices(settings.deliveryPrices),
});

class SettingsController {
	async getSettings(req, res) {
		try {
			const settings = await Settings.find()
				.sort({ createdAt: -1 })
				.limit(1)
				.lean();

			if (!settings) {
				return res.status(404).json({ error: 'Настройки не найдены' });
			}

			res.status(200).json({
				data: settings.map(normalizeDeliveryPricesForResponse),
			});
		} catch (error) {
			console.error('Ошибка получения настроек:', error);

			res.status(500).json({
				error: 'Не удалось получить настройки',
			});
		}
	}

	async createSettings(req, res) {
		try {
			const { usdToTmtRate, deliveryPrices = {} } = req.body;

			if (!usdToTmtRate) {
				throw new Error('Курс волют обязателен');
			}

			const settings = new Settings({
				usdToTmtRate,
				deliveryPrices,
			});

			await settings.validate();
			await settings.save();

			res.status(201).json({
				data: settings,
			});
		} catch (error) {
			console.error('Ошибка создания настроек:', error);

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

	async updateSettings(req, res) {
		try {
			const { id } = req.params;
			const { usdToTmtRate, deliveryPrices = {} } = req.body;

			const settings = await Settings.findById(id);
			if (!settings) {
				throw new Error('Настройки не найдены');
			}

			const updateData = {
				usdToTmtRate,
				deliveryPrices,
			};

			const updatedSettings = await Settings.findByIdAndUpdate(id, updateData, {
				new: true,
				validate: true,
			});

			res.status(200).json({
				data: updatedSettings,
			});
		} catch (error) {
			console.error('Ошибка обновления настроек:', error);

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

module.exports = new SettingsController();
