const OrdersModel = require('../../models/Orders');
const ProductModel = require('../../models/Product');

const statusLabels = {
	pending: 'Новые',
	processing: 'В обработке',
	completed: 'Завершенные',
	cancelled: 'Отмененные',
};

class DashboardController {
	async getDashboard(req, res) {
		try {
			const canViewFinancials = req.user?.role === 'admin';
			const [orderStatusStats, productStats, recentOrders] = await Promise.all([
				OrdersModel.aggregate([
					{
						$group: {
							_id: '$status',
							count: { $sum: 1 },
							totalPrice: { $sum: '$totalPrice' },
							productsCount: {
								$sum: {
									$sum: '$products.quantity',
								},
							},
						},
					},
				]),
				ProductModel.aggregate([
					{
						$group: {
							_id: null,
							totalProducts: { $sum: 1 },
							totalStock: { $sum: '$stock' },
							outOfStock: {
								$sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] },
							},
							lowStock: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $gt: ['$stock', 0] },
												{ $lte: ['$stock', 5] },
											],
										},
										1,
										0,
									],
								},
							},
						},
					},
				]),
				OrdersModel.find()
					.sort({ createdAt: -1 })
					.limit(6)
					.select('name phone status totalPrice products createdAt')
					.lean(),
			]);

			const ordersByStatus = Object.keys(statusLabels).map(status => {
				const stat = orderStatusStats.find(item => item._id === status);
				return {
					status,
					label: statusLabels[status],
					count: stat?.count || 0,
					totalPrice: stat?.totalPrice || 0,
					productsCount: stat?.productsCount || 0,
				};
			});

			const ordersTotal = ordersByStatus.reduce((total, item) => total + item.count, 0);
			const activeOrdersTotal = ordersByStatus
				.filter(item => item.status !== 'cancelled')
				.reduce((total, item) => total + item.count, 0);
			const revenueTotal = ordersByStatus
				.filter(item => item.status !== 'cancelled')
				.reduce((total, item) => total + item.totalPrice, 0);
			const orderedProductsTotal = ordersByStatus
				.filter(item => item.status !== 'cancelled')
				.reduce((total, item) => total + item.productsCount, 0);
			const products = productStats[0] || {
				totalProducts: 0,
				totalStock: 0,
				outOfStock: 0,
				lowStock: 0,
			};

			const responseCards = {
				ordersTotal,
				activeOrdersTotal,
				orderedProductsTotal,
				productsTotal: products.totalProducts,
				totalStock: products.totalStock,
				outOfStock: products.outOfStock,
				lowStock: products.lowStock,
			};

			if (canViewFinancials) {
				responseCards.revenueTotal = revenueTotal;
			}

			const responseOrdersByStatus = ordersByStatus.map(status => {
				const { totalPrice, ...safeStatus } = status;
				return canViewFinancials ? status : safeStatus;
			});

			const responseRecentOrders = recentOrders.map(order => {
				const transformedOrder = {
					...order,
					statusLabel: statusLabels[order.status] || order.status,
					productsCount: order.products.reduce(
						(total, product) => total + product.quantity,
						0
					),
				};

				if (canViewFinancials) {
					return transformedOrder;
				}

				const { totalPrice, ...safeOrder } = transformedOrder;
				return safeOrder;
			});

			res.status(200).json({
				data: {
					canViewFinancials,
					cards: responseCards,
					ordersByStatus: responseOrdersByStatus,
					recentOrders: responseRecentOrders,
				},
			});
		} catch (error) {
			console.error('Ошибка получения данных дашборда:', error);
			res.status(500).json({ error: 'Не удалось получить данные дашборда' });
		}
	}
}

module.exports = new DashboardController();
