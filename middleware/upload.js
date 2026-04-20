const multer = require('multer');
const fs = require('fs');

const dir = 'uploads/guardianIds/';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const userId = req.user?.id; // or req.user.userId depending on your setup
        const ext = file.originalname.split('.').pop();

        const filename = `${userId}-guardianId-${Date.now()}.${ext}`;
        cb(null, filename);
    }
});

module.exports = multer({ storage });