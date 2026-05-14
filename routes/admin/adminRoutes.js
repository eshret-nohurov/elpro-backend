/*
 * Admin Routes
 * Собирает защищенные маршруты админки для каталога, заказов, логов, настроек и пользователей.
 */
const express = require('express');
const router = express.Router();
const upload = require('../../utils/multerConfig');
const PromoBannerController = require('../../controllers/admin/promoBannerController');
const ProductsSectionController = require('../../controllers/admin/productsSectionController');
const AuthController = require('../../controllers/admin/authController');
const SettingsController = require('../../controllers/admin/settingsController');
const FooterBannerController = require('../../controllers/admin/footerBannerController');
const mainBannerController = require('../../controllers/admin/mainBannerController');
const catalogController = require('../../controllers/admin/catalogController');
const authMiddleware = require('../../middlewares/authMiddleware');

const DashboardController = require('../../controllers/admin/dashboardController');
const AuditLogController = require('../../controllers/admin/auditLogController');
const OrderController = require('../../controllers/admin/orderController');
const ProductController = require('../../controllers/admin/productController');

router.use(authMiddleware);


router.get('/dashboard', DashboardController.getDashboard);


router.get('/logs', AuditLogController.getLogs);

router.get('/logs/users', AuditLogController.getLogUsers);


router.get('/categories', catalogController.getCategories);

router.get('/category/:id', catalogController.getCategoryById);

router.get('/categories-for-list', catalogController.getCategoriesForList);

router.post(
	'/create_category',
	upload.single('icon'),
	catalogController.createCategory
);

router.post(
	'/update_category/:id',
	upload.single('icon'),
	catalogController.updateCategory
);

router.delete('/delete_category/:id', catalogController.deleteCategory);


router.get('/main_banner_slides', mainBannerController.getSlides);

router.get('/main_banner_slide/:id', mainBannerController.getSlideById);

router.post(
	'/create_main_banner_slide',
	upload.fields([
		{ name: 'image', maxCount: 1 },
		{ name: 'mobileImage', maxCount: 1 },
	]),
	mainBannerController.createSlide
);

router.post(
	'/update_main_banner_slide/:id',
	upload.fields([
		{ name: 'image', maxCount: 1 },
		{ name: 'mobileImage', maxCount: 1 },
	]),
	mainBannerController.updateSlide
);

router.delete(
	'/delete_main_banner_slide/:id',
	mainBannerController.deleteSlide
);


router.get('/promo_banner_slides', PromoBannerController.getSlides);

router.get('/promo_banner_slide/:id', PromoBannerController.getSlideById);

router.post(
	'/create_promo_banner_slide',
	upload.single('image'),
	PromoBannerController.createSlide
);

router.post(
	'/update_promo_banner_slide/:id',
	upload.single('image'),
	PromoBannerController.updateSlide
);

router.delete(
	'/delete_promo_banner_slide/:id',
	PromoBannerController.deleteSlide
);


router.get('/footer_banner_slides', FooterBannerController.getSlides);

router.get('/footer_banner_slide/:id', FooterBannerController.getSlideById);

router.post(
	'/create_footer_banner_slide',
	upload.single('image'),
	FooterBannerController.createSlide
);

router.post(
	'/update_footer_banner_slide/:id',
	upload.single('image'),
	FooterBannerController.updateSlide
);

router.delete(
	'/delete_footer_banner_slide/:id',
	FooterBannerController.deleteSlide
);


router.get('/products', ProductController.getProducts);

router.get('/product/:id', ProductController.getProductById);

router.post(
	'/create_product',
	upload.array('images', 4),
	ProductController.createProduct
);

router.post(
	'/update_product/:id',
	upload.array('images', 4),
	ProductController.updateProduct
);

router.get(
	'/categories_for_product',
	ProductController.getCategoriesForProductForm
);

router.get('/search_products', ProductController.searchProducts);

router.delete('/delete_product/:id', ProductController.deleteProduct);


router.get('/products_section', ProductsSectionController.getProductsSection);

router.get(
	'/products_section/:id',
	ProductsSectionController.getProductsSectionById
);

router.post(
	'/create_products_section',
	ProductsSectionController.createProductsSection
);

router.post(
	'/update_products_section/:id',
	ProductsSectionController.updateProductsSection
);

router.delete(
	'/delete_products_section/:id',
	ProductsSectionController.deleteProductsSection
);


router.get('/users', AuthController.getUsers);

router.get('/users/:id', AuthController.getUserById);

router.post('/users/create', AuthController.createUser);

router.post('/users/update/:id', AuthController.updateUsers);

router.delete('/users/delete/:id', AuthController.deleteUser);


router.get('/settings', SettingsController.getSettings);

router.post('/settings/create', SettingsController.createSettings);

router.post('/settings/update/:id', SettingsController.updateSettings);


router.get('/orders', OrderController.getOrders);

router.post('/orders/create', OrderController.createOrder);

router.get('/orders/:id', OrderController.getOrderById);

router.post('/orders/:id/update', OrderController.updateOrder);

router.patch('/orders/:id/status', OrderController.updateOrderStatus);

router.delete('/orders/:id', OrderController.deleteOrder);

module.exports = router;
