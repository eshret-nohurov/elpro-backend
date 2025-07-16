const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class CatalogController {
	// === Категории ===
	async getCategories(req, res) {
		try {
			// Параметры пагинации из запроса
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			// 1. Получаем общее количество категорий
			const totalCount = await Category.countDocuments();

			// 2. Получаем категории с пагинацией
			const categories = await Category.find()
				.skip(skip)
				.limit(limit)
				.select('-__v -icon -subcategories')
				.lean();

			// 3. Формируем ответ с метаданными пагинации
			const totalPages = Math.ceil(totalCount / limit);

			// Преобразуем name из объекта в строку (берём ru)
			const categoriesTransformed = categories.map(cat => ({
				...cat,
				name: cat.name && cat.name.ru ? cat.name.ru : '',
			}));

			res.status(200).json({
				success: true,
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

			res.status(500).json({
				success: false,
				error: 'Не удалось получить список категорий',
			});
		}
	}

	async createCategory(req, res) {
		try {
			const { name, url, subcategories } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			// 1. Валидация входящих данных
			if (!file) {
				throw new Error('Иконка обязательна');
			}

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			// 2. Обработка иконки
			const { svg, png } = await processImage(file, 'categories', true);
			const iconPath = svg || png;

			// 3. Подготовка подкатегорий
			let subcategoriesIds = [];
			if (subcategories && Array.isArray(subcategories)) {
				const existingSubcats = await Subcategory.find({
					_id: { $in: subcategories },
				});

				if (existingSubcats.length !== subcategories.length) {
					throw new Error('Некоторые подкатегории не найдены');
				}

				subcategoriesIds = subcategories;
			}

			// 4. Создание категории
			const category = new Category({
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url,
				icon: iconPath,
				subcategories: subcategoriesIds,
			});

			// 5. Валидация и сохранение
			await category.validate();
			await category.save();

			// 6. Обновляем подкатегории (добавляем ссылку на категорию)
			if (subcategoriesIds.length > 0) {
				await Subcategory.updateMany(
					{ _id: { $in: subcategoriesIds } },
					{ $set: { category: category._id } }
				);
			}

			res.status(201).json({
				success: true,
				data: category,
				message: 'Категория успешно создана',
			});
		} catch (error) {
			console.error('Ошибка создания категории:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				success: false,
				error: errorMessage,
			});
		}
	}

	async deleteCategory(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим и удаляем категорию
			const category = await Category.findByIdAndDelete(id);
			if (!category) {
				throw new Error('Категория не найдена');
			}

			// 2. Удаляем связанные изображения (если есть)
			if (category.icon) {
				await deleteImage(category.icon);
			}

			// 3. Убираем удаляемую категорию из массива `category` у подкатегорий
			/* const updateResult = await Subcategory.updateMany(
				{ category: id }, // Ищем подкатегории, где есть эта категория
				{ $pull: { category: id } } // Удаляем ID категории из массива
			); */

			// 4. Формируем ответ
			res.status(200).json({
				success: true,
				data: {
					deletedCategory: category,
					// updatedSubcategoriesCount: updateResult.modifiedCount,
				},
				message: 'Категория удалена. Связи с подкатегориями обновлены.',
			});
		} catch (error) {
			console.error('Ошибка удаления категории:', error);

			const statusCode = error.message === 'Категория не найдена' ? 404 : 500;

			res.status(statusCode).json({
				success: false,
				error: error.message,
				message: 'Не удалось удалить категорию',
			});
		}
	}

	// ! =====================================================================

	async updateCategory(req, res) {
		try {
			const { id } = req.params;
			const { name, url } = req.body;
			const file = req.file;

			const category = await Category.findById(id);
			if (!category) throw new Error('Категория не найдена');

			const updateData = { name, url };

			if (file) {
				// Удаляем старые иконки
				deleteImage(category.icon);
				deleteImage(category.iconPng);

				// Обрабатываем новую иконку
				const { svg, png } = await processImage(file, 'categories', true);
				updateData.icon = svg;
				updateData.iconPng = png;
			}

			const updated = await Category.findByIdAndUpdate(id, updateData, {
				new: true,
			});
			res.json(updated);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	// === Подкатегории ===
	async createSubcategory(req, res) {
		try {
			const { name, url, category } = req.body;
			const file = req.file;

			if (!file) throw new Error('Иконка обязательна');

			// Проверяем существование категории
			const parentCategory = await Category.findById(category);
			if (!parentCategory) throw new Error('Категория не найдена');

			// Обрабатываем иконку
			const { svg, png } = await processImage(file, 'subcategories', true);

			const subcategory = new Subcategory({
				name,
				url,
				icon: svg,
				iconPng: png,
				category,
			});
			await subcategory.save();

			res.status(201).json(subcategory);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	// ... (аналогичные методы для update/delete/get Subcategory)
}

module.exports = new CatalogController();
