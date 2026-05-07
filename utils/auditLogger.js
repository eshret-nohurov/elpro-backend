const AuditLog = require('../models/AuditLog');

const getUserInfo = req => ({
	user: req?.user?._id || null,
	username: req?.user?.username || 'Сайт',
	role: req?.user?.role || 'site',
});

const logAction = async ({ req = null, action, entity, entityId = '', entityName = '', description, meta = {} }) => {
	try {
		await AuditLog.create({
			...getUserInfo(req),
			action,
			entity,
			entityId: String(entityId || ''),
			entityName: String(entityName || ''),
			description,
			meta,
		});
	} catch (error) {
		console.error('Audit log error:', error);
	}
};

module.exports = { logAction };
