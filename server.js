const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const fileStore = new Map();

if (!fs.existsSync('uploads')) {
fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
destination: 'uploads/',
filename: (req, file, cb) => {
const uniqueName = uuidv4() + path.extname(file.originalname);
cb(null, uniqueName);
}
});

const upload = multer({
storage,
limits: { fileSize: 2 * 1024 * 1024 * 1024 }
});

app.use(express.static('public'));
app.use(express.json());

function generateCode() {
return Math.floor(100000 + Math.random() * 900000).toString();
}

// Upload with password & custom expiry
app.post('/upload', upload.single('file'), async (req, res) => {
if (!req.file) {
return res.status(400).json({ error: 'No file uploaded' });
}

const code = generateCode();
const password = req.body.password || null;
const expiryHours = parseInt(req.body.expiry) || 24;

const fileData = {
originalName: req.file.originalname,
filename: req.file.filename,
size: req.file.size,
password: password,
downloads: 0,
uploadedAt: Date.now(),
expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
expiryHours: expiryHours
};

fileStore.set(code, fileData);

// Generate QR Code
const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
const qrCode = await QRCode.toDataURL(downloadUrl);

// Auto-delete after expiry
setTimeout(() => {
const file = fileStore.get(code);
if (file) {
fs.unlink(path.join('uploads', file.filename), () => {});
fileStore.delete(code);
}
}, expiryHours * 60 * 60 * 1000);

res.json({
code,
expiresIn: expiryHours + ' hours',
passwordProtected: !!password,
qrCode: qrCode
});
});

// Check file info
app.get('/info/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);

if (!fileData) {
return res.status(404).json({ error: 'File not found or expired' });
}

const timeLeft = Math.max(0, fileData.expiresAt - Date.now());
const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

res.json({
name: fileData.originalName,
size: fileData.size,
downloads: fileData.downloads,
passwordProtected: !!fileData.password,
expiresIn: `${hoursLeft}h ${minsLeft}m`,
expiresAt: fileData.expiresAt
});
});

// Download with password check
app.post('/download/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);

if (!fileData) {
return res.status(404).json({ error: 'File not found or expired' });
}

if (fileData.password && fileData.password !== req.body.password) {
return res.status(401).json({ error: 'Wrong password' });
}

fileData.downloads++;

const filePath = path.join(__dirname, 'uploads', fileData.filename);
res.download(filePath, fileData.originalName);
});

// Direct download (for non-password files)
app.get('/download/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);

if (!fileData) {
return res.status(404).json({ error: 'File not found or expired' });
}

if (fileData.password) {
return res.status(401).json({ error: 'Password required', needsPassword: true });
}

fileData.downloads++;

const filePath = path.join(__dirname, 'uploads', fileData.filename);
res.download(filePath, fileData.originalName);
});

// Get QR code for existing file
app.get('/qr/:code', async (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);

if (!fileData) {
return res.status(404).json({ error: 'File not found' });
}

const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
const qrCode = await QRCode.toDataURL(downloadUrl);

res.json({ qrCode });
});

app.listen(PORT, () => {
console.log(`🚀 GATECORP running at http://localhost:${PORT}`);
});