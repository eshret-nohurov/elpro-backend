const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');

class AuditLogController {
	async getLogs(req, res) {
		try {
			if (req.user?.role !== 'admin') {
				return res.status(403).json({ error: 'Доступ запрещен' });
			}

			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;
			const filter = {};

			if (req.query.user) filter.user = req.query.user;
			if (req.query.entity) filter.entity = req.query.entity;
			if (req.query.action) filter.action = req.query.action;

			const [totalCount, logs] = await Promise.all([
				AuditLog.countDocuments(filter),
				AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
			]);

			const totalPages = Math.ceil(totalCount / limit);

			res.status(200).json({
				data: logs,
				meta: {
					total: totalCount,
					page,
					limit,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
			});
		} catch (error) {
			console.error('Ошибка получения логов:', error);
			res.status(500).json({ error: 'Не удалось получить журнал действий' });
		}
	}

	async getLogUsers(req, res) {
		try {
			if (req.user?.role !== 'admin') {
				return res.status(403).json({ error: 'Доступ запрещен' });
			}

			const users = await User.find().sort({ username: 1 }).select('_id username role').lean();
			res.status(200).json({ data: users });
		} catch (error) {
			console.error('Ошибка получения пользователей для логов:', error);
			res.status(500).json({ error: 'Не удалось получить пользователей' });
		}
	}
}

module.exports = new AuditLogController();
