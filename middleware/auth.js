const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.protect = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error_msg', 'Not authorized, please log in');
        res.redirect('/auth/login');
    }
};