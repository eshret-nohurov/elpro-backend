const express = require('express');
const router = express.Router();

const LayoutsController = require('../../controllers/site/layoutsController');
const HomePageController = require('../../controllers/site/homePageController');
const ProductsByUrlController = require('../../controllers/site/productsByUrlController');
const ProductController = require('../../controllers/site/productController');
const OrderController = require('../../controllers/site/orderController');

router.get('/navigation', LayoutsController.getNav);

router.get('/home', HomePageController.getHomePageData);

router.get(
	'/products/category/:url',
	ProductsByUrlController.getProductsByCategoryUrl
);

router.get('/product/:id', ProductController.getProduct);

router.post('/create-order', OrderController.createOrder);

module.exports = router;
