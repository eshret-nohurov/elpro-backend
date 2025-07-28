const MainBanner = require('../../models/MainBanner');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class MainBannerController {
	async getSlides(req, res) {
		try {
			// Параметры пагинации из запроса
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			// 1. Получаем общее количество слайдов
			const totalCount = await MainBanner.countDocuments();

			// 2. Получаем слайды с пагинацией
			const slides = await MainBanner.find()
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('-__v -image -url')
				.lean();

			// 3. Формируем ответ с метаданными пагинации
			const totalPages = Math.ceil(totalCount / limit);

			res.status(200).json({
				data: slides,
				meta: {
					total: totalCount,
					page,
					limit,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
			});
		} catch (error) {
			console.error('Ошибка получения слайдов:', error);

			res.status(500).json({
				error: 'Не удалось получить список слайдов',
			});
		}
	}

	async getSlideById(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим слайд по ID
			const slide = await MainBanner.findById(id).select('-__v').lean();

			// 2. Если слайд не найден
			if (!slide) {
				return res.status(404).json({
					error: 'Слайд не найден',
				});
			}

			res.status(200).json({
				data: slide,
			});
		} catch (error) {
			console.error('Ошибка получения слайда:', error);

			// Проверяем, если ошибка связана с невалидным ID
			if (error.name === 'CastError') {
				return res.status(400).json({
					error: 'Неверный формат ID слайда',
				});
			}

			res.status(500).json({
				error: 'Не удалось получить слайд',
			});
		}
	}

	async createSlide(req, res) {
		try {
			const { name, url } = req.body;
			const file = req.file;

			// 1. Валидация входящих данных
			if (!file) {
				throw new Error('Изображение обязательна');
			}

			if (!name) {
				throw new Error('Название обязательно');
			}

			// 2. Обработка иконки
			const { webp } = await processImage(file, 'mainBanner');
			const imagePath = webp;

			// 3. Создание слайда
			const slide = new MainBanner({
				name,
				image: imagePath,
				url,
			});

			// 4. Валидация и сохранение
			await slide.validate();
			await slide.save();

			res.status(201).json({
				data: slide,
				message: 'Слайд успешно создан!',
			});
		} catch (error) {
			console.error('Ошибка создания слайда:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				error: errorMessage,
			});
		}
	}

	async updateSlide(req, res) {
		try {
			const { id } = req.params;
			const { name, url } = req.body;
			const file = req.file;

			// 1. Находим слайд
			const slide = await MainBanner.findById(id);
			if (!slide) {
				throw new Error('Слайд не найден');
			}

			// 2. Обработка Изображение (если новая передана)
			let imagePath = slide.image;
			if (file) {
				// Удаляем старое изображение
				deleteImage(slide.image);

				const { webp } = await processImage(file, 'mainBanner');
				imagePath = webp;
			}

			const updateData = {
				name,
				url,
				image: imagePath,
			};

			const updatedBanner = await MainBanner.findByIdAndUpdate(id, updateData, {
				new: true,
				validate: true,
			});

			res.status(200).json({
				data: updatedBanner,
				message: 'Cлайд успешно обновлен',
			});
		} catch (error) {
			console.error('Ошибка обновления слайда:', error);

			const statusCode = error.name === 'ValidationError' ? 400 : 500;
			const errorMessage =
				error.name === 'ValidationError'
					? Object.values(error.errors)
							.map(err => err.message)
							.join(', ')
					: error.message;

			res.status(statusCode).json({
				error: errorMessage,
			});
		}
	}

	async deleteSlide(req, res) {
		try {
			const { id } = req.params;

			// 1. Находим и удаляем слайд
			const slide = await MainBanner.findByIdAndDelete(id);
			if (!slide) {
				throw new Error('Слайд не найден');
			}

			// 2. Удаляем связанные изображения (если есть)
			if (slide.image) {
				await deleteImage(slide.image);
			}

			// 3. Формируем ответ
			res.status(200).json({
				data: {
					deletedSlide: slide,
				},
				message: 'Слайд удален.',
			});
		} catch (error) {
			console.error('Ошибка удаления слайда:', error);

			const statusCode = error.message === 'Слайд не найден' ? 404 : 500;

			res.status(statusCode).json({
				error: error.message,
				message: 'Не удалось удалить слайд',
			});
		}
	}
}

module.exports = new MainBannerController();
