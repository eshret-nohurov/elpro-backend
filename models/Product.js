const mongoose = require('mongoose');

const SpecSchema = new mongoose.Schema(
	{
		type: {
			ru: { type: String, required: true },
			tm: { type: String },
			en: { type: String },
		},
		value: {
			ru: { type: String, required: true },
			tm: { type: String },
			en: { type: String },
		},
	},
	{ _id: false }
);

const ProductSchema = new mongoose.Schema({
	// Название товара на 3 языках
	name: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},

	// Цена
	price: {
		type: Number,
		required: true,
		min: 0,
	},

	// Количество товара на складе
	stock: {
		type: Number,
		required: true,
		min: 0,
		default: 0,
	},

	// Короткое описание на 3 языках
	shortDescription: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},

	// Изображения (максимум 4)
	images: {
		type: [String],
		validate: {
			validator: function (v) {
				return v.length <= 4 && v.length > 0; // Минимум 1 изображение
			},
			message: 'Должно быть от 1 до 4 изображений',
		},
		required: true,
	},

	// Полное описание на 3 языках
	fullDescription: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},

	// Характеристики
	specifications: [SpecSchema],

	// Связанные продукты (максимум 4)
	relatedProducts: {
		type: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Product',
			},
		],
		validate: {
			validator: function (arr) {
				return arr.length <= 4;
			},
			message: 'Максимум 4 связанных товара',
		},
	},

	// Категории (обязательный массив с минимум 1 элементом)
	categories: {
		type: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Category',
			},
		],
		required: true,
		validate: {
			validator: function (v) {
				return v.length > 0;
			},
			message: 'Должна быть указана минимум 1 категория',
		},
	},

	// Подкатегории (необязательный массив)
	subcategories: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Subcategory',
		},
	],

	// Дата создания
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

// Хуки для управления связями
ProductSchema.post('save', async function (doc) {
	// Добавляем товар во все связанные категории
	await mongoose
		.model('Category')
		.updateMany(
			{ _id: { $in: doc.categories } },
			{ $addToSet: { products: doc._id } }
		);

	// Добавляем товар во все связанные подкатегории (если они есть)
	if (doc.subcategories && doc.subcategories.length > 0) {
		await mongoose
			.model('Subcategory')
			.updateMany(
				{ _id: { $in: doc.subcategories } },
				{ $addToSet: { products: doc._id } }
			);
	}
});

ProductSchema.post('deleteOne', { document: true }, async function (doc) {
	// Удаляем товар из всех категорий
	await mongoose
		.model('Category')
		.updateMany(
			{ _id: { $in: doc.categories } },
			{ $pull: { products: doc._id } }
		);

	// Удаляем товар из всех подкатегорий (если они были)
	if (doc.subcategories && doc.subcategories.length > 0) {
		await mongoose
			.model('Subcategory')
			.updateMany(
				{ _id: { $in: doc.subcategories } },
				{ $pull: { products: doc._id } }
			);
	}

	await mongoose
		.model('ProductsSection')
		.updateMany({ products: doc._id }, { $pull: { products: doc._id } });
});

module.exports = mongoose.model('Product', ProductSchema);
