require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // Добавляем модуль path

const adminRoutes = require('./routes/admin/adminRoutes');
const authRoutes = require('./routes/admin/authRoutes');
const siteRoutes = require('./routes/site/siteRoutes');

const app = express();

const allowedOrigins = [
	process.env.CLIENT_URL,
	process.env.ADMIN_URL,
	'http://localhost:3001',
	'http://127.0.0.1:3001',
	'http://0.0.0.0:3001',
	'http://localhost:1828',
	'http://127.0.0.1:1828',
	'http://0.0.0.0:1828',
].filter(Boolean);

// Настройки CORS для Express
const corsOptions = {
	origin: (origin, callback) => {
		if (!origin || allowedOrigins.includes(origin)) {
			return callback(null, true);
		}

		return callback(new Error(`CORS blocked for origin: ${origin}`));
	},
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	credentials: true,
	optionsSuccessStatus: 204,
};

app.use(cors(corsOptions)); // Используем настройки CORS

// Для статических файлов добавляем явные CORS-заголовки
const staticOptions = {
	setHeaders: (res, filePath, stat) => {
		const origin = res.req.headers.origin;
		if (!origin || allowedOrigins.includes(origin)) {
			res.setHeader('Access-Control-Allow-Origin', origin || '*');
			res.setHeader('Vary', 'Origin');
		}
	},
};

// Обслуживание статических файлов с CORS
app.use(
	'/uploads',
	express.static(path.join(__dirname, 'uploads'), staticOptions)
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Админ Роуты
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Сайт Роуты
app.use('/api', siteRoutes);

// Обработка 404
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: 'Not Found',
	});
});

// Обработка ошибок
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({
		success: false,
		message: 'Internal Server Error',
	});
});

function start() {
	try {
		mongoose.connect(`mongodb://localhost/${process.env.DATABASE}`);

		const db = mongoose.connection;
		db.on('error', error => console.error(error));
		db.once('open', () =>
			console.log('============//connected to dataBase//============')
		);

		app.listen(process.env.PORT, '0.0.0.0', () => {
			console.log(`Server running on port ${process.env.PORT}`);
		});
	} catch (e) {
		console.log(e);
	}
}

start();
