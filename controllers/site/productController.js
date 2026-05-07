const SettingsModel = require('../../models/Settings');
const ProductModel = require('../../models/Product');
const { applyProductPricing } = require('../../utils/pricing');

class ProductController {
	escapeRegex(value) {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	async getProduct(req, res) {
		try {
			const { id } = req.params;

			const settings = await SettingsModel.findOne()
				.sort({ createdAt: -1 })
				.lean();

			const exchangeRate = settings?.usdToTmtRate || 1;

			const product = await ProductModel.findById(id)
				.select('-__v -createdAt')
				.populate({
					path: 'relatedProducts',
					match: { stock: { $gt: 0 } },
					select:
						'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories',
					options: { limit: 4 },
				})
				.populate({
					path: 'categories',
					select: 'name url',
				})
				.lean();

			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найдена',
				});
			}

			applyProductPricing(product, exchangeRate);

			if (product.relatedProducts && product.relatedProducts.length > 0) {
				product.relatedProducts.forEach(related => {
					applyProductPricing(related, exchangeRate);
				});
			}

			res.status(200).json({
				product: product,
			});
		} catch (error) {
			console.error('Ошибка получения данных:', error);

			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат url',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить данные',
			});
		}
	}

	async searchProducts(req, res) {
		try {
			const query = String(req.query.query || '').trim();

			if (query.length < 2) {
				return res.status(200).json({
					count: 0,
					results: [],
				});
			}

			const settings = await SettingsModel.findOne()
				.sort({ createdAt: -1 })
				.lean();
			const exchangeRate = settings?.usdToTmtRate || 1;
			const safeQuery = this.escapeRegex(query);

			const products = await ProductModel.find({
				stock: { $gt: 0 },
				$or: [
					{ 'name.ru': { $regex: safeQuery, $options: 'i' } },
					{ 'name.en': { $regex: safeQuery, $options: 'i' } },
					{ 'name.tm': { $regex: safeQuery, $options: 'i' } },
				],
			})
				.limit(8)
				.select('name price discountPrice discountExpiresAt images stock')
				.lean();

			const results = products.map(product => {
				applyProductPricing(product, exchangeRate);

				return {
					_id: product._id,
					name: product.name,
					price: product.price,
					originalPrice: product.originalPrice,
					discountPrice: product.discountPrice,
					discountPercent: product.discountPercent,
					discountExpiresAt: product.discountExpiresAt,
					hasDiscount: product.hasDiscount,
					image: product.images?.[0] || null,
					stock: product.stock,
				};
			});

			res.status(200).json({
				count: results.length,
				results,
			});
		} catch (error) {
			console.error('Ошибка поиска товаров:', error);
			res.status(500).json({
				error: 'Не удалось выполнить поиск',
			});
		}
	}
}

module.exports = new ProductController();
