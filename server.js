const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// YOUR RAPIDAPI KEY (replace with your real one)
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
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// MIDDLEWARE
app.use(cors({ origin: '*', credentials: true }));
app.use(express.static('public'));
app.use(express.json());

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== FILE UPLOAD =====
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

        // Auto-delete after expiry
        setTimeout(() => {
            const file = fileStore.get(code);
            if (file) {
                const filePath = path.join(__dirname, 'uploads', file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                fileStore.delete(code);
                console.log(`[CLEANUP] File ${code} expired and deleted`);
            }
        }, expiryHours * 60 * 60 * 1000);

        return res.status(200).json({
            code,
            expiresIn: expiryHours + 'h',
            passwordProtected: !!password,
            qrCode
        });
    } catch (e) {
        console.error('[UPLOAD ERROR]', e);
        res.status(500).json({ error: 'Server Error' });
    }
});

// ===== DOWNLOAD ENDPOINT (FIXED) =====
app.post('/download/:code', (req, res) => {
    const { code } = req.params;
    const fileData = fileStore.get(code);

    // File not found or expired
    if (!fileData) {
        return res.status(404).json({ error: 'File not found. Check your code.' });
    }

    if (Date.now() > fileData.expiresAt) {
        // Clean up expired file
        const filePath = path.join(__dirname, 'uploads', fileData.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        fileStore.delete(code);
        return res.status(404).json({ error: 'File has expired.' });
    }

    // Password check - FIXED: use "requiresPassword" to match frontend
    if (fileData.password) {
        // No password provided or wrong password
        if (!req.body.password) {
            return res.status(401).json({ 
                requiresPassword: true, 
                error: 'This file requires a password' 
            });
        }
        if (fileData.password !== req.body.password) {
            return res.status(401).json({ 
                requiresPassword: true, 
                error: 'Wrong password. Try again.' 
            });
        }
    }

    // File exists check
    const filePath = path.join(__dirname, 'uploads', fileData.filename);
    if (!fs.existsSync(filePath)) {
        fileStore.delete(code);
        return res.status(404).json({ error: 'File no longer exists on server.' });
    }

    // Track downloads
    fileData.downloads++;

    // Send file
    res.download(filePath, fileData.originalName, (err) => {
        if (err) {
            console.error('[DOWNLOAD ERROR]', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        } else {
            console.log(`[DOWNLOAD] Code ${code} downloaded (${fileData.downloads} times)`);
        }
    });
});

// Also support GET for direct browser access / QR code links
app.get('/download/:code', (req, res) => {
    const { code } = req.params;
    const fileData = fileStore.get(code);

    if (!fileData) {
        return res.status(404).send('File not found. Check your code.');
    }

    if (Date.now() > fileData.expiresAt) {
        const filePath = path.join(__dirname, 'uploads', fileData.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        fileStore.delete(code);
        return res.status(404).send('File has expired.');
    }

    // If password protected, redirect to the main page receive tab
    if (fileData.password) {
        return res.redirect(`/?code=${code}`);
    }

    // No password - direct download
    const filePath = path.join(__dirname, 'uploads', fileData.filename);
    if (!fs.existsSync(filePath)) {
        fileStore.delete(code);
        return res.status(404).send('File no longer exists.');
    }

    fileData.downloads++;
    res.download(filePath, fileData.originalName);
});

// ===== SOCIAL MEDIA DOWNLOADER (FIXED WITH FALLBACKS) =====
app.post('/api/social-download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'No URL provided' });
    }

    console.log(`[SOCIAL] Fetching: ${url}`);

    // ===== TRY METHOD 1: RapidAPI Social Download =====
    try {
        const response = await axios.post(
            'https://social-download-all-in-one.p.rapidapi.com/v1/social/autodownload',
            { url: url },
            {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'social-download-all-in-one.p.rapidapi.com',
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('[SOCIAL] RapidAPI response status:', response.status);
        console.log('[SOCIAL] RapidAPI response data keys:', Object.keys(response.data || {}));

        if (response.data && response.data.medias && response.data.medias.length > 0) {
            return res.json({
                success: true,
                platform: response.data.source || detectPlatform(url),
                title: response.data.title || 'Download Ready',
                thumbnail: response.data.thumbnail || response.data.picture || null,
                medias: response.data.medias.map(m => ({
                    url: m.url,
                    quality: m.quality || 'Download',
                    extension: m.extension || 'mp4',
                    type: m.type || 'video'
                }))
            });
        }

        console.log('[SOCIAL] RapidAPI returned no medias, trying fallback...');

    } catch (rapidApiError) {
        console.error('[SOCIAL] RapidAPI failed:', rapidApiError.response?.status, rapidApiError.response?.data || rapidApiError.message);
    }

    // ===== TRY METHOD 2: Cobalt API (FREE, no key needed) =====
    try {
        console.log('[SOCIAL] Trying Cobalt API...');
        
        const cobaltResponse = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            vCodec: 'h264',
            vQuality: '720',
            aFormat: 'mp3',
            isAudioOnly: false,
            isNoTTWatermark: true,
            isTTFullAudio: true
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 30000
        });

        const cobaltData = cobaltResponse.data;
        console.log('[SOCIAL] Cobalt response status:', cobaltData.status);

        if (cobaltData.status === 'stream' || cobaltData.status === 'redirect') {
            return res.json({
                success: true,
                title: 'Video Download',
                thumbnail: '',
                platform: detectPlatform(url),
                medias: [{
                    url: cobaltData.url,
                    quality: '720p',
                    extension: 'mp4',
                    type: 'video'
                }]
            });
        }

        if (cobaltData.status === 'picker' && cobaltData.picker) {
            return res.json({
                success: true,
                title: 'Media Download',
                thumbnail: cobaltData.picker[0]?.thumb || '',
                platform: detectPlatform(url),
                medias: cobaltData.picker.map((item, i) => ({
                    url: item.url,
                    quality: item.type === 'video' ? `Video ${i + 1}` : `Photo ${i + 1}`,
                    extension: item.type === 'video' ? 'mp4' : 'jpg',
                    type: item.type || 'video'
                }))
            });
        }

        console.log('[SOCIAL] Cobalt returned unexpected:', cobaltData);

    } catch (cobaltError) {
        console.error('[SOCIAL] Cobalt failed:', cobaltError.response?.status, cobaltError.response?.data || cobaltError.message);
    }

    // ===== TRY METHOD 3: Alternative RapidAPI endpoint =====
    try {
        console.log('[SOCIAL] Trying alternative API...');
        
        const altResponse = await axios.get(
            `https://all-media-downloader.p.rapidapi.com/download`,
            {
                params: { url: url },
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'all-media-downloader.p.rapidapi.com'
                },
                timeout: 30000
            }
        );

        if (altResponse.data) {
            const data = altResponse.data;
            let medias = [];

            // Handle different response formats
            if (data.url) {
                medias.push({ url: data.url, quality: 'Download', extension: 'mp4', type: 'video' });
            }
            if (data.medias && Array.isArray(data.medias)) {
                medias = data.medias.map(m => ({
                    url: m.url || m.link,
                    quality: m.quality || 'Download',
                    extension: m.extension || 'mp4',
                    type: m.type || 'video'
                }));
            }
            if (data.links && Array.isArray(data.links)) {
                medias = data.links.map((link, i) => ({
                    url: link.url || link.link || link,
                    quality: link.quality || `Quality ${i + 1}`,
                    extension: link.extension || 'mp4',
                    type: 'video'
                }));
            }

            if (medias.length > 0) {
                return res.json({
                    success: true,
                    title: data.title || 'Download Ready',
                    thumbnail: data.thumbnail || '',
                    platform: detectPlatform(url),
                    medias: medias
                });
            }
        }

    } catch (altError) {
        console.error('[SOCIAL] Alt API failed:', altError.response?.status || altError.message);
    }

    // ALL METHODS FAILED
    console.error('[SOCIAL] All download methods failed for:', url);
    return res.status(500).json({
        success: false,
        error: 'Could not fetch download links. The video may be private, or the URL is not supported. Try a different URL.'
    });
});

// Helper function
function detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('tiktok.com')) return 'TikTok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('pinterest.com')) return 'Pinterest';
    if (url.includes('vimeo.com')) return 'Vimeo';
    return 'Media';
}

// ===== FILE INFO ENDPOINT (optional - useful for checking before download) =====
app.get('/api/file-info/:code', (req, res) => {
    const { code } = req.params;
    const fileData = fileStore.get(code);

    if (!fileData || Date.now() > fileData.expiresAt) {
        return res.status(404).json({ error: 'File not found or expired' });
    }

    res.json({
        fileName: fileData.originalName,
        size: fileData.size,
        hasPassword: !!fileData.password,
        downloads: fileData.downloads,
        expiresAt: fileData.expiresAt
    });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        files: fileStore.size,
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 GATECORP LIVE at http://localhost:${PORT}`);
});