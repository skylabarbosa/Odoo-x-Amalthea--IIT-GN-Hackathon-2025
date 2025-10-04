const User = require('../models/user');

// @desc    Get admin dashboard with users and managers
// @route   GET /admin/dashboard
exports.getAdminDashboard = async (req, res) => {
    try {
        const users = await User.find({ company: req.session.user.companyId });
        const managers = users.filter(user => user.role === 'Manager' || user.role === 'Admin');
        res.render('admin-dashboard', { users, managers });
    } catch (error) {
        // ... error handling
    }
};


// @desc    Create a new user
// @route   POST /users/create
exports.createUser = async (req, res) => {
    const { name, email, password, role, managerId } = req.body;
    try {
        const newUser = new User({
            name,
            email,
            password,
            role,
            company: req.session.user.companyId,
            manager: managerId || null
        });
        await newUser.save();
        req.flash('success_msg', 'User created successfully.');
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to create user.');
        res.redirect('/admin/dashboard');
    }
};