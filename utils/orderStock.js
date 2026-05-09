/*
 * Stock Sync
 * Сравнивает старое и новое состояние заказа, чтобы корректно уменьшать или возвращать остатки.
 */
const mongoose = require('mongoose');
const Product = require('../models/Product');

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'completed']);
const isActiveStatus = status => ACTIVE_STATUSES.has(status);
const isValidProductId = id => mongoose.Types.ObjectId.isValid(String(id));

const aggregateProducts = products => {
	const map = new Map();

	(products || []).forEach(product => {
		const id = String(product._id || product.id || '');
		if (!isValidProductId(id)) return;
		map.set(id, (map.get(id) || 0) + Number(product.quantity || 0));
	});

	return map;
};

const buildStockDelta = ({ oldOrder = null, newOrder = null }) => {
	const oldMap = oldOrder?.stockApplied ? aggregateProducts(oldOrder.products) : new Map();
	const newMap = newOrder && isActiveStatus(newOrder.status) ? aggregateProducts(newOrder.products) : new Map();
	const productIds = new Set([...oldMap.keys(), ...newMap.keys()]);
	const deltas = [];

	productIds.forEach(productId => {
		const oldQuantity = oldMap.get(productId) || 0;
		const newQuantity = newMap.get(productId) || 0;
		const delta = newQuantity - oldQuantity;
		if (delta !== 0) deltas.push({ productId, delta });
	});

	return deltas;
};

const ensureStockForDeltas = async deltas => {
	const required = deltas.filter(item => item.delta > 0);
	if (!required.length) return;

	const products = await Product.find({ _id: { $in: required.map(item => item.productId) } })
		.select('name stock')
		.lean();
	const productsById = new Map(products.map(product => [String(product._id), product]));

	for (const item of required) {
		const product = productsById.get(item.productId);
		if (!product) {
			const error = new Error('Один из товаров не найден');
			error.statusCode = 400;
			throw error;
		}

		if (product.stock < item.delta) {
			const error = new Error(
				`Недостаточно товара "${product.name?.ru || product.name}". Доступно: ${product.stock}`
			);
			error.statusCode = 400;
			throw error;
		}
	}
};

const applyStockDeltas = async deltas => {
	for (const item of deltas) {
		await Product.findByIdAndUpdate(item.productId, {
			$inc: { stock: -item.delta },
		});
	}
};

const syncOrderStock = async ({ oldOrder = null, newOrder }) => {
	const deltas = buildStockDelta({ oldOrder, newOrder });
	await ensureStockForDeltas(deltas);
	await applyStockDeltas(deltas);
	return {
		stockApplied: isActiveStatus(newOrder.status),
		deltas,
	};
};

module.exports = {
	ACTIVE_STATUSES,
	isActiveStatus,
	syncOrderStock,
};
