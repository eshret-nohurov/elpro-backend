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

const ProductController = require('../../controllers/admin/productController');

router.use(authMiddleware);

//! Категории
router.get('/categories', catalogController.getCategories);

router.get('/category/:id', catalogController.getCategoryById);

router.get(
	'/categories-for-subcategory',
	catalogController.getCategoriesForSubcategory
);

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

//! Подкатегории
router.get('/subcategories', catalogController.getSubCategories);

router.get('/subcategory/:id', catalogController.getSubCategoryById);

router.post(
	'/create_subcategory',
	upload.single('icon'),
	catalogController.createSubcategory
);

router.post(
	'/update_subcategory/:id',
	upload.single('icon'),
	catalogController.updateSubcategory
);

router.delete('/delete_subcategory/:id', catalogController.deleteSubcategory);

//! Главный баннер
router.get('/main_banner_slides', mainBannerController.getSlides);

router.get('/main_banner_slide/:id', mainBannerController.getSlideById);

router.post(
	'/create_main_banner_slide',
	upload.single('image'),
	mainBannerController.createSlide
);

router.post(
	'/update_main_banner_slide/:id',
	upload.single('image'),
	mainBannerController.updateSlide
);

router.delete(
	'/delete_main_banner_slide/:id',
	mainBannerController.deleteSlide
);

//! Промо баннер
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

//! Футер баннер
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

//! PRODUCT
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

router.post(
	'/selected_subcategories',
	ProductController.getSubcategoriesByCategories
);

router.get('/search_products', ProductController.searchProducts);

router.delete('/delete_product/:id', ProductController.deleteProduct);

//! PRODUCTS SECTION
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

//! USERS
router.get('/users', AuthController.getUsers);

router.get('/users/:id', AuthController.getUserById);

router.post('/users/create', AuthController.createUser);

router.post('/users/update/:id', AuthController.updateUsers);

router.delete('/users/delete/:id', AuthController.deleteUser);

//! Settings
router.get('/settings', SettingsController.getSettings);

router.post('/settings/create', SettingsController.createSettings);

router.post('/settings/update/:id', SettingsController.updateSettings);

module.exports = router;
