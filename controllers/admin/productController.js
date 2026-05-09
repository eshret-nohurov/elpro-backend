/*
 * Product Admin
 * Создает, редактирует, фильтрует и удаляет товары вместе с изображениями, скидками и категориями.
 */
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const { logAction } = require('../../utils/auditLogger');
const { processImage, deleteImage } = require('../../utils/imageHandler');
const { applyProductPricing } = require('../../utils/pricing');

const normalizeDiscount = ({ discountPrice, discountExpiresAt, price }) => {
	const isPriceEmpty =
		discountPrice === undefined || discountPrice === null || discountPrice === '';
	const isDateEmpty =
		discountExpiresAt === undefined ||
		discountExpiresAt === null ||
		discountExpiresAt === '';

	if (isPriceEmpty) {
		return {
			discountPrice: null,
			discountExpiresAt: null,
		};
	}

	const parsedDiscountPrice = Number(discountPrice);
	const parsedExpiresAt = isDateEmpty ? null : new Date(discountExpiresAt);

	if (
		!Number.isFinite(parsedDiscountPrice) ||
		parsedDiscountPrice <= 0 ||
		parsedDiscountPrice >= 100
	) {
		throw new Error('Скидка должна быть процентом от 1 до 99');
	}

	if (parsedExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
		throw new Error('Укажите корректную дату окончания скидки');
	}

	return {
		discountPrice: parsedDiscountPrice,
		discountExpiresAt: parsedExpiresAt,
	};
};

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class ProductController {
	async getProducts(req, res) {
		try {
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;
			const {
				search = '',
				discount = '',
				category = '',
				stock = '',
			} = req.query;
			const now = new Date();
			const filter = {};

			if (search) {
				const safeSearch = escapeRegex(search);
				filter.$or = [
					{ 'name.ru': { $regex: safeSearch, $options: 'i' } },
					{ 'name.en': { $regex: safeSearch, $options: 'i' } },
					{ 'name.tm': { $regex: safeSearch, $options: 'i' } },
				];
			}

			if (category) {
				filter.categories = category;
			}

			if (discount === 'active') {
				filter.discountPrice = { $gt: 0 };
				filter.$and = [
					...(filter.$and || []),
					{
						$or: [
							{ discountExpiresAt: null },
							{ discountExpiresAt: { $exists: false } },
							{ discountExpiresAt: { $gte: now } },
						],
					},
				];
			}

			if (discount === 'expired') {
				filter.discountPrice = { $gt: 0 };
				filter.discountExpiresAt = { $lt: now };
			}

			if (discount === 'none') {
				filter.$and = [
					...(filter.$and || []),
					{
						$or: [
							{ discountPrice: null },
							{ discountPrice: { $exists: false } },
							{ discountPrice: { $lte: 0 } },
						],
					},
				];
			}

			if (stock === 'inStock') {
				filter.stock = { $gt: 0 };
			}

			if (stock === 'outOfStock') {
				filter.stock = { $lte: 0 };
			}

			if (stock === 'lowStock') {
				filter.stock = { $gt: 0, $lte: 5 };
			}

			const totalCount = await Product.countDocuments(filter);

			const products = await Product.find(filter)
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('name price stock discountPrice discountExpiresAt categories createdAt')
				.populate('categories', 'name url')
				.lean();

			const totalPages = Math.ceil(totalCount / limit);

			const productsTransformed = products.map(product => {
				const rawDiscountExpiresAt = product.discountExpiresAt;
				const rawDiscountPrice = product.discountPrice;
				applyProductPricing(product, 1);

				return {
					...product,
					name: product.name && product.name.ru ? product.name.ru : '',
					discountPrice: rawDiscountPrice,
					discountExpiresAt: rawDiscountExpiresAt,
					categories: (product.categories || []).map(category => ({
						_id: category._id,
						name: category.name?.ru || '',
						url: category.url,
					})),
				};
			});

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


			const product = await Product.findById(id)
				.select('-__v')
				.populate({
					path: 'relatedProducts',
					select: '_id name.ru',
					options: { limit: 4 },
				})
				.lean();


			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найдена',
				});
			}


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
				discountPrice,
				discountExpiresAt,
				shortDescription,
				fullDescription,
				relatedProducts,
				categories,
				specifications,
			} = req.body;

			const files = req.files;


			const parsedName = JSON.parse(name);
			const parsedShortDesc = JSON.parse(shortDescription);
			const parsedFullDesc = JSON.parse(fullDescription);


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


			if (!parsedName.ru) throw new Error('Русское название обязательно');
			if (!price) throw new Error('Цена обязательна');
			if (!parsedShortDesc.ru) throw new Error('Краткое описание обязательно');
			if (!parsedFullDesc.ru) throw new Error('Полное описание обязательно');
			if (!files || files.length === 0)
				throw new Error('Хотя бы одно изображение обязательно');
			if (files.length > 4) throw new Error('Максимум 4 изображения');
			if (!categories || categories.length === 0)
				throw new Error('Хотя бы одна категория обязательна');

			const discountData = normalizeDiscount({
				discountPrice,
				discountExpiresAt,
				price,
			});


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


			const imageProcessingPromises = files.map(file =>
				processImage(file, 'products', false)
			);
			const processedImages = await Promise.all(imageProcessingPromises);
			const imagePaths = processedImages.map(img => img.webp);


			const product = new Product({
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				price: Number(price),
				...discountData,
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


			await product.validate();
			await product.save();

			await logAction({
				req,
				action: 'create',
				entity: 'product',
				entityId: product._id,
				entityName: product.name.ru,
				description: `Создал товар ${product.name.ru}`,
				meta: { price: product.price, stock: product.stock },
			});


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
				discountPrice,
				discountExpiresAt,
				shortDescription,
				fullDescription,
				relatedProducts,
				categories,
				specifications,
			} = req.body;

			const files = req.files;


			const product = await Product.findById(id);
			if (!product) {
				throw new Error('Товар не найден');
			}


			const parsedName = name ? JSON.parse(name) : product.name;
			const parsedShortDesc = shortDescription
				? JSON.parse(shortDescription)
				: product.shortDescription;
			const parsedFullDesc = fullDescription
				? JSON.parse(fullDescription)
				: product.fullDescription;


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

			const finalPrice = price ? Number(price) : product.price;
			const discountData = normalizeDiscount({
				discountPrice:
					discountPrice !== undefined ? discountPrice : product.discountPrice,
				discountExpiresAt:
					discountExpiresAt !== undefined
						? discountExpiresAt
						: product.discountExpiresAt,
				price: finalPrice,
			});


			let imagePaths = [];


			if (files && files.length > 0) {

				await Promise.all(product.images.map(img => deleteImage(img)));


				const imageProcessingPromises = files.map(file =>
					processImage(file, 'products', false)
				);
				const processedImages = await Promise.all(imageProcessingPromises);
				imagePaths = processedImages.map(img => img.webp);
			} else {

				imagePaths = [...product.images];
			}


			if (imagePaths.length > 4) throw new Error('Максимум 4 изображения');
			if (imagePaths.length === 0)
				throw new Error('Должно быть хотя бы одно изображение');


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


			const updateData = {
				name: {
					ru: parsedName.ru,
					tm: parsedName.tm || parsedName.ru,
					en: parsedName.en || parsedName.ru,
				},
				price: finalPrice,
				...discountData,
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


			const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
				new: true,
				runValidators: true,
			});

			await logAction({
				req,
				action: 'update',
				entity: 'product',
				entityId: updatedProduct._id,
				entityName: updatedProduct.name.ru,
				description: `Редактировал товар ${updatedProduct.name.ru}`,
				meta: {
					oldName: product.name?.ru,
					newName: updatedProduct.name?.ru,
					oldPrice: product.price,
					newPrice: updatedProduct.price,
					oldStock: product.stock,
					newStock: updatedProduct.stock,
					oldDiscountPrice: product.discountPrice,
					newDiscountPrice: updatedProduct.discountPrice,
					oldDiscountExpiresAt: product.discountExpiresAt,
					newDiscountExpiresAt: updatedProduct.discountExpiresAt,
				},
			});


			const oldCategories = product.categories.filter(
				catId => !categoriesIds.includes(catId.toString())
			);
			if (oldCategories.length > 0) {
				await Category.updateMany(
					{ _id: { $in: oldCategories } },
					{ $pull: { products: id } }
				);
			}


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


			const product = await Product.findById(id);
			if (!product) {
				return res.status(404).json({
					error: 'Продукт не найден',
				});
			}


			const deletePromises = product.images.map(image => deleteImage(image));
			await Promise.all(deletePromises);


			await product.deleteOne();

			await logAction({
				req,
				action: 'delete',
				entity: 'product',
				entityId: id,
				entityName: product.name?.ru || '',
				description: `Удалил товар ${product.name?.ru || id}`,
			});

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


	async getCategoriesForProductForm(req, res) {
		try {

			const categories = await Category.find().select('name parent').lean();


			const formattedCategories = categories.map(cat => ({
				id: cat._id,
				name: cat.name.ru,
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
			const { query } = req.query;


			if (!query || typeof query !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Параметр query обязателен и должен быть строкой',
				});
			}


			const products = await Product.find({
				$or: [
					{ 'name.ru': { $regex: query, $options: 'i' } },
					{ 'name.en': { $regex: query, $options: 'i' } },
					{ 'name.tm': { $regex: query, $options: 'i' } },
				],
			})
				.limit(20)
				.select('name price stock discountPrice discountExpiresAt')
				.lean();


			const results = products.map(product => {
				applyProductPricing(product, 1);

				return {
					id: product._id,
					name: product.name.ru,
					price: product.price,
					originalPrice: product.originalPrice,
					hasDiscount: product.hasDiscount,
					discountPercent: product.discountPercent,
					discountExpiresAt: product.discountExpiresAt,
					stock: product.stock,
				};
			});

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
