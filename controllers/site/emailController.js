const nodemailer = require('nodemailer');
require('dotenv').config();

// Создаем транспорт один раз
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD,
	},
	tls: {
		rejectUnauthorized: false,
	},
	logger: true,
	debug: true,
});

/**
 * Отправляет электронное письмо
 * @param {string} to - Email получателя
 * @param {string} subject - Тема письма
 * @param {string} text - Текст письма
 * @returns {Promise} - Промис с результатом отправки
 */
const sendEmail = async (to = '', subject = '', text = '') => {
	const mailOptions = {
		from: `"ELPRO" <${process.env.EMAIL_USER}>`,
		to: to || process.env.EMAIL_TO_USER,
		subject: subject || 'Поступил новый заказ на сайте',
		text: text || 'У вас есть новое уведомление.',
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		console.log('Email sent:', info.messageId);
		return {
			success: true,
			message: 'Письмо успешно отправлено',
			messageId: info.messageId,
		};
	} catch (error) {
		console.error('Mail send error:', error);
		return {
			success: false,
			error: error.message,
			code: error.responseCode,
			fullError: error,
		};
	}
};

module.exports = sendEmail;
