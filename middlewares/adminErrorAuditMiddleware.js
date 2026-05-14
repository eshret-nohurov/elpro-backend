/*
 * Admin Error Audit
 * Записывает неуспешные ответы админки в журнал с деталями для дальнейшей диагностики.
 */
const { logError } = require('../utils/auditLogger');

const entityByPath = [
	{ pattern: '/orders', entity: 'order' },
	{ pattern: '/product', entity: 'product' },
	{ pattern: '/products', entity: 'product' },
	{ pattern: '/categor', entity: 'category' },
	{ pattern: '/subcategor', entity: 'category' },
	{ pattern: '/users', entity: 'user' },
	{ pattern: '/settings', entity: 'settings' },
	{ pattern: '/banner', entity: 'banner' },
	{ pattern: '/logs', entity: 'audit' },
	{ pattern: '/dashboard', entity: 'dashboard' },
];

const getEntityFromPath = path => {
	const matched = entityByPath.find(item => path.includes(item.pattern));
	return matched?.entity || 'admin';
};

const getResponseMessage = body => {
	if (!body || typeof body !== 'object') return '';

	return body.error || body.message || body.details || '';
};

const adminErrorAuditMiddleware = (req, res, next) => {
	if (!req.originalUrl.startsWith('/api/admin')) return next();

	const originalJson = res.json.bind(res);
	let responseBody = null;

	res.json = body => {
		responseBody = body;
		return originalJson(body);
	};

	res.on('finish', () => {
		if (res.statusCode < 400) return;

		const message = getResponseMessage(responseBody);
		const description = message
			? `Ошибка в админке: ${message}`
			: `Ошибка в админке: HTTP ${res.statusCode}`;

		logError({
			req,
			entity: getEntityFromPath(req.originalUrl),
			statusCode: res.statusCode,
			description,
			error: {
				message,
				response: responseBody,
			},
		});
	});

	next();
};

module.exports = adminErrorAuditMiddleware;
