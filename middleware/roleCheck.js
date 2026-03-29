exports.checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user || !roles.includes(req.session.user.role)) {
            req.flash('error_msg', 'You do not have permission to view this page.');
            return res.redirect('/');
        }
        next();
    };
};