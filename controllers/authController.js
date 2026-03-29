const User = require('../models/User');
const Company = require('../models/Company');
const countryCurrencyUtil = require('../utils/countryCurrency');

// @desc    Show signup page
// @route   GET /auth/signup
exports.showSignup = (req, res) => {
    res.render('signup');
};

// @desc    Register a new user and company
// @route   POST /auth/signup
exports.signup = async (req, res) => {
    const { name, email, password, companyName, country, currency } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error_msg', 'User already exists');
            return res.redirect('/auth/signup');
        }

        let resolvedCurrency = currency;
        if (!resolvedCurrency && country) {
            resolvedCurrency = await countryCurrencyUtil.getCurrencyByCountry(country);
        }
        if (!resolvedCurrency) {
            req.flash('error_msg', 'Could not determine currency for the selected country.');
            return res.redirect('/auth/signup');
        }

        const company = new Company({
            name: companyName,
            defaultCurrency: resolvedCurrency
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

// @desc    Show access request page
// @route   GET /auth/request-access
exports.showRequestAccess = (req, res) => {
    res.render('request-access');
};

// @desc    Request access as Employee or Manager
// @route   POST /auth/request-access
exports.requestAccess = async (req, res) => {
    const { name, email, password, role, managerEmail, adminEmail, companyName } = req.body;

    try {
        if (!role || !['Employee', 'Manager'].includes(role)) {
            req.flash('error_msg', 'Please select a valid role.');
            return res.redirect('/auth/request-access');
        }

        const existing = await User.findOne({ email });
        if (existing) {
            req.flash('error_msg', 'User already exists.');
            return res.redirect('/auth/request-access');
        }

        if (role === 'Employee') {
            if (!managerEmail || !companyName) {
                req.flash('error_msg', 'Manager email and company name are required.');
                return res.redirect('/auth/request-access');
            }

            const managerAny = await User.findOne({ email: managerEmail, role: 'Manager', isActive: true });
            if (!managerAny) {
                req.flash('error_msg', 'Manager not found. Please check the email.');
                return res.redirect('/auth/request-access');
            }

            if (managerAny.status !== 'Approved') {
                req.flash('error_msg', 'Manager exists but is pending approval. Please wait or contact admin.');
                return res.redirect('/auth/request-access');
            }

            const manager = managerAny;

            const company = await Company.findById(manager.company).select('name');
            if (!company || company.name.toLowerCase() !== companyName.trim().toLowerCase()) {
                req.flash('error_msg', 'Company name does not match the manager.');
                return res.redirect('/auth/request-access');
            }

            const employee = new User({
                name,
                email,
                password,
                role: 'Employee',
                company: manager.company,
                manager: manager._id,
                status: 'Pending'
            });
            await employee.save();
        }

        if (role === 'Manager') {
            if (!adminEmail) {
                req.flash('error_msg', 'Admin email is required.');
                return res.redirect('/auth/request-access');
            }

            const admin = await User.findOne({ email: adminEmail, role: 'Admin', status: 'Approved', isActive: true });
            if (!admin) {
                req.flash('error_msg', 'Admin not found or not approved.');
                return res.redirect('/auth/request-access');
            }

            const manager = new User({
                name,
                email,
                password,
                role: 'Manager',
                company: admin.company,
                status: 'Pending'
            });
            await manager.save();
        }

        req.flash('success_msg', 'Request submitted. Please wait for approval.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Server error');
        res.redirect('/auth/request-access');
    }
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

        if (!user.isActive) {
            req.flash('error_msg', 'Your account is inactive. Please contact admin.');
            return res.redirect('/auth/login');
        }

        if (user.status && user.status !== 'Approved') {
            req.flash('error_msg', 'Your account is pending approval.');
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
