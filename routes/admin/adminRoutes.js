const express = require('express');
const router = express.Router();
const upload = require('../../utils/multerConfig');
const catalogController = require('../../controllers/admin/catalogController');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

// Категории
router.get('/categories', catalogController.getCategories);

router.post(
	'/create_category',
	upload.single('icon'),
	catalogController.createCategory
);

router.delete('/delete_category/:id', catalogController.deleteCategory);

//! =====================================================================
// Категории

router.put(
	'/categories/:id',
	upload.single('icon'),
	(req, res, next) => {
		console.log('File received:', req.file);
		console.log('Body:', req.body);
		next();
	},
	catalogController.updateCategory
);
router.delete('/categories/:id', catalogController.deleteCategory);

module.exports = router;
