const express = require('express');
const router = express.Router();
const { showSignup, signup, showLogin, login, logout, showRequestAccess, requestAccess } = require('../controllers/authController');

router.get('/signup', showSignup);
router.post('/signup', signup);
router.get('/login', showLogin);
router.post('/login', login);
router.get('/request-access', showRequestAccess);
router.post('/request-access', requestAccess);
router.get('/logout', logout);

module.exports = router;
