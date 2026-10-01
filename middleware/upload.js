const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dir = 'uploads/';

        if (file.fieldname === 'guardianId') {
            dir += 'guardianIds/';
        } else if (file.fieldname === 'discountId') {
            dir += 'discountIds/';
        } else {
            dir += 'misc/';
        }

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },

    filename: function (req, file, cb) {
        const userId = req.user?.id;

        const ext = file.originalname
            .split('.')
            .pop()
            .toLowerCase();

        const prefix =
            file.fieldname === 'guardianId'
                ? 'guardianId'
                : file.fieldname === 'discountId'
                ? 'discountId'
                : file.fieldname;

        const filename = `${userId}-${prefix}-${Date.now()}.${ext}`;

        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(
            'Invalid file type. Please upload a JPG, PNG, GIF, WEBP, or PDF.'
        ));
    }
};

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    },

    fileFilter: fileFilter
});

module.exports = upload;