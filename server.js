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

// 📤 FILE SHARING ENDPOINTS
aapp.post('/upload', upload.single('file'), async (req, res) => {
    try {
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
            expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000)
        };

        fileStore.set(code, fileData);

        // Generate QR Code BEFORE sending response
        const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
        const qrCode = await QRCode.toDataURL(downloadUrl);

        // SET TIMEOUT for deletion
        setTimeout(() => {
            const file = fileStore.get(code);
            if (file) {
                const filePath = path.join(__dirname, 'uploads', file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error("Auto-delete error:", err);
                    });
                }
                fileStore.delete(code);
            }
        }, expiryHours * 60 * 60 * 1000);

        // SEND RESPONSE IMMEDIATELY
        return res.status(200).json({ 
            code, 
            expiresIn: expiryHours + ' hours', 
            passwordProtected: !!password, 
            qrCode 
        });

    } catch (error) {
        console.error("Upload Error:", error);
        return res.status(500).json({ error: "Server failed to process file" });
    }
});

app.get('/info/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);
if (!fileData) return res.status(404).json({ error: 'File not found' });
const timeLeft = Math.max(0, fileData.expiresAt - Date.now());
res.json({
name: fileData.originalName,
size: fileData.size,
downloads: fileData.downloads,
passwordProtected: !!fileData.password,
expiresIn: Math.floor(timeLeft / (1000 * 60 * 60)) + "h",
expiresAt: fileData.expiresAt
});
});

app.post('/download/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);
if (!fileData) return res.status(404).json({ error: 'Expired' });
if (fileData.password && fileData.password !== req.body.password) return res.status(401).json({ error: 'Wrong password' });
fileData.downloads++;
res.download(path.join(__dirname, 'uploads', fileData.filename), fileData.originalName);
});

app.get('/download/:code', (req, res) => {
const code = req.params.code;
const fileData = fileStore.get(code);
if (!fileData || fileData.password) return res.status(401).json({ error: 'Action denied' });
fileData.downloads++;
res.download(path.join(__dirname, 'uploads', fileData.filename), fileData.originalName);
});

// 📥 SOCIAL MEDIA DOWNLOADER (FIXED ENDPOINT)
app.post('/api/social-download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const response = await axios.post('https://social-download-all-in-one.p.rapidapi.com/v1/social/autodownload', 
        { url: url }, 
        {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'social-download-all-in-one.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.medias) {
            res.json({
                success: true,
                platform: response.data.source || "Media",
                title: response.data.title || 'Ready to Download',
                thumbnail: response.data.thumbnail || response.data.picture || null,
                medias: response.data.medias
            });
        } else {
            res.status(404).json({ error: 'Links not found. Is it a public post?' });
        }
    } catch (error) {
        console.error('API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch. Check your API subscription on RapidAPI.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 GATECORP LIVE at http://localhost:${PORT}`);
});