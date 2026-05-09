/*
 * Product Model
 * Описывает товар, скидку, остаток, изображения, характеристики и связи с категориями.
 */
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

	name: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},


	price: {
		type: Number,
		required: true,
		min: 0,
	},


	discountPrice: {
		type: Number,
		default: null,
		min: 0,
		max: 100,
	},

	discountExpiresAt: {
		type: Date,
		default: null,
	},


	stock: {
		type: Number,
		required: true,
		min: 0,
		default: 0,
	},


	shortDescription: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},


	images: {
		type: [String],
		validate: {
			validator: function (v) {
				return v.length <= 4 && v.length > 0;
			},
			message: 'Должно быть от 1 до 4 изображений',
		},
		required: true,
	},


	fullDescription: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},


	specifications: [SpecSchema],


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


	createdAt: {
		type: Date,
		default: Date.now,
	},
});


ProductSchema.post('save', async function (doc) {

	await mongoose
		.model('Category')
		.updateMany(
			{ _id: { $in: doc.categories } },
			{ $addToSet: { products: doc._id } }
		);
});

ProductSchema.post('deleteOne', { document: true }, async function (doc) {

	await mongoose
		.model('Category')
		.updateMany(
			{ _id: { $in: doc.categories } },
			{ $pull: { products: doc._id } }
		);

	await mongoose
		.model('ProductsSection')
		.updateMany({ products: doc._id }, { $pull: { products: doc._id } });
});

module.exports = mongoose.model('Product', ProductSchema);
