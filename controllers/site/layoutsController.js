const CategoryModel = require('../../models/Category');

class LayoutsController {
	async getNav(req, res) {
		try {
			const nav = await CategoryModel.find()
				.sort({ _id: -1 })
				.select('-__v -createdAt -products')
				.populate({
					path: 'subcategories',
					select: '-__v -category -createdAt -products',
				})
				.lean();

			res.status(200).json({
				nav: nav,
			});
		} catch (error) {
			console.error('Ошибка получения:', error);

			res.status(500).json({
				error: 'Не удалось загрузить данные',
			});
		}
	}
}

module.exports = new LayoutsController();
