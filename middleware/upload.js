const multer = require('multer');
const fs = require('fs');

const dir = 'uploads/guardianIds/';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

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
        const ext = file.originalname.split('.').pop();

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

module.exports = multer({ storage });