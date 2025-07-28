const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		minlength: 3,
	},
	password: {
		type: String,
		required: true,
		minlength: 8,
	},
	role: {
		type: String,
		enum: ['admin', 'editor', 'seller'],
		default: 'admin',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

// Хеширование пароля перед сохранением
UserSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();

	try {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (err) {
		next(err);
	}
});

// Метод для сравнения паролей
UserSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
