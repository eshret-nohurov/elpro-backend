const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
	usdToTmtRate: {
		type: Number,
		required: true,
		min: 0,
	},

	deliveryPrices: {
		type: Map,
		of: Number,
		default: {},
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Settings', SettingsSchema);
