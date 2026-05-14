/*
 * Main Banner Admin
 * Управляет баннерами главной страницы и связанными изображениями.
 */
const MainBanner = require('../../models/MainBanner');
const { processImage, deleteImage } = require('../../utils/imageHandler');

class MainBannerController {
	async getSlides(req, res) {
		try {

			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;


			const totalCount = await MainBanner.countDocuments();


			const slides = await MainBanner.find()
				.sort({ _id: -1 })
				.skip(skip)
				.limit(limit)
				.select('-__v -image -url')
				.lean();


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


			const slide = await MainBanner.findById(id).select('-__v').lean();


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
			const desktopFile = req.files?.image?.[0];
			const mobileFile = req.files?.mobileImage?.[0];


			if (!desktopFile) {
				throw new Error('Desktop изображение обязательно');
			}

			if (!mobileFile) {
				throw new Error('Mobile/tablet изображение обязательно');
			}

			if (!name) {
				throw new Error('Название обязательно');
			}


			const { webp } = await processImage(desktopFile, 'mainBanner');
			const imagePath = webp;
			const { webp: mobileWebp } = await processImage(mobileFile, 'mainBanner');
			const mobileImagePath = mobileWebp;


			const slide = new MainBanner({
				name,
				image: imagePath,
				mobileImage: mobileImagePath,
				url,
			});


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
			const desktopFile = req.files?.image?.[0];
			const mobileFile = req.files?.mobileImage?.[0];


			const slide = await MainBanner.findById(id);
			if (!slide) {
				throw new Error('Слайд не найден');
			}


			let imagePath = slide.image;
			let mobileImagePath = slide.mobileImage;
			if (desktopFile) {

				deleteImage(slide.image);

				const { webp } = await processImage(desktopFile, 'mainBanner');
				imagePath = webp;
			}

			if (mobileFile) {
				if (slide.mobileImage) {
					deleteImage(slide.mobileImage);
				}

				const { webp } = await processImage(mobileFile, 'mainBanner');
				mobileImagePath = webp;
			}

			const updateData = {
				name,
				url,
				image: imagePath,
				mobileImage: mobileImagePath,
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


			const slide = await MainBanner.findByIdAndDelete(id);
			if (!slide) {
				throw new Error('Слайд не найден');
			}


			if (slide.image) {
				await deleteImage(slide.image);
			}

			if (slide.mobileImage) {
				await deleteImage(slide.mobileImage);
			}

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
