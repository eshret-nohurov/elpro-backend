const ProductsSection = require('../../models/ProductsSection');
const Product = require('../../models/Product');

class ProductsSectionController {
	async getProductsSection(req, res) {
		try {
			const productsSection = await ProductsSection.find()
				.sort({ _id: -1 })
				.lean();

			const productsSectionTransformed = productsSection.map(cat => ({
				...cat,
				name: cat.name && cat.name.ru ? cat.name.ru : '',
			}));

			res.status(200).json({
				data: productsSectionTransformed,
			});
		} catch (error) {
			console.error('Ошибка получения секции товаров:', error);

			res.status(500).json({
				error: 'Не удалось получить секцию товаров!',
			});
		}
	}

	async getProductsSectionById(req, res) {
		try {
			const { id } = req.params;

			const productsSection = await ProductsSection.findById(id)
				.select('-__v')
				.populate({
					path: 'products',
					select: '_id name.ru',
					options: { limit: 8 },
				})
				.lean();

			if (!productsSection) {
				return res.status(404).json({
					error: 'Секция продуктов не найдена',
				});
			}

			if (productsSection.products && productsSection.products.length > 0) {
				productsSection.products = productsSection.products.map(item => ({
					id: item._id,
					name: item.name?.ru || 'Без названия',
				}));
			}

			res.status(200).json({
				data: productsSection,
			});
		} catch (error) {
			console.error('Ошибка получения секции продуктов:', error);

			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID секции продуктов',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить секцию продуктов',
			});
		}
	}

	async createProductsSection(req, res) {
		try {
			const { name, products = [], position } = req.body;

			if (!name?.ru) throw new Error('Русское название обязательно');

			if (!position) {
				throw new Error('position обязателен');
			}

			const existingProducts =
				products.length > 0
					? await Product.find({ _id: { $in: products } })
					: [];

			if (products.length > 0 && existingProducts.length !== products.length) {
				const missingIds = products.filter(
					id => !existingProducts.some(p => p._id.equals(id))
				);
				throw new Error(`Не найдены товары с ID: ${missingIds.join(', ')}`);
			}

			const productsSectionOB = new ProductsSection({
				name: {
					ru: name.ru,
					tm: name.tm || name.ru,
					en: name.en || name.ru,
				},
				products,
				position,
			});

			await productsSectionOB.validate();
			await productsSectionOB.save();

			res.status(201).json({
				data: productsSectionOB,
				message: 'Секция товаров успешно создана',
			});
		} catch (error) {
			console.error('Ошибка создания секции товаров:', error);
			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			res.status(statusCode).json({
				error: error.message,
			});
		}
	}

	async updateProductsSection(req, res) {
		try {
			const { id } = req.params;
			const { name, products = [], position } = req.body;

			const existingSection = await ProductsSection.findById(id);
			if (!existingSection) {
				throw new Error('Секция товаров не найдена');
			}

			if (name) {
				if (!name.ru) throw new Error('Русское название обязательно');

				existingSection.name = {
					ru: name.ru,
					tm: name.tm || existingSection.name.tm || name.ru,
					en: name.en || existingSection.name.en || name.ru,
				};
			}

			if (products !== undefined) {
				if (products.length > 8) {
					throw new Error('Максимум 8 товаров в секции');
				}

				if (products.length > 0) {
					const existingProducts = await Product.find({
						_id: { $in: products },
					});
					if (existingProducts.length !== products.length) {
						const missingIds = products.filter(
							id => !existingProducts.some(p => p._id.equals(id))
						);
						throw new Error(`Не найдены товары с ID: ${missingIds.join(', ')}`);
					}
				}

				existingSection.products = products;
			}

			if (position !== undefined) {
				existingSection.position = position;
			}

			await existingSection.validate();
			const updatedSection = await existingSection.save();

			res.status(200).json({
				data: updatedSection,
				message: 'Секция товаров успешно обновлена',
			});
		} catch (error) {
			console.error('Ошибка обновления секции товаров:', error);
			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			res.status(statusCode).json({
				error: error.message,
			});
		}
	}

	async deleteProductsSection(req, res) {
		try {
			const { id } = req.params;

			const productsSection = await ProductsSection.findById(id);
			if (!productsSection) {
				return res.status(404).json({
					error: 'Секция не найдена',
				});
			}

			await productsSection.deleteOne();

			res.status(200).json({
				message: 'Секция успешно удалена',
				deletedId: id,
			});
		} catch (error) {
			console.error('Ошибка удаления секции продуктов:', error);

			res.status(500).json({
				error: 'Не удалось удалить секцию продуктов',
				details: error.message,
			});
		}
	}
}

module.exports = new ProductsSectionController();
