const express = require('express');
const router = express.Router();
const { createUser, approveUser, rejectUser, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

router.post('/create', protect, checkRole('Admin', 'Manager'), createUser);
router.post('/approve/:id', protect, checkRole('Admin', 'Manager'), approveUser);
router.post('/reject/:id', protect, checkRole('Admin', 'Manager'), rejectUser);
router.post('/delete/:id', protect, checkRole('Admin', 'Manager'), deleteUser);

module.exports = router;
