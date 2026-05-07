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
			originalPrice: {
				type: Number,
				default: null,
				min: 0,
			},
			hasDiscount: {
				type: Boolean,
				default: false,
			},
			discountPercent: {
				type: Number,
				default: 0,
				min: 0,
			},
			discountExpiresAt: {
				type: Date,
				default: null,
			},
		},
	],

	subtotalPrice: {
		type: Number,
		default: 0,
		min: 0,
	},

	deliveryPrice: {
		type: Number,
		default: 0,
		min: 0,
	},

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

	stockApplied: {
		type: Boolean,
		default: false,
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
}, {
	timestamps: true,
});

module.exports = mongoose.model('Orders', OrdersSchema);
