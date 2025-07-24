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
				return /^[a-z-]+$/.test(v);
			},
			message: props =>
				`В поле url ${props.value}! Разрешены только нижние латинские буквы и дефисы.`,
		},
	},
	icon: {
		type: String,
	},
	subcategories: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Subcategory',
		},
	],
	products: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Product',
		},
	],
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
