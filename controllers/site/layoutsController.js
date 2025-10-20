const Category = require('../../models/Category');

class LayoutsController {
	async getNav(req, res) {
		try {
			// Функция для рекурсивной загрузки дочерних элементов
			const populateChildren = async category => {
				if (!category.children || category.children.length === 0) {
					return category;
				}

				const children = await Category.find({
					_id: { $in: category.children },
				})
					.select('-__v -createdAt -parent -products')
					.sort({ position: 1 })
					.lean();

				const populatedChildren = await Promise.all(
					children.map(child => populateChildren(child))
				);
				populatedChildren.sort((a, b) => a.position - b.position);
				category.children = populatedChildren;
				return category;
			};

			// 1. Находим все категории верхнего уровня (у которых нет родителя)
			const topLevelCategories = await Category.find({ parent: null })
				.sort({ position: 1 })
				.select('-__v -createdAt -parent -products')
				.lean();

			// 2. Рекурсивно заполняем дочерние элементы для каждой категории верхнего уровня
			const navTree = await Promise.all(
				topLevelCategories.map(category => populateChildren(category))
			);

			navTree.sort((a, b) => a.position - b.position);

			res.status(200).json({ nav: navTree });
		} catch (error) {
			console.error('Ошибка получения навигации:', error);
			res.status(500).json({ error: 'Не удалось загрузить навигацию' });
		}
	}
}

module.exports = new LayoutsController();
