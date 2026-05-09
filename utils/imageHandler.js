/*
 * Image Handler
 * Сохраняет SVG/PNG и конвертирует обычные изображения в WebP для единых загрузок.
 */
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


async function processImage(file, modelName, isIcon = false) {
	try {

		const uploadDir = path.join(__dirname, '../uploads', modelName);
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}

		const filename = uuidv4();
		const result = {};


		if (isIcon) {
			if (file.mimetype === 'image/svg+xml') {

				const svgPath = path.join(uploadDir, `${filename}.svg`);
				fs.writeFileSync(svgPath, file.buffer);
				result.svg = `/uploads/${modelName}/${filename}.svg`;
			} else if (file.mimetype === 'image/png') {

				const svgPath = path.join(uploadDir, `${filename}.png`);
				fs.writeFileSync(svgPath, file.buffer);
				result.png = `/uploads/${modelName}/${filename}.png`;
			} else {
				throw new Error('Иконка должна быть в формате SVG или PNG');
			}
		}

		else {
			const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png'];
			if (!allowedFormats.includes(file.mimetype)) {
				throw new Error('Допустимые форматы: JPG, JPEG, PNG');
			}





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


function deleteImage(filePath) {
	if (!filePath) return;

	const fullPath = path.join(__dirname, '../', filePath);
	if (fs.existsSync(fullPath)) {
		fs.unlinkSync(fullPath);
	}
}

module.exports = { processImage, deleteImage };
