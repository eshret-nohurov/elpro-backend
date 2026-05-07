const hasActiveDiscount = product => {
	const price = Number(product?.price || 0);
	const discountPercent = Number(product?.discountPrice || 0);
	const expiresAt = product?.discountExpiresAt
		? new Date(product.discountExpiresAt)
		: null;

	return (
		price > 0 &&
		discountPercent > 0 &&
		discountPercent < 100 &&
		(!expiresAt || (!Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()))
	);
};

const applyProductPricing = (product, exchangeRate = 1) => {
	if (!product) return product;

	const basePrice = Number(product.price || 0);
	const originalPrice = parseFloat((basePrice * exchangeRate).toFixed(2));
	const isDiscountActive = hasActiveDiscount(product);
	const rawDiscountPercent = Number(product.discountPrice || 0);
	const discountPrice = isDiscountActive
		? parseFloat((originalPrice * (1 - rawDiscountPercent / 100)).toFixed(2))
		: null;

	product.originalPrice = originalPrice;
	product.hasDiscount = isDiscountActive;
	product.discountPrice = discountPrice;
	product.discountPercent = isDiscountActive ? rawDiscountPercent : 0;
	product.price = isDiscountActive ? discountPrice : originalPrice;
	product.discountExpiresAt = isDiscountActive ? product.discountExpiresAt : null;

	return product;
};

module.exports = {
	applyProductPricing,
	hasActiveDiscount,
};
