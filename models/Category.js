const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
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
	subcategories: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Subcategory',
		},
	],
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Category', CategorySchema);
