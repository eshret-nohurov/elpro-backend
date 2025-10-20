const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
	name: {
		type: Object,
		properties: {
			ru: { type: String, required: true },
			tm: { type: String },
			en: { type: String },
		},
	},
	url: {
		type: String,
		required: true,
		unique: true,
		validate: {
			validator: function (v) {
				return /^[a-z0-9-]+$/.test(v);
			},
			message: props =>
				`Недопустимый URL: "${props.value}". Разрешены только латинские буквы в нижнем регистре, цифры и дефисы.`,
		},
	},
	icon: {
		type: String,
	},
	parent: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Category',
		default: null,
	},
	children: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Category',
		},
	],
	products: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
		},
	],
	position: {
		type: Number,
		default: 1,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

CategorySchema.pre('deleteOne', { document: true }, async function (next) {
	// Удаляем эту категорию из всех товаров
	await mongoose
		.model('Product')
		.updateMany({ categories: this._id }, { $pull: { categories: this._id } });
	next();
});

module.exports = mongoose.model('Category', CategorySchema);
