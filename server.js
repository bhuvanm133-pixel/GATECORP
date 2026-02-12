const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ PASTE YOUR RAPIDAPI KEY HERE
const RAPIDAPI_KEY = '4c92037d6cmshfcb6b326ac154a1p148490jsn2ba7295c4b8e';

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

// ═══════════════════════════════════════
// 📤 FILE SHARING ENDPOINTS
// ═══════════════════════════════════════

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

const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
const qrCode = await QRCode.toDataURL(downloadUrl);

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

// ═══════════════════════════════════════
// 📥 SOCIAL MEDIA DOWNLOADER ENDPOINTS
// ═══════════════════════════════════════

app.post('/api/social-download', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // This API usually uses a POST request for 'autodownload'
    const response = await axios.post('https://social-download-all-in-one.p.rapidapi.com/v1/social/autodownload', 
    { 
      url: url 
    }, 
    {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY, 
        'X-RapidAPI-Host': 'social-download-all-in-one.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    console.log("Fetching media from:", url);

    // This API uses 'medias' to store the list of video/image links
    if (response.data && response.data.medias) {
      res.json({
        success: true,
        platform: response.data.source || "Media",
        title: response.data.title || 'Download Ready',
        thumbnail: response.data.thumbnail || null,
        medias: response.data.medias
      });
    } else {
      res.status(404).json({ error: 'No download links found. Make sure the link is public.' });
    }
  } catch (error) {
    console.error('Social download error:', error.response ? error.response.status : error.message);
    res.status(500).json({ error: 'Failed to fetch media. Please check your API subscription.' });
  }
});

function detectPlatform(url) {
if (url.includes('instagram.com')) return 'Instagram';
if (url.includes('tiktok.com')) return 'TikTok';
if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
if (url.includes('pinterest.com')) return 'Pinterest';
if (url.includes('reddit.com')) return 'Reddit';
if (url.includes('linkedin.com')) return 'LinkedIn';
return 'Unknown';
}

app.listen(PORT, () => {
console.log(`🚀 GATECORP running at http://localhost:${PORT}`);
});