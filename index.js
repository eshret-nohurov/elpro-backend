require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const adminRoutes = require('./routes/admin/adminRoutes');
const authRoutes = require('./routes/admin/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Админ Роуты
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin', adminRoutes);

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
