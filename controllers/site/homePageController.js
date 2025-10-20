const MainBannerModel = require('../../models/MainBanner');
const PromoBannerModel = require('../../models/PromoBanner');
const FooterBannerModel = require('../../models/FooterBanner');
const ProductsSectionModel = require('../../models/ProductsSection');
const ProductModel = require('../../models/Product');
const SettingsModel = require('../../models/Settings');

class HomePageController {
	async getHomePageData(req, res) {
		try {
			const settings = await SettingsModel.findOne().sort({ _id: -1 }).lean();

			const exchangeRate = settings?.usdToTmtRate || 1;

			const mainBannerSlides = await MainBannerModel.find()
				.sort({ _id: -1 })
				.select('-__v -createdAt -name')
				.lean();

			const promoBanner = await PromoBannerModel.find()
				.sort({ _id: -1 })
				.select('-__v -createdAt')
				.lean();

			const footerBanner = await FooterBannerModel.find()
				.sort({ _id: -1 })
				.select('-__v -createdAt')
				.lean();

			const productsSection = await ProductsSectionModel.find()
				.sort({ position: 1 })
				.lean();

			const allProductIds = [];
			productsSection.forEach(section => {
				if (section.products && section.products.length > 0) {
					allProductIds.push(...section.products);
				}
			});

			const actualProducts = await ProductModel.find({
				_id: { $in: allProductIds },
				stock: { $gt: 0 },
			})
				.select(
					'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories'
				)
				.lean();

			actualProducts.forEach(product => {
				product.price = parseFloat((product.price * exchangeRate).toFixed(2));
			});

			const productMap = new Map();
			actualProducts.forEach(product => {
				productMap.set(product._id.toString(), product);
			});

			let latestProducts = [];
			const needLatestProducts = productsSection.some(
				section => !section.products || section.products.length === 0
			);

			if (needLatestProducts) {
				latestProducts = await ProductModel.find({ stock: { $gt: 0 } })
					.sort({ _id: -1 })
					.limit(8)
					.select(
						'-__v -createdAt -shortDescription -fullDescription -specifications -relatedProducts -categories'
					)
					.lean();

				latestProducts.forEach(product => {
					product.price = parseFloat((product.price * exchangeRate).toFixed(2));
				});
			}

			const finalSections = productsSection.map(section => {
				let finalProducts = [];

				if (section.products && section.products.length > 0) {
					finalProducts = section.products
						.map(id => productMap.get(id.toString()))
						.filter(product => product !== undefined);
				}

				if (finalProducts.length === 0) {
					finalProducts = latestProducts;
				}

				return {
					...section,
					products: finalProducts,
				};
			});

			res.status(200).json({
				main_banner: mainBannerSlides,
				promo_banner: promoBanner,
				footer_banner: footerBanner,
				products_section: finalSections,
			});
		} catch (error) {
			console.error('Ошибка получения:', error);

			res.status(500).json({
				error: 'Не удалось загрузить данные',
			});
		}
	}
}

module.exports = new HomePageController();
