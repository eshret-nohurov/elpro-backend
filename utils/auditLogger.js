/*
 * Audit Logger
 * Записывает действия пользователей в журнал без остановки основного бизнес-процесса.
 */
const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEYS = new Set([
	'password',
	'newPassword',
	'token',
	'authorization',
	'cookie',
]);

const getUserInfo = req => ({
	user: req?.user?._id || null,
	username: req?.user?.username || req?.body?.username || 'Сайт',
	role: req?.user?.role || 'site',
});

const sanitizeValue = value => {
	if (Array.isArray(value)) return value.map(sanitizeValue);

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				SENSITIVE_KEYS.has(key) ? '[hidden]' : sanitizeValue(item),
			])
		);
	}

	return value;
};

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

const logError = async ({ req = null, entity = 'system', description, statusCode = 500, error = {}, meta = {} }) => {
	try {
		await AuditLog.create({
			...getUserInfo(req),
			action: 'error',
			entity,
			entityId: String(req?.params?.id || ''),
			entityName: String(req?.originalUrl || ''),
			description,
			meta: sanitizeValue({
				statusCode,
				method: req?.method,
				path: req?.originalUrl,
				params: req?.params,
				query: req?.query,
				body: req?.body,
				error,
				...meta,
			}),
		});
	} catch (logError) {
		console.error('Audit error log failed:', logError);
	}
};

module.exports = { logAction, logError };
