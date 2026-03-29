require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');
const connectDB = require('./config/db');
const bcrypt = require('bcryptjs');

const seedDB = async () => {
    await connectDB();

    try {
        // Clear existing data
        await User.deleteMany({});
        await Company.deleteMany({});

        // Create a new company
        const company = new Company({
            name: 'Innovate Corp',
            defaultCurrency: 'USD'
        });
        await company.save();

        // Create an Admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const admin = new User({
            name: 'Admin User',
            email: 'admin@innovatecorp.com',
            password: hashedPassword,
            role: 'Admin',
            company: company._id
        });
        await admin.save();

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();