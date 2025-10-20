const Product = require('../../models/Product');
const Category = require('../../models/Category');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class ProductController {
	async getProducts(req, res) {
		try {
			// Параметры пагинации из запроса
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			// 1. Получаем общее количество
			const totalCount = await Product.countDocuments();

			// 2. Получаем категории с пагинацией
			const products = await Product.find()
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select(
					'-__v -price -stock -shortDescription -images -fullDescription -specifications -relatedProducts -categories'
				)
				.lean();

			// 3. Формируем ответ с метаданными пагинации
			const totalPages = Math.ceil(totalCount / limit);

			// Преобразуем name из объекта в строку (берём ru)
			const productsTransformed = products.map(cat => ({
				...cat,
				name: cat.name && cat.name.ru ? cat.name.ru : '',
			}));

			res.status(200).json({
				data: productsTransformed,
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
				error: 'Не удалось получить список продуктов!',
			});
		}
	}

	async getProductById(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим продукт по ID
			const product = await Product.findById(id)
				.select('-__v')
				.populate({
					path: 'relatedProducts',
					select: '_id name.ru',
					options: { limit: 4 },
				})
				.lean();

			// 2. Если продукт не найдена
			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найдена',
				});
			}

			// 3. Преобразуем relatedProducts в нужный формат
			if (product.relatedProducts && product.relatedProducts.length > 0) {
				product.relatedProducts = product.relatedProducts.map(item => ({
					id: item._id,
					name: item.name?.ru || 'Без названия',
				}));
			}

			res.status(200).json({
				data: product,
			});
		} catch (error) {
			console.error('Ошибка получения продукта:', error);

			// Проверяем, если ошибка связана с невалидным ID
			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID категории',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить продукт',
			});
		}
	}

	async createProduct(req, res) {
		try {
			const {
				name,
				price,
				stock,
				shortDescription,
				fullDescription,
				relatedProducts,
				categories,
				specifications,
			} = req.body;

			const files = req.files;

			// 1. Парсинг сложных JSON-полей
			const parsedName = JSON.parse(name);
			const parsedShortDesc = JSON.parse(shortDescription);
			const parsedFullDesc = JSON.parse(fullDescription);

			// Обработка характеристик
			let parsedSpecs = [];
			if (specifications) {
				try {
					parsedSpecs = JSON.parse(specifications)
						.filter(spec => spec?.type?.ru && spec?.value?.ru)
						.map(spec => ({
							type: {
								ru: spec.type.ru.trim(),
								tm: spec.type.tm?.trim() || spec.type.ru.trim(),
								en: spec.type.en?.trim() || spec.type.ru.trim(),
							},
							value: {
								ru: spec.value.ru.trim(),
								tm: spec.value.tm?.trim() || spec.value.ru.trim(),
								en: spec.value.en?.trim() || spec.value.ru.trim(),
							},
						}));
				} catch (e) {
					console.error('Invalid JSON in specifications', e);
				}
			}

			// 2. Валидация обязательных полей
			if (!parsedName.ru) throw new Error('Русское название обязательно');
			if (!price) throw new Error('Цена обязательна');
			if (!parsedShortDesc.ru) throw new Error('Краткое описание обязательно');
			if (!parsedFullDesc.ru) throw new Error('Полное описание обязательно');
			if (!files || files.length === 0)
				throw new Error('Хотя бы одно изображение обязательно');
			if (files.length > 4) throw new Error('Максимум 4 изображения');
			if (!categories || categories.length === 0)
				throw new Error('Хотя бы одна категория обязательна');

			// 3. Проверка существования связанных сущностей
			const [existingCategories, existingRelatedProducts] = await Promise.all([
				Category.find({ _id: { $in: JSON.parse(categories) } }),
				relatedProducts
					? Product.find({ _id: { $in: JSON.parse(relatedProducts) } })
					: Promise.resolve([]),
			]);

			if (existingCategories.length !== JSON.parse(categories).length) {
				throw new Error('Некоторые категории не найдены');
			}

			if (
				relatedProducts &&
				existingRelatedProducts.length !== JSON.parse(relatedProducts).length
			) {
				throw new Error('Некоторые связанные товары не найдены');
			}

			// 4. Обработка изображений
			const imageProcessingPromises = files.map(file =>
				processImage(file, 'products', false)
			);
			const processedImages = await Promise.all(imageProcessingPromises);
			const imagePaths = processedImages.map(img => img.webp);

			// 5. Создание товара
			const product = new Product({
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				price: Number(price),
				stock: stock ? Number(stock) : 0,
				shortDescription: {
					ru: parsedShortDesc.ru,
					tm: parsedShortDesc.tm || parsedShortDesc.ru,
					en: parsedShortDesc.en || parsedShortDesc.ru,
				},
				fullDescription: {
					ru: parsedFullDesc.ru,
					tm: parsedFullDesc.tm || parsedFullDesc.ru,
					en: parsedFullDesc.en || parsedFullDesc.ru,
				},
				images: imagePaths,
				specifications: parsedSpecs.map(spec => ({
					type: {
						ru: spec.type.ru,
						tm: spec.type.tm,
						en: spec.type.en,
					},
					value: {
						ru: spec.value.ru,
						tm: spec.value.tm,
						en: spec.value.en,
					},
				})),
				relatedProducts: relatedProducts ? JSON.parse(relatedProducts) : [],
				categories: JSON.parse(categories),
			});

			// 6. Валидация и сохранение
			await product.validate();
			await product.save();

			// 7. Ответ
			res.status(201).json({
				data: product,
				message: 'Товар успешно создан',
			});
		} catch (error) {
			console.error('Ошибка создания товара:', error);

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

	async updateProduct(req, res) {
		try {
			const { id } = req.params;
			const {
				name,
				price,
				stock,
				shortDescription,
				fullDescription,
				relatedProducts,
				categories,
				specifications,
			} = req.body;

			const files = req.files;

			// 1. Находим продукт
			const product = await Product.findById(id);
			if (!product) {
				throw new Error('Товар не найден');
			}

			// 2. Парсинг сложных JSON-полей (если они переданы)
			const parsedName = name ? JSON.parse(name) : product.name;
			const parsedShortDesc = shortDescription
				? JSON.parse(shortDescription)
				: product.shortDescription;
			const parsedFullDesc = fullDescription
				? JSON.parse(fullDescription)
				: product.fullDescription;

			// 3. Валидация обязательных полей
			if (name && !parsedName.ru)
				throw new Error('Русское название обязательно');
			if (shortDescription && !parsedShortDesc.ru)
				throw new Error('Краткое описание обязательно');
			if (fullDescription && !parsedFullDesc.ru)
				throw new Error('Полное описание обязательно');
			if (price && isNaN(Number(price)))
				throw new Error('Цена должна быть числом');
			if (stock && isNaN(Number(stock)))
				throw new Error('Количество на складе должно быть числом');

			// 4. Обработка изображений
			let imagePaths = [];

			// Если пришли новые файлы - удаляем все старые изображения
			if (files && files.length > 0) {
				// Удаляем все старые изображения с сервера
				await Promise.all(product.images.map(img => deleteImage(img)));

				// Обрабатываем новые изображения
				const imageProcessingPromises = files.map(file =>
					processImage(file, 'products', false)
				);
				const processedImages = await Promise.all(imageProcessingPromises);
				imagePaths = processedImages.map(img => img.webp);
			} else {
				// Если новые файлы не пришли - оставляем старые изображения
				imagePaths = [...product.images];
			}

			// Проверка общего количества изображений
			if (imagePaths.length > 4) throw new Error('Максимум 4 изображения');
			if (imagePaths.length === 0)
				throw new Error('Должно быть хотя бы одно изображение');

			// 5. Обработка характеристик
			let parsedSpecs = product.specifications;
			if (specifications) {
				try {
					parsedSpecs = JSON.parse(specifications)
						.filter(spec => spec?.type?.ru && spec?.value?.ru)
						.map(spec => ({
							type: {
								ru: spec.type.ru.trim(),
								tm: spec.type.tm?.trim() || spec.type.ru.trim(),
								en: spec.type.en?.trim() || spec.type.ru.trim(),
							},
							value: {
								ru: spec.value.ru.trim(),
								tm: spec.value.tm?.trim() || spec.value.ru.trim(),
								en: spec.value.en?.trim() || spec.value.ru.trim(),
							},
						}));
				} catch (e) {
					console.error('Invalid JSON in specifications', e);
					throw new Error('Неверный формат характеристик');
				}
			}

			// 6. Подготовка связанных продуктов и категорий
			let relatedProductsIds = product.relatedProducts;
			let categoriesIds = product.categories;

			if (relatedProducts) {
				const parsedRelated = JSON.parse(relatedProducts);
				const existingRelated = await Product.find({
					_id: { $in: parsedRelated },
				});

				if (existingRelated.length !== parsedRelated.length) {
					throw new Error('Некоторые связанные товары не найдены');
				}

				if (parsedRelated.length > 4) {
					throw new Error('Максимум 4 связанных товара');
				}

				relatedProductsIds = parsedRelated;
			}

			if (categories) {
				const parsedCategories = JSON.parse(categories);
				const existingCategories = await Category.find({
					_id: { $in: parsedCategories },
				});

				if (existingCategories.length !== parsedCategories.length) {
					throw new Error('Некоторые категории не найдены');
				}

				if (parsedCategories.length === 0) {
					throw new Error('Должна быть указана минимум 1 категория');
				}

				categoriesIds = parsedCategories;
			}

			// 7. Подготовка данных для обновления
			const updateData = {
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				price: price ? Number(price) : product.price,
				stock: stock ? Number(stock) : product.stock,
				shortDescription: {
					ru: parsedShortDesc.ru,
					tm: parsedShortDesc.tm || parsedShortDesc.ru,
					en: parsedShortDesc.en || parsedShortDesc.ru,
				},
				fullDescription: {
					ru: parsedFullDesc.ru,
					tm: parsedFullDesc.tm || parsedFullDesc.ru,
					en: parsedFullDesc.en || parsedFullDesc.ru,
				},
				images: imagePaths,
				specifications: parsedSpecs,
				relatedProducts: relatedProductsIds,
				categories: categoriesIds,
			};

			// 8. Обновляем продукт
			const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
				new: true,
				runValidators: true,
			});

			// 9. Обновляем связи с категориями
			// Удаляем продукт из старых категорий, которые больше не связаны
			const oldCategories = product.categories.filter(
				catId => !categoriesIds.includes(catId.toString())
			);
			if (oldCategories.length > 0) {
				await Category.updateMany(
					{ _id: { $in: oldCategories } },
					{ $pull: { products: id } }
				);
			}

			// Добавляем продукт в новые категории
			const newCategories = categoriesIds.filter(
				catId => !product.categories.includes(catId.toString())
			);
			if (newCategories.length > 0) {
				await Category.updateMany(
					{ _id: { $in: newCategories } },
					{ $addToSet: { products: id } }
				);
			}

			res.status(200).json({
				data: updatedProduct,
				message: 'Товар успешно обновлен',
			});
		} catch (error) {
			console.error('Ошибка обновления товара:', error);

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

	async deleteProduct(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим продукт
			const product = await Product.findById(id);
			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найден',
				});
			}

			// 2. Удаляем изображения продукта
			const deletePromises = product.images.map(image => deleteImage(image));
			await Promise.all(deletePromises);

			// 3. Удаляем сам продукт
			// Используем deleteOne для активации post-хука в модели
			await product.deleteOne();

			res.status(200).json({
				message: 'Продукт успешно удален',
				deletedId: id,
			});
		} catch (error) {
			console.error('Ошибка удаления продукта:', error);

			res.status(500).json({
				error: 'Не удалось удалить продукт',
				details: error.message,
			});
		}
	}

	// ===========
	async getCategoriesForProductForm(req, res) {
		try {
			// Получаем все категории в виде плоского списка
			const categories = await Category.find().select('name parent').lean();

			// Можно добавить логику для построения дерева на фронте,
			// или отдать как есть, если на фронте используется плоский список с отступами
			const formattedCategories = categories.map(cat => ({
				id: cat._id,
				name: cat.name.ru, // Предполагаем, что в админке используется русский
				parent: cat.parent,
			}));

			res.status(200).json({
				data: formattedCategories,
			});
		} catch (error) {
			console.error('Ошибка получения категорий для формы:', error);
			res.status(500).json({
				error: 'Не удалось получить список категорий',
			});
		}
	}

	async searchProducts(req, res) {
		try {
			const { query } = req.query; // Получаем строку поиска из query-параметров

			// 1. Валидация
			if (!query || typeof query !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Параметр query обязателен и должен быть строкой',
				});
			}

			// 2. Поиск по названию (регистронезависимый)
			const products = await Product.find({
				$or: [
					{ 'name.ru': { $regex: query, $options: 'i' } }, // Русское название
					{ 'name.en': { $regex: query, $options: 'i' } }, // Английское название
					{ 'name.tm': { $regex: query, $options: 'i' } }, // Туркменское название
				],
			})
				.limit(20) // Ограничиваем количество результатов
				.select('name') // Выбираем только нужные поля
				.lean();

			// 3. Форматирование результата
			const results = products.map(product => ({
				id: product._id,
				name: product.name.ru,
			}));

			res.json({
				count: results.length,
				results,
			});
		} catch (error) {
			console.error('Ошибка поиска товаров:', error);
			res.status(500).json({
				error: 'Внутренняя ошибка сервера',
				details: error.message,
			});
		}
	}
}

module.exports = new ProductController();
