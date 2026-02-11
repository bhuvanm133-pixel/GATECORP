const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

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

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const code = generateCode();
  const fileData = {
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    uploadedAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
  };

  fileStore.set(code, fileData);

  setTimeout(() => {
    const file = fileStore.get(code);
    if (file) {
      fs.unlink(path.join('uploads', file.filename), () => {});
      fileStore.delete(code);
    }
  }, 24 * 60 * 60 * 1000);

  res.json({ code, expiresIn: '24 hours' });
});

app.get('/download/:code', (req, res) => {
  const code = req.params.code;
  const fileData = fileStore.get(code);

  if (!fileData) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  const filePath = path.join(__dirname, 'uploads', fileData.filename);
  res.download(filePath, fileData.originalName);
});

app.get('/info/:code', (req, res) => {
  const code = req.params.code;
  const fileData = fileStore.get(code);

  if (!fileData) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  res.json({
    name: fileData.originalName,
    size: fileData.size,
    expiresAt: fileData.expiresAt
  });
});

app.listen(PORT, () => {
  console.log('QuickShare running at http://localhost:' + PORT);
});