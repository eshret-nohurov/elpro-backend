const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Обработка и сохранение изображений
 * @param {Object} file - Объект файла из multer (req.file)
 * @param {String} modelName - Название модели (для папки)
 * @param {Boolean} isIcon - Это иконка или нет
 * @returns {Promise<Object>} - Пути к сохраненным файлам
 */
async function processImage(file, modelName, isIcon = false) {
	try {
		// Создаем папку для модели если ее нет
		const uploadDir = path.join(__dirname, '../uploads', modelName);
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}

		const filename = uuidv4();
		const result = {};

		// Обработка иконок (SVG/PNG)
		if (isIcon) {
			if (file.mimetype === 'image/svg+xml') {
				// Сохраняем SVG
				const svgPath = path.join(uploadDir, `${filename}.svg`);
				fs.writeFileSync(svgPath, file.buffer);
				result.svg = `/uploads/${modelName}/${filename}.svg`;
			} else if (file.mimetype === 'image/png') {
				// Сохраняем PNG
				const svgPath = path.join(uploadDir, `${filename}.png`);
				fs.writeFileSync(svgPath, file.buffer);
				result.png = `/uploads/${modelName}/${filename}.png`;
			} else {
				throw new Error('Иконка должна быть в формате SVG или PNG');
			}
		}
		// Обработка обычных изображений (JPG/JPEG/PNG -> WebP)
		else {
			const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png'];
			if (!allowedFormats.includes(file.mimetype)) {
				throw new Error('Допустимые форматы: JPG, JPEG, PNG');
			}

			// Сохраняем оригинал (если нужно)
			/* const ext =
				file.mimetype.split('/')[1] === 'jpeg'
					? 'jpg'
					: file.mimetype.split('/')[1];
			const originalPath = path.join(uploadDir, `${filename}.${ext}`);
			fs.writeFileSync(originalPath, file.buffer);
			result.original = `/uploads/${modelName}/${filename}.${ext}`; */

			// Конвертируем в WebP
			const image = await Jimp.read(file.buffer);
			const webpPath = path.join(uploadDir, `${filename}.webp`);
			await image.quality(80).writeAsync(webpPath);
			result.webp = `/uploads/${modelName}/${filename}.webp`;
		}

		return result;
	} catch (error) {
		console.error('Image processing error:', error);
		throw error;
	}
}

/**
 * Удаление файлов изображений
 * @param {String} filePath - Путь к файлу (из базы данных)
 */
function deleteImage(filePath) {
	if (!filePath) return;

	const fullPath = path.join(__dirname, '../', filePath);
	if (fs.existsSync(fullPath)) {
		fs.unlinkSync(fullPath);
	}
}

module.exports = { processImage, deleteImage };
