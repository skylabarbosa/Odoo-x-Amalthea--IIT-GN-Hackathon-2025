const Tesseract = require('tesseract.js');

// @desc    Process a receipt image using OCR
// @route   POST /ocr/upload
exports.processReceipt = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const { data: { text } } = await Tesseract.recognize(
            req.file.path,
            'eng',
            { logger: m => console.log(m) } // Optional logger
        );

        // Basic parsing logic (can be greatly improved with regex, NLP)
        const amountMatch = text.match(/(\$|total|amount)[\s:]*(\d+\.\d{2})/i);
        const dateMatch = text.match(/\d{2}[-\/]\d{2}[-\/]\d{2,4}/);
        
        const extractedData = {
            rawText: text,
            amount: amountMatch ? parseFloat(amountMatch[2]) : null,
            date: dateMatch ? dateMatch[0] : null,
            description: "Parsed from receipt"
        };
        
        res.json(extractedData);

    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: 'Failed to process image with OCR.' });
    }
};