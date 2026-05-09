/*
 * Products By URL
 * Находит товары по URL категории и собирает дочерние категории для полного списка.
 */
const Category = require('../../models/Category');
const Product = require('../../models/Product');
const Settings = require('../../models/Settings');
const { applyProductPricing } = require('../../utils/pricing');

class ProductsByUrlController {
	constructor() {
		this.getProductsByCategoryUrl = this.getProductsByCategoryUrl.bind(this);
		this.getAllDescendantCategoryIds =
			this.getAllDescendantCategoryIds.bind(this);
	}


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


			const mainCategory = await Category.findOne({ url }).lean();
			if (!mainCategory) {
				return res.status(404).json({ error: 'Категория не найдена' });
			}


			const descendantIds = await this.getAllDescendantCategoryIds(
				mainCategory._id
			);
			const allCategoryIds = [mainCategory._id, ...descendantIds];


			const settings = await Settings.findOne().sort({ createdAt: -1 }).lean();
			const exchangeRate = settings?.usdToTmtRate || 1;


			const products = await Product.find({
				categories: { $in: allCategoryIds },
			})
				.select(
					'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories'
				)
				.lean();


			if (products.length > 0) {
				products.forEach(product => {
					applyProductPricing(product, exchangeRate);
				});
			}


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
