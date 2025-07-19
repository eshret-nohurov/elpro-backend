const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Subcategory = require('../../models/Subcategory');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class ProductController {
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
				subcategories,

				// specifications,
			} = req.body;

			const files = req.files; // Ожидаем массив файлов

			// 1. Парсинг сложных JSON-полей
			const parsedName = JSON.parse(name);
			const parsedShortDesc = JSON.parse(shortDescription);
			const parsedFullDesc = JSON.parse(fullDescription);
			// const parsedSpecs = JSON.parse(specifications);

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
			const [
				existingCategories,
				existingSubcategories,
				existingRelatedProducts,
			] = await Promise.all([
				Category.find({ _id: { $in: JSON.parse(categories) } }),
				subcategories
					? Subcategory.find({ _id: { $in: JSON.parse(subcategories) } })
					: Promise.resolve([]),
				relatedProducts
					? Product.find({ _id: { $in: JSON.parse(relatedProducts) } })
					: Promise.resolve([]),
			]);

			if (existingCategories.length !== JSON.parse(categories).length) {
				throw new Error('Некоторые категории не найдены');
			}

			if (
				subcategories &&
				existingSubcategories.length !== JSON.parse(subcategories).length
			) {
				throw new Error('Некоторые подкатегории не найдены');
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
				// specifications: parsedSpecs.map(spec => ({
				// 	type: {
				// 		ru: spec.type.ru,
				// 		tm: spec.type.tm || spec.type.ru,
				// 		en: spec.type.en || spec.type.ru,
				// 	},
				// 	value: {
				// 		ru: spec.value.ru,
				// 		tm: spec.value.tm || spec.value.ru,
				// 		en: spec.value.en || spec.value.ru,
				// 	},
				// })),
				relatedProducts: relatedProducts ? JSON.parse(relatedProducts) : [],
				categories: JSON.parse(categories),
				subcategories: subcategories ? JSON.parse(subcategories) : [],
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

	// ===========
	async getSubcategoriesByCategories(req, res) {
		try {
			const { categories } = req.body; // Получаем массив ID категорий

			// 1. Валидация
			if (!Array.isArray(categories)) {
				return res
					.status(400)
					.json({ error: 'Параметр categories должен быть массивом' });
			}

			// 2. Проверка существования категорий
			const existingCategories = await Category.find({
				_id: { $in: categories },
			});

			if (existingCategories.length !== categories.length) {
				const missingIds = categories.filter(
					id => !existingCategories.some(c => c._id.equals(id))
				);
				return res.status(404).json({
					error: 'Некоторые категории не найдены',
					missingIds,
				});
			}

			// 3. Получаем ВСЕ подкатегории для этих категорий
			const allSubcategories = await Subcategory.find({
				category: { $in: categories },
			}).lean();

			// 4. Форматируем результат
			const result = allSubcategories.map(subcat => ({
				id: subcat._id,
				name: subcat.name.ru,
			}));

			res.json({
				success: true,
				count: result.length,
				subcategories: result,
			});
		} catch (error) {
			console.error('Ошибка получения подкатегорий:', error);
			res.status(500).json({
				error: 'Внутренняя ошибка сервера',
				details: error.message,
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
				success: true,
				count: results.length,
				results,
			});
		} catch (error) {
			console.error('Ошибка поиска товаров:', error);
			res.status(500).json({
				success: false,
				error: 'Внутренняя ошибка сервера',
				details: error.message,
			});
		}
	}
}

module.exports = new ProductController();
