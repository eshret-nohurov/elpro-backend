const multer = require('multer');
const path = require('path');

// Храним файлы в памяти для последующей обработки
const storage = multer.memoryStorage();

// Фильтр для изображений
const fileFilter = (req, file, cb) => {
	const allowedTypes = [
		'image/svg+xml',
		'image/png',
		'image/jpeg',
		'image/jpg',
		'image/webp',
	];
	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error('Недопустимый тип файла. Разрешены только SVG, PNG, JPG, WebP'),
			false
		);
	}
};

const upload = multer({
	storage: storage,
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
