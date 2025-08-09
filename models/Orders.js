const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema({
	location: {
		type: String,
		required: true,
	},

	isPickup: {
		type: Boolean,
		default: false,
	},

	address: {
		type: String,
		required: function () {
			return !this.isPickup;
		},
	},

	name: {
		type: String,
		required: true,
	},

	phone: {
		type: String,
		required: true,
	},

	email: {
		type: String,
		default: '',
	},

	comment: {
		type: String,
		default: '',
	},

	products: [
		{
			_id: { type: String, required: true },
			name: { type: String, required: true },
			quantity: {
				type: Number,
				required: true,
				min: 1,
			},
			price: {
				type: Number,
				required: true,
				min: 0,
			},
		},
	],

	totalPrice: {
		type: Number,
		required: true,
		min: 0,
	},

	status: {
		type: String,
		enum: ['pending', 'processing', 'completed', 'cancelled'],
		default: 'pending',
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Orders', OrdersSchema);
