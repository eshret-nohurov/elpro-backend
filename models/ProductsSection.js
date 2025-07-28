const mongoose = require('mongoose');

const ProductsSectionSchema = new mongoose.Schema({
	name: {
		ru: { type: String, required: true },
		tm: { type: String },
		en: { type: String },
	},
	products: {
		type: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Product',
			},
		],
		validate: {
			validator: function (arr) {
				return arr.length <= 8;
			},
			message: 'Максимум 8 товара',
		},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('ProductsSection', ProductsSectionSchema);
