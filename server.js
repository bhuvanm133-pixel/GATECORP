const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const axios = require('axios');
const cors = require('cors');  // ✅ FIXED - CORS IMPORT

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ YOUR RAPIDAPI KEY
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

// ✅ MIDDLEWARE - CORRECT ORDER
app.use(cors({ origin: '*', credentials: true }));
app.use(express.static('public'));
app.use(express.json());

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 📤 FILE UPLOAD (YOUR CODE - PERFECT)
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
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

        const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
        const qrCode = await QRCode.toDataURL(downloadUrl);

        setTimeout(() => {
            const file = fileStore.get(code);
            if (file) {
                const filePath = path.join(__dirname, 'uploads', file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                fileStore.delete(code);
            }
        }, expiryHours * 60 * 60 * 1000);

        return res.status(200).json({ 
            code, 
            expiresIn: expiryHours + 'h', 
            passwordProtected: !!password, 
            qrCode 
        });
    } catch (e) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ✅ DOWNLOAD ENDPOINT (THIS WAS MISSING - CAUSES 404)
app.post('/download/:code', (req, res) => {
    const { code } = req.params;
    const fileData = fileStore.get(code);
    
    if (!fileData || Date.now() > fileData.expiresAt) {
        return res.status(404).json({ error: 'File expired or not found' });
    }
    
    if (fileData.password && fileData.password !== req.body.password) {
        return res.json({ passwordRequired: true, error: 'Wrong password' });
    }
    
    const filePath = path.join(__dirname, 'uploads', fileData.filename);
    res.download(filePath, fileData.originalName);
});

// 📥 SOCIAL DOWNLOADER (YOUR CODE - PERFECT)
app.post('/api/social-download', async (req, res) => {
    const { url } = req.body;
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
                title: response.data.title || 'Download Ready',
                thumbnail: response.data.thumbnail || response.data.picture || null,
                medias: response.data.medias
            });
        } else {
            res.status(404).json({ error: 'Links not found.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 GATECORP LIVE at http://localhost:${PORT}`);
});
