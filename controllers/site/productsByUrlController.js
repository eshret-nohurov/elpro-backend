const Category = require('../../models/Category');
const Product = require('../../models/Product');
const Settings = require('../../models/Settings');

class ProductsByUrlController {
	constructor() {
		this.getProductsByCategoryUrl = this.getProductsByCategoryUrl.bind(this);
		this.getAllDescendantCategoryIds =
			this.getAllDescendantCategoryIds.bind(this);
	}

	// Рекурсивная функция для сбора всех ID дочерних категорий
	async getAllDescendantCategoryIds(categoryId) {
		const children = await Category.find({ parent: categoryId })
			.select('_id')
			.lean();
		let descendantIds = children.map(child => child._id);

		for (const child of children) {
			const grandChildrenIds = await this.getAllDescendantCategoryIds(
				child._id
			);
			descendantIds = descendantIds.concat(grandChildrenIds);
		}

		return descendantIds;
	}

	async getProductsByCategoryUrl(req, res) {
		try {
			const { url } = req.params;

			// 1. Находим основную категорию по URL
			const mainCategory = await Category.findOne({ url }).lean();
			if (!mainCategory) {
				return res.status(404).json({ error: 'Категория не найдена' });
			}

			// 2. Собираем ID основной категории и всех ее потомков
			const descendantIds = await this.getAllDescendantCategoryIds(
				mainCategory._id
			);
			const allCategoryIds = [mainCategory._id, ...descendantIds];

			// 3. Получаем настройки для курса валют
			const settings = await Settings.findOne().sort({ createdAt: -1 }).lean();
			const exchangeRate = settings?.usdToTmtRate || 1;

			// 4. Находим все товары, которые входят в любую из найденных категорий
			const products = await Product.find({
				categories: { $in: allCategoryIds },
				stock: { $gt: 0 },
			})
				.select(
					'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories'
				)
				.lean();

			// 5. Конвертируем цену
			if (products.length > 0) {
				products.forEach(product => {
					product.price = parseFloat((product.price * exchangeRate).toFixed(2));
				});
			}

			// 6. Отдаем результат
			res.status(200).json({
				data: {
					category: {
						_id: mainCategory._id,
						name: mainCategory.name,
						url: mainCategory.url,
					},
					products: products || [],
				},
			});
		} catch (error) {
			console.error('Ошибка получения продуктов по URL:', error);
			res.status(500).json({ error: 'Не удалось получить данные' });
		}
	}
}

module.exports = new ProductsByUrlController();
