// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFile = document.getElementById('remove-file');
const uploadOptions = document.getElementById('upload-options');
const uploadBtn = document.getElementById('upload-btn');
const progressContainer = document.getElementById('progress-container');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const uploadSection = document.getElementById('upload-section');
const codeSection = document.getElementById('code-section');
const shareCode = document.getElementById('share-code');
const qrCode = document.getElementById('qr-code');
const copyBtn = document.getElementById('copy-btn');
const newUpload = document.getElementById('new-upload');
const codeInput = document.getElementById('code-input');
const checkBtn = document.getElementById('check-btn');
const downloadInfo = document.getElementById('download-info');
const downloadName = document.getElementById('download-name');
const downloadSize = document.getElementById('download-size');
const downloadStats = document.getElementById('download-stats');
const downloadBtn = document.getElementById('download-btn');
const downloadError = document.getElementById('download-error');
const passwordNotice = document.getElementById('password-notice');
const passwordInputContainer = document.getElementById('password-input-container');
const downloadPassword = document.getElementById('download-password');
const expireText = document.getElementById('expire-text');
const downloadCount = document.getElementById('download-count');
const filePassword = document.getElementById('file-password');
const expiryTime = document.getElementById('expiry-time');

let selectedFile = null;
let currentFileNeedsPassword = false;

// Format file size
function formatSize(bytes) {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB', 'GB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle drag & drop
dropZone.addEventListener('dragover', (e) => {
e.preventDefault();
dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
e.preventDefault();
dropZone.classList.remove('drag-over');
const file = e.dataTransfer.files[0];
if (file) handleFileSelect(file);
});

// Handle file input
fileInput.addEventListener('change', (e) => {
const file = e.target.files[0];
if (file) handleFileSelect(file);
});

// Handle file selection
function handleFileSelect(file) {
selectedFile = file;
fileName.textContent = file.name;
fileSize.textContent = formatSize(file.size);
dropZone.classList.add('hidden');
fileInfo.classList.remove('hidden');
uploadOptions.classList.remove('hidden');
uploadBtn.classList.remove('hidden');
}

// Remove selected file
removeFile.addEventListener('click', () => {
resetUpload();
});

// Upload file
uploadBtn.addEventListener('click', async () => {
if (!selectedFile) return;

const formData = new FormData();
formData.append('file', selectedFile);
formData.append('password', filePassword.value);
formData.append('expiry', expiryTime.value);

uploadBtn.classList.add('hidden');
uploadOptions.classList.add('hidden');
progressContainer.classList.remove('hidden');

try {
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener('progress', (e) => {
if (e.lengthComputable) {
const percent = Math.round((e.loaded / e.total) * 100);
progress.style.width = percent + '%';
progressText.textContent = `> Uploading... ${percent}%`;
}
});

xhr.addEventListener('load', () => {
if (xhr.status === 200) {
const response = JSON.parse(xhr.responseText);
shareCode.textContent = response.code;
qrCode.src = response.qrCode;
expireText.textContent = `Self-destructs in ${response.expiresIn}`;
downloadCount.textContent = 'Downloads: 0';

if (response.passwordProtected) {
passwordNotice.classList.remove('hidden');
} else {
passwordNotice.classList.add('hidden');
}

uploadSection.classList.add('hidden');
codeSection.classList.remove('hidden');
} else {
alert('Upload failed. Please try again.');
resetUpload();
}
});

xhr.addEventListener('error', () => {
alert('Upload failed. Please try again.');
resetUpload();
});

xhr.open('POST', '/upload');
xhr.send(formData);
} catch (error) {
alert('Upload failed. Please try again.');
resetUpload();
}
});

// Reset upload section
function resetUpload() {
selectedFile = null;
fileInput.value = '';
filePassword.value = '';
expiryTime.value = '24';
dropZone.classList.remove('hidden');
fileInfo.classList.add('hidden');
uploadOptions.classList.add('hidden');
uploadBtn.classList.add('hidden');
progressContainer.classList.add('hidden');
progress.style.width = '0%';
}

// Copy code
copyBtn.addEventListener('click', () => {
navigator.clipboard.writeText(shareCode.textContent);
copyBtn.textContent = '[COPIED!]';
setTimeout(() => {
copyBtn.textContent = '[COPY]';
}, 2000);
});

// New upload
newUpload.addEventListener('click', () => {
resetUpload();
codeSection.classList.add('hidden');
uploadSection.classList.remove('hidden');
});

// Check file
checkBtn.addEventListener('click', async () => {
const code = codeInput.value.trim();
if (code.length !== 6) {
downloadError.textContent = '> ERROR: Please enter a 6-digit code';
downloadError.classList.remove('hidden');
downloadInfo.classList.add('hidden');
return;
}

try {
const response = await fetch(`/info/${code}`);

if (response.ok) {
const data = await response.json();
downloadName.textContent = data.name;
downloadSize.textContent = formatSize(data.size);
downloadStats.textContent = `⬇️ ${data.downloads} downloads • ⏱️ Expires in ${data.expiresIn}`;
downloadInfo.classList.remove('hidden');
downloadError.classList.add('hidden');

currentFileNeedsPassword = data.passwordProtected;
if (data.passwordProtected) {
passwordInputContainer.classList.remove('hidden');
} else {
passwordInputContainer.classList.add('hidden');
}
} else {
downloadError.textContent = '> ERROR: File not found or expired';
downloadError.classList.remove('hidden');
downloadInfo.classList.add('hidden');
}
} catch (error) {
downloadError.textContent = '> ERROR: Connection failed';
downloadError.classList.remove('hidden');
downloadInfo.classList.add('hidden');
}
});

// Download file
downloadBtn.addEventListener('click', async () => {
const code = codeInput.value.trim();

if (currentFileNeedsPassword) {
const password = downloadPassword.value;
if (!password) {
downloadError.textContent = '> ERROR: Password required';
downloadError.classList.remove('hidden');
return;
}

try {
const response = await fetch(`/download/${code}`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ password })
});

if (response.ok) {
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = downloadName.textContent;
a.click();
downloadError.classList.add('hidden');
} else {
const data = await response.json();
downloadError.textContent = `> ERROR: ${data.error}`;
downloadError.classList.remove('hidden');
}
} catch (error) {
downloadError.textContent = '> ERROR: Download failed';
downloadError.classList.remove('hidden');
}
} else {
window.location.href = `/download/${code}`;
}
});

// Only allow numbers in code input
codeInput.addEventListener('input', (e) => {
e.target.value = e.target.value.replace(/[^0-9]/g, '');
downloadError.classList.add('hidden');
});

// Enter key for search
codeInput.addEventListener('keypress', (e) => {
if (e.key === 'Enter') checkBtn.click();
});

// ═══════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
tab.addEventListener('click', () => {
// Remove active from all
tabs.forEach(t => t.classList.remove('active'));
tabContents.forEach(c => c.classList.remove('active'));

// Add active to clicked
tab.classList.add('active');
const tabId = tab.dataset.tab + '-tab';
document.getElementById(tabId).classList.add('active');
});
});

// ═══════════════════════════════════════
// SOCIAL MEDIA DOWNLOADER
// ═══════════════════════════════════════

const socialUrl = document.getElementById('social-url');
const fetchBtn = document.getElementById('fetch-btn');
const socialLoading = document.getElementById('social-loading');
const socialResult = document.getElementById('social-result');
const socialError = document.getElementById('social-error');
const platformIcon = document.getElementById('platform-icon');
const resultPlatform = document.getElementById('result-platform');
const resultTitle = document.getElementById('result-title');
const resultThumbnail = document.getElementById('result-thumbnail');
const downloadOptions = document.getElementById('download-options');

const platformIcons = {
'Instagram': '📸',
'TikTok': '🎵',
'Twitter/X': '🐦',
'YouTube': '📺',
'Facebook': '📘',
'Pinterest': '📌',
'Reddit': '🤖',
'LinkedIn': '💼',
'Unknown': '🔗'
};

fetchBtn.addEventListener('click', fetchMedia);
socialUrl.addEventListener('keypress', (e) => {
if (e.key === 'Enter') fetchMedia();
});

async function fetchMedia() {
const url = socialUrl.value.trim();

if (!url) {
socialError.textContent = '> ERROR: Please enter a URL';
socialError.classList.remove('hidden');
return;
}

// Reset
socialResult.classList.add('hidden');
socialError.classList.add('hidden');
socialLoading.classList.remove('hidden');

try {
const response = await fetch('/api/social-download', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url })
});

const data = await response.json();

if (response.ok && data.success) {
displayResult(data);
} else {
socialError.textContent = '> ERROR: ' + (data.error || 'Could not fetch media');
socialError.classList.remove('hidden');
}
} catch (error) {
socialError.textContent = '> ERROR: Connection failed';
socialError.classList.remove('hidden');
} finally {
socialLoading.classList.add('hidden');
}
}

function displayResult(data) {
    // ... existing code ...
    downloadOptions.innerHTML = '';

    data.medias.forEach((item, index) => {
        const quality = item.quality || item.label || `Option ${index + 1}`;
        const ext = item.extension || 'MP4';
        
        const linkEl = document.createElement('div');
        linkEl.className = 'download-link';
        linkEl.innerHTML = `
            <div>
                <span class="quality">${quality.toUpperCase()}</span>
                <span class="size"> • ${ext.toUpperCase()}</span>
            </div>
            <a href="${item.url}" target="_blank" rel="noopener">Download</a>
        `;
        downloadOptions.appendChild(linkEl);
    });
    // ... existing code ...
}