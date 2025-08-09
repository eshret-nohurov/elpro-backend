const SettingsModel = require('../../models/Settings');
const CategoryModel = require('../../models/Category');
const SubcategoryModel = require('../../models/Subcategory');

class ProductsByUrlController {
	async getProductsByUrlByCategory(req, res) {
		try {
			const { url } = req.params;

			const settings = await SettingsModel.findOne()
				.sort({ createdAt: -1 })
				.lean();

			const exchangeRate = settings?.usdToTmtRate || 1;

			const category = await CategoryModel.findOne({ url: url })
				.populate({
					path: 'products',
					match: { stock: { $gt: 0 } },
					select:
						'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories -subcategories',
				})
				.select('-__v -createdAt')
				.lean();

			if (!category) {
				return res.status(404).json({
					error: 'Категория не найдена',
				});
			}

			if (category.products && category.products.length > 0) {
				category.products.forEach(product => {
					product.price = parseFloat((product.price * exchangeRate).toFixed(2));
				});
			}

			res.status(200).json({
				data: {
					category: {
						_id: category._id,
						name: category.name,
						url: category.url,
					},
					products: category.products || [],
				},
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

	async getProductsByUrlBySubCategory(req, res) {
		try {
			const { url } = req.params;

			const settings = await SettingsModel.findOne()
				.sort({ createdAt: -1 })
				.lean();

			const exchangeRate = settings?.usdToTmtRate || 1;

			const subcategory = await SubcategoryModel.findOne({ url: url })
				.populate({
					path: 'products',
					match: { stock: { $gt: 0 } },
					select:
						'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories -subcategories',
				})
				.populate({
					path: 'category',
					select: '-__v -createdAt',
				})
				.select('-__v -createdAt')
				.lean();

			if (!subcategory) {
				return res.status(404).json({
					error: 'Под Категория не найдена',
				});
			}

			if (subcategory.products && subcategory.products.length > 0) {
				subcategory.products.forEach(product => {
					product.price = parseFloat((product.price * exchangeRate).toFixed(2));
				});
			}

			res.status(200).json({
				data: {
					category: {
						_id: subcategory.category._id,
						name: subcategory.category.name,
						url: subcategory.category.url,
					},
					subcategory: {
						_id: subcategory._id,
						name: subcategory.name,
						url: subcategory.url,
					},
					products: subcategory.products || [],
				},
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

module.exports = new ProductsByUrlController();
