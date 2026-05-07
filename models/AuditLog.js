const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		default: null,
	},
	username: {
		type: String,
		default: 'Сайт',
	},
	role: {
		type: String,
		default: 'site',
	},
	action: {
		type: String,
		required: true,
	},
	entity: {
		type: String,
		required: true,
	},
	entityId: {
		type: String,
		default: '',
	},
	entityName: {
		type: String,
		default: '',
	},
	description: {
		type: String,
		required: true,
	},
	meta: {
		type: mongoose.Schema.Types.Mixed,
		default: {},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
