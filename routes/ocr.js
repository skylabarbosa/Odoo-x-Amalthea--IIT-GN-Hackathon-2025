const express = require('express');
const router = express.Router();
const { processReceipt } = require('../controllers/ocrController');
const upload = require('../middleware/upload'); // Re-using the upload middleware
const { protect } = require('../middleware/auth');

router.post('/upload', protect, upload, processReceipt);

module.exports = router;