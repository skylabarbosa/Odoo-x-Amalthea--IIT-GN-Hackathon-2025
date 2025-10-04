const User = require('../models/user');
const Company = require('../models/company');
const countryCurrencyUtil = require('../utils/countryCurrency');

// @desc    Show signup page
// @route   GET /auth/signup
exports.showSignup = (req, res) => {
    res.render('signup');
};

// @desc    Register a new user and company
// @route   POST /auth/signup
exports.signup = async (req, res) => {
    const { name, email, password, companyName, country } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error_msg', 'User already exists');
            return res.redirect('/auth/signup');
        }

        const currency = await countryCurrencyUtil.getCurrencyByCountry(country);
        if (!currency) {
            req.flash('error_msg', 'Could not determine currency for the selected country.');
            return res.redirect('/auth/signup');
        }

        const company = new Company({
            name: companyName,
            defaultCurrency: currency
        });
        await company.save();

        user = new User({
            name,
            email,
            password,
            role: 'Admin',
            company: company._id
        });
        await user.save();
        
        req.flash('success_msg', 'You are now registered and can log in');
        res.redirect('/auth/login');

    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Server error');
        res.redirect('/auth/signup');
    }
};

// @desc    Show login page
// @route   GET /auth/login
exports.showLogin = (req, res) => {
    res.render('login');
};

// @desc    Authenticate user
// @route   POST /auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        // Set session
        req.session.user = {
            id: user._id,
            name: user.name,
            role: user.role,
            companyId: user.company
        };

        // Redirect based on role
        switch (user.role) {
            case 'Admin':
                res.redirect('/admin/dashboard');
                break;
            case 'Manager':
                res.redirect('/manager/dashboard');
                break;
            case 'Employee':
                res.redirect('/employee/dashboard');
                break;
            default:
                res.redirect('/auth/login');
        }
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Server error');
        res.redirect('/auth/login');
    }
};

// @desc    Logout user
// @route   GET /auth/logout
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Or handle error appropriately
        }
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
    });
};