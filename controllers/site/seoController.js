/*
 * SEO Data
 * Отдает публичные категории и товары, чтобы сайт мог собрать актуальную карту сайта.
 */
const CategoryModel = require('../../models/Category');
const ProductModel = require('../../models/Product');

class SeoController {
	async getSitemapData(req, res) {
		try {
			const [categories, products] = await Promise.all([
				CategoryModel.find({})
					.select('url createdAt')
					.sort({ position: 1 })
					.lean(),
				ProductModel.find({})
					.select('_id createdAt')
					.sort({ createdAt: -1 })
					.lean(),
			]);

			res.status(200).json({
				categories: categories.map(category => ({
					url: category.url,
					updatedAt: category.createdAt,
				})),
				products: products.map(product => ({
					id: product._id,
					updatedAt: product.createdAt,
				})),
			});
		} catch (error) {
			console.error('Ошибка получения SEO данных:', error);
			res.status(500).json({
				error: 'Не удалось получить SEO данные',
			});
		}
	}
}

module.exports = new SeoController();
