const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
	usdToTmtRate: {
		type: Number,
		required: true,
		min: 0,
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Settings', SettingsSchema);
