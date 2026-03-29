const express = require('express');
const router = express.Router();
const { 
    submitExpense,
    approveExpense,
    rejectExpense
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

const handleUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (!err) {
            return next();
        }
        let message = err.message || err;
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File too large. Max 10MB.';
        }
        req.flash('error_msg', message);
        return res.redirect('/employee/dashboard');
    });
};

router.post('/submit', protect, checkRole('Employee'), handleUpload, submitExpense);
router.post('/approve/:id', protect, checkRole('Manager', 'Admin'), approveExpense);
router.post('/reject/:id', protect, checkRole('Manager', 'Admin'), rejectExpense);


module.exports = router;
