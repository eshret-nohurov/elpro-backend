const Category = require('../../models/Category');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class CatalogController {
	constructor() {
		this.getCategories = this.getCategories.bind(this);
		this.getCategoryById = this.getCategoryById.bind(this);
		this.createCategory = this.createCategory.bind(this);
		this.updateCategory = this.updateCategory.bind(this);
		this.deleteCategory = this.deleteCategory.bind(this);
		this.deleteCategoryRecursive = this.deleteCategoryRecursive.bind(this);
	}

	// Получить плоский список всех категорий для админки
	async getCategories(req, res) {
		try {
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			const totalCount = await Category.countDocuments();
			const categories = await Category.find()
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('-__v -icon -products -prent -children')
				.lean();

			const totalPages = Math.ceil(totalCount / limit);

			const categoriesTransformed = categories.map(cat => ({
				...cat,
				name: cat.name && cat.name.ru ? cat.name.ru : '',
			}));

			res.status(200).json({
				data: categoriesTransformed,
				meta: {
					total: totalCount,
					page,
					limit,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
			});
		} catch (error) {
			console.error('Ошибка получения категорий:', error);
			res.status(500).json({ error: 'Не удалось получить список категорий' });
		}
	}

	// Получить одну категорию по ID
	async getCategoryById(req, res) {
		try {
			const { id } = req.params;
			const category = await Category.findById(id)
				.populate('parent', 'name _id')
				.select('-__v -children -products')
				.lean();

			if (!category) {
				return res.status(404).json({ error: 'Категория не найдена' });
			}

			res.status(200).json({ data: category });
		} catch (error) {
			console.error('Ошибка получения категории:', error);
			res.status(500).json({ error: 'Не удалось получить категорию' });
		}
	}

	// Получить категории для выпадающего списка при создании/редактировании категории
	async getCategoriesForList(req, res) {
		try {
			const categories = await Category.find({})
				.select('_id name.ru')
				.sort({ 'name.ru': 1 });

			if (!categories || categories.length === 0) {
				return res.status(404).json({
					error: 'Категории не найдены',
				});
			}

			const formattedCategories = categories.map(category => ({
				value: category._id,
				label: category.name.ru,
			}));

			res.status(200).json({
				data: formattedCategories,
				message: 'Список категорий успешно получен',
			});
		} catch (error) {
			console.error('Ошибка получения списка категорий:', error);
			res.status(500).json({
				error: 'Произошла ошибка при получении списка категорий',
			});
		}
	}

	// Создать новую категорию
	async createCategory(req, res) {
		try {
			const { name, url, parentId, position } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			if (!url) {
				throw new Error('URL обязателен');
			}

			if (!position) {
				throw new Error('position обязателен');
			}

			const existingCategory = await Category.findOne({ url });
			if (existingCategory) {
				return res
					.status(400)
					.json({ error: 'Категория с таким URL уже существует' });
			}

			let iconPath = '';
			if (file) {
				const { svg, png } = await processImage(file, 'categories', true);
				iconPath = svg || png;
			}

			const category = new Category({
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url,
				icon: iconPath || '',
				parent: parentId || null,
				position: position,
			});

			await category.validate();
			await category.save();

			// Если указан родитель, добавляем новую категорию в его список дочерних
			if (parentId) {
				await Category.findByIdAndUpdate(parentId, {
					$push: { children: category._id },
				});
			}

			res
				.status(201)
				.json({ data: category, message: 'Категория успешно создана' });
		} catch (error) {
			console.error('Ошибка создания категории:', error);
			res.status(500).json({ error: 'Ошибка создания категории' });
		}
	}

	// Обновить категорию
	async updateCategory(req, res) {
		try {
			const { id } = req.params;
			const { name, url, parentId, position } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			const categoryToUpdate = await Category.findById(id);
			if (!categoryToUpdate) {
				return res.status(404).json({ error: 'Категория не найдена' });
			}

			if (!parsedName.ru) {
				return res.status(404).json({ error: 'Русское название обязательно' });
			}

			let iconPath = categoryToUpdate.icon;
			if (file) {
				// Удаляем старые иконки
				deleteImage(categoryToUpdate.icon);

				const { svg, png } = await processImage(file, 'categories', true);
				iconPath = svg || png;
			}

			const oldParentId = categoryToUpdate.parent;

			// Если родитель изменился
			if (String(oldParentId) !== String(parentId)) {
				// Убираем из списка дочерних у старого родителя
				if (oldParentId) {
					await Category.findByIdAndUpdate(oldParentId, {
						$pull: { children: id },
					});
				}

				// Добавляем в список дочерних к новому родителю
				if (parentId) {
					await Category.findByIdAndUpdate(parentId, {
						$push: { children: id },
					});
				}
			}

			const updateData = {
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url,
				icon: iconPath,
				parent: parentId || null,
				position: position,
			};

			const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
				new: true,
				validate: true,
			});

			res.status(200).json({
				data: updatedCategory,
				message: 'Категория успешно обновлена',
			});
		} catch (error) {
			console.error('Ошибка обновления категории:', error);
			res.status(500).json({ error: 'Ошибка обновления категории' });
		}
	}

	// Рекурсивная функция удаления категории и всех ее потомков
	async deleteCategoryRecursive(categoryId) {
		try {
			const category = await Category.findById(categoryId);
			if (!category) return;

			// Рекурсивно удаляем всех детей
			if (category.children && category.children.length > 0) {
				await Promise.all(
					category.children.map(childId =>
						this.deleteCategoryRecursive(childId)
					)
				);
			}

			// Удаляем саму категорию
			await Category.findByIdAndDelete(categoryId);

			// Если есть иконка, удаляем ее
			if (category.icon) {
				await deleteImage(category.icon);
			}
		} catch (error) {
			console.error('Ошибка удаления категории:', error);
		}
	}

	// Удалить категорию
	async deleteCategory(req, res) {
		try {
			const { id } = req.params;
			const categoryToDelete = await Category.findById(id);

			if (!categoryToDelete) {
				return res.status(404).json({ error: 'Категория не найдена' });
			}

			// Убираем категорию из списка дочерних у родителя
			if (categoryToDelete.parent) {
				await Category.findByIdAndUpdate(categoryToDelete.parent, {
					$pull: { children: id },
				});
			}

			// Запускаем рекурсивное удаление
			await this.deleteCategoryRecursive(id);

			res
				.status(200)
				.json({ message: 'Категория и все ее подкатегории успешно удалены' });
		} catch (error) {
			console.error('Ошибка удаления категории:', error);
			res.status(500).json({ error: 'Ошибка удаления категории' });
		}
	}
}

module.exports = new CatalogController();
