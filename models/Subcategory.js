const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
	name: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
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
	category: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Category',
		required: true,
	},
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

// Автоматическое добавление подкатегории в категорию при сохранении
SubcategorySchema.post('save', async function (doc) {
	await mongoose
		.model('Category')
		.updateOne(
			{ _id: doc.category },
			{ $addToSet: { subcategories: doc._id } }
		);
});

// Автоматическое удаление подкатегории из категории при удалении
SubcategorySchema.post('deleteOne', { document: true }, async function (doc) {
	await mongoose
		.model('Category')
		.updateOne({ _id: doc.category }, { $pull: { subcategories: doc._id } });
});

SubcategorySchema.pre('deleteOne', { document: true }, async function (next) {
	// Удаляем эту подкатегорию из всех товаров
	await mongoose
		.model('Product')
		.updateMany(
			{ subcategories: this._id },
			{ $pull: { subcategories: this._id } }
		);
	next();
});

module.exports = mongoose.model('Subcategory', SubcategorySchema);
