const User = require('../models/User');

exports.protect = async (req, res, next) => {
    try {
        if (!req.session.user) {
            req.flash('error_msg', 'Not authorized, please log in');
            return res.redirect('/auth/login');
        }

        const user = await User.findById(req.session.user.id).select('name role company status isActive');
        if (!user || !user.isActive || (user.status && user.status !== 'Approved')) {
            req.session.destroy(() => {
                req.flash('error_msg', 'Your account is not active. Please contact admin.');
                return res.redirect('/auth/login');
            });
            return;
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            role: user.role,
            companyId: user.company
        };

        return next();
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Authentication failed. Please log in again.');
        return res.redirect('/auth/login');
    }
};
