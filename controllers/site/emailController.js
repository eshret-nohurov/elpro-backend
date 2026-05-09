/*
 * Mail Transport
 * Создает SMTP-транспорт и отправляет письма от имени настроенной почты магазина.
 */
const nodemailer = require('nodemailer');
require('dotenv').config();


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


const sendEmail = async (to = '', subject = '', text = '', html = '') => {
	const mailOptions = {
		from: `"ELPRO" <${process.env.EMAIL_USER}>`,
		to: to || process.env.EMAIL_TO_USER,
		subject: subject || 'Поступил новый заказ на сайте',
		text: text || 'У вас есть новое уведомление.',
		html: html || undefined,
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
