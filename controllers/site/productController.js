const SettingsModel = require('../../models/Settings');
const ProductModel = require('../../models/Product');

class ProductController {
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
				.lean();

			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найдена',
				});
			}

			product.price = parseFloat((product.price * exchangeRate).toFixed(2));

			if (product.relatedProducts && product.relatedProducts.length > 0) {
				product.relatedProducts.forEach(related => {
					related.price = parseFloat((related.price * exchangeRate).toFixed(2));
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
}

module.exports = new ProductController();
