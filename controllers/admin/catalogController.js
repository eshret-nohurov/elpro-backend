const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class CatalogController {
	//! === Категории ===
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
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('-__v -icon -subcategories -products')
				.lean();

			// 3. Формируем ответ с метаданными пагинации
			const totalPages = Math.ceil(totalCount / limit);

			// Преобразуем name из объекта в строку (берём ru)
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

			res.status(500).json({
				error: 'Не удалось получить список категорий',
			});
		}
	}

	async getCategoryById(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим категорию по ID
			const category = await Category.findById(id).select('-__v').lean();

			// 2. Если категория не найдена
			if (!category) {
				return res.status(404).json({
					error: 'Категория не найдена',
				});
			}

			res.status(200).json({
				data: category,
			});
		} catch (error) {
			console.error('Ошибка получения категории:', error);

			// Проверяем, если ошибка связана с невалидным ID
			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID категории',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить категорию',
			});
		}
	}

	async getCategoriesForSubcategory(req, res) {
		try {
			// Получаем все категории, выбираем только нужные поля для выпадающего списка
			const categories = await Category.find({})
				.select('_id name.ru')
				.sort({ 'name.ru': 1 });

			if (!categories || categories.length === 0) {
				return res.status(404).json({
					error: 'Категории не найдены',
				});
			}

			// Форматируем данные для удобного использования в выпадающем списке
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

	async createCategory(req, res) {
		try {
			const { name, url, subcategories } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			// 1. Валидация входящих данных
			/* 	if (!file) {
				throw new Error('Иконка обязательна');
			} */

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			if (!url) {
				throw new Error('URL обязателен');
			}

			// Проверка уникальности URL
			const existingSubcategory = await Category.findOne({ url });
			if (existingSubcategory) {
				throw new Error('Категория с таким URL уже существует');
			}

			// 2. Обработка иконки
			let iconPath = '';
			if (file) {
				const { svg, png } = await processImage(file, 'categories', true);
				iconPath = svg || png;
			}

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
				icon: iconPath || '',
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
				error: errorMessage,
			});
		}
	}

	async updateCategory(req, res) {
		try {
			const { id } = req.params;
			const { name, url, subcategories } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			// 1. Находим категорию
			const category = await Category.findById(id);
			if (!category) {
				throw new Error('Категория не найдена');
			}

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			// 2. Обработка иконки (если новая передана)
			let iconPath = category.icon;
			if (file) {
				// Удаляем старые иконки
				deleteImage(category.icon);

				const { svg, png } = await processImage(file, 'categories', true);
				iconPath = svg || png;
			}

			// 3. Подготовка подкатегорий (если переданы)
			let subcategoriesIds = category.subcategories;
			if (subcategories && Array.isArray(subcategories)) {
				const existingSubcats = await Subcategory.find({
					_id: { $in: subcategories },
				});

				if (existingSubcats.length !== subcategories.length) {
					throw new Error('Некоторые подкатегории не найдены');
				}

				subcategoriesIds = subcategories;
			}

			// 4. Обновляем данные категории
			const updateData = {
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url,
				icon: iconPath,
				subcategories: subcategoriesIds,
			};

			// 5. Удаляем ссылку на категорию из старых подкатегорий
			if (category.subcategories.length > 0) {
				await Subcategory.updateMany(
					{ _id: { $in: category.subcategories } },
					{ $unset: { category: '' } }
				);
			}

			// 6. Обновляем категорию
			const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
				new: true,
				validate: true,
			});

			// 7. Добавляем ссылку на категорию в новые подкатегории
			if (subcategoriesIds.length > 0) {
				await Subcategory.updateMany(
					{ _id: { $in: subcategoriesIds } },
					{ $set: { category: id } }
				);
			}

			res.status(200).json({
				data: updatedCategory,
				message: 'Категория успешно обновлена',
			});
		} catch (error) {
			console.error('Ошибка обновления категории:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
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
			const updateResult = await Subcategory.updateMany(
				{ category: id },
				{ $set: { category: null } }
			);

			// 4. Формируем ответ
			res.status(200).json({
				data: {
					deletedCategory: category,
					updatedSubcategoriesCount: updateResult.modifiedCount,
				},
				message: 'Категория удалена. Связи с подкатегориями обновлены.',
			});
		} catch (error) {
			console.error('Ошибка удаления категории:', error);

			const statusCode = error.message === 'Категория не найдена' ? 404 : 500;

			res.status(statusCode).json({
				error: error.message,
				message: 'Не удалось удалить категорию',
			});
		}
	}

	//! === Подкатегории ===
	async getSubCategories(req, res) {
		try {
			// Параметры пагинации из запроса
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			// 1. Получаем общее количество подкатегорий
			const totalCount = await Subcategory.countDocuments();

			// 2. Получаем подкатегории с пагинацией
			const subcategories = await Subcategory.find()
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('-__v -icon -category -products')
				.lean();

			// 3. Формируем ответ с метаданными пагинации
			const totalPages = Math.ceil(totalCount / limit);

			// Преобразуем name из объекта в строку (берём ru)
			const subcategoriesTransformed = subcategories.map(cat => ({
				...cat,
				name: cat.name && cat.name.ru ? cat.name.ru : '',
			}));

			res.status(200).json({
				data: subcategoriesTransformed,
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
			console.error('Ошибка получения подкатегорий:', error);

			res.status(500).json({
				error: 'Не удалось получить список подкатегорий',
			});
		}
	}

	async getSubCategoryById(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим подкатегорию по ID
			const subcategory = await Subcategory.findById(id).select('-__v').lean();

			// 2. Если подкатегория не найдена
			if (!subcategory) {
				return res.status(404).json({
					error: 'Подкатегория не найдена',
				});
			}

			res.status(200).json({
				data: subcategory,
			});
		} catch (error) {
			console.error('Ошибка получения подкатегории:', error);

			// Проверяем, если ошибка связана с невалидным ID
			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID подкатегории',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить подкатегорию',
			});
		}
	}

	async createSubcategory(req, res) {
		try {
			const { name, url, category } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			// 1. Валидация входящих данных
			/* if (!file) {
				throw new Error('Иконка обязательна');
			} */

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			if (!url) {
				throw new Error('URL обязателен');
			}

			if (!category) {
				throw new Error('Категория обязательна');
			}

			// 2. Проверка существования категории
			const existingCategory = await Category.findById(category);
			if (!existingCategory) {
				throw new Error('Категория не найдена');
			}

			// 3. Проверка уникальности URL
			const existingSubcategory = await Subcategory.findOne({ url });
			if (existingSubcategory) {
				throw new Error('Подкатегория с таким URL уже существует');
			}

			// 4. Обработка иконки
			const iconPath = '';
			if (file) {
				const { svg, png } = await processImage(file, 'subcategories', true);
				iconPath = svg || png;
			}

			// 5. Создание подкатегории
			const subcategory = new Subcategory({
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url,
				icon: iconPath || '',
				category: existingCategory._id,
			});

			// 6. Валидация и сохранение
			await subcategory.validate();
			await subcategory.save();

			// Post-save hook автоматически добавит подкатегорию в массив subcategories категории
			res.status(201).json({
				data: subcategory,
				message: 'Подкатегория успешно создана',
			});
		} catch (error) {
			console.error('Ошибка создания подкатегории:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				error: errorMessage,
			});
		}
	}

	async updateSubcategory(req, res) {
		try {
			const { id } = req.params;
			const { name, url, category } = req.body;
			const parsedName = JSON.parse(name);
			const file = req.file;

			// 1. Находим подкатегорию
			const subcategory = await Subcategory.findById(id);
			if (!subcategory) {
				throw new Error('Подкатегория не найдена');
			}

			if (!parsedName.ru) {
				throw new Error('Русское название обязательно');
			}

			// 2. Обработка иконки
			let iconPath = subcategory.icon;
			if (file) {
				if (subcategory.icon) {
					await deleteImage(subcategory.icon);
				}
				const { svg, png } = await processImage(file, 'subcategories', true);
				iconPath = svg || png;
			}

			// 3. Проверка и обработка категории
			let newCategoryId = subcategory.category;
			if (category) {
				// Проверяем, что новая категория существует
				const existingCategory = await Category.findById(category);
				if (!existingCategory) {
					throw new Error('Новая категория не найдена');
				}
				newCategoryId = existingCategory._id;
			}

			// 4. Подготовка данных для обновления
			const updateData = {
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				url: url || subcategory.url,
				icon: iconPath,
				category: newCategoryId,
			};

			// 5. Сохраняем старую категорию для сравнения
			const oldCategoryId = subcategory.category;

			// 6. Обновляем подкатегорию
			const updatedSubcategory = await Subcategory.findByIdAndUpdate(
				id,
				updateData,
				{ new: true, runValidators: true }
			);

			// 7. Обновляем связи между категориями если изменилась категория
			if (category && newCategoryId.toString() !== oldCategoryId.toString()) {
				// Удаляем из старой категории
				await Category.findByIdAndUpdate(oldCategoryId, {
					$pull: { subcategories: id },
				});

				// Добавляем в новую категорию
				await Category.findByIdAndUpdate(newCategoryId, {
					$addToSet: { subcategories: id },
				});
			}

			res.status(200).json({
				data: updatedSubcategory,
				message: 'Подкатегория успешно обновлена',
			});
		} catch (error) {
			console.error('Ошибка обновления подкатегории:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				error: errorMessage,
				message: 'Не удалось обновить подкатегорию',
			});
		}
	}

	async deleteSubcategory(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим подкатегорию
			const subcategory = await Subcategory.findById(id);
			if (!subcategory) {
				throw new Error('Подкатегория не найдена');
			}

			// 2. Сохраняем ID категории для обновления
			const categoryId = subcategory.category;

			// 3. Удаляем связанное изображение (если есть)
			if (subcategory.icon) {
				await deleteImage(subcategory.icon);
			}

			// 4. Удаляем подкатегорию (вызываем deleteOne() для документа)
			await subcategory.deleteOne();

			res.status(200).json({
				data: {
					deletedSubcategory: subcategory,
					updatedCategoryId: categoryId,
				},
				message: 'Подкатегория успешно удалена',
			});
		} catch (error) {
			console.error('Ошибка удаления подкатегории:', error);

			const statusCode =
				error.message === 'Подкатегория не найдена' ? 404 : 500;

			res.status(statusCode).json({
				error: error.message,
				message: 'Не удалось удалить подкатегорию',
			});
		}
	}
}

module.exports = new CatalogController();
