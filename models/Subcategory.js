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
				return /^[a-z-]+$/.test(v);
			},
			message: props =>
				`${props.value} is not valid! Only lowercase Latin letters and hyphens are allowed, no numbers.`,
		},
	},
	icon: {
		type: String,
		required: true,
	},
	category: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Category',
		required: true,
	},
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
SubcategorySchema.post('remove', async function (doc) {
	await mongoose
		.model('Category')
		.updateOne({ _id: doc.category }, { $pull: { subcategories: doc._id } });
});

module.exports = mongoose.model('Subcategory', SubcategorySchema);
