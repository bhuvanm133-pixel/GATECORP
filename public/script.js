// ============================================
// GATECORP - script.js (Fixed & Complete)
// ============================================

// ===== TAB SWITCHING =====
function switchTab(tab, btnEl) {
    // Stop QR scanner when switching tabs
    if (qrScanner && isScannerActive) {
        stopScanner();
    }

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    document.getElementById(tab + '-section').classList.add('active');
    if (btnEl) {
        btnEl.classList.add('active');
    }
}

// ===== TOAST =====
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== FORMAT FILE SIZE =====
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ===== FILE UPLOAD =====
let selectedFile = null;
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        selectedFile = e.dataTransfer.files[0];
        showSelectedFile();
    }
});

// File input change
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        selectedFile = fileInput.files[0];
        showSelectedFile();
    }
});

function showSelectedFile() {
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
        showToast('File too large. Max 2GB.');
        removeFile();
        return;
    }
    document.getElementById('fileName').textContent = selectedFile.name;
    document.getElementById('fileSize').textContent = formatSize(selectedFile.size);
    document.getElementById('fileSelected').classList.add('show');
    dropZone.style.display = 'none';
    document.getElementById('uploadBtn').disabled = false;
}

function removeFile() {
    selectedFile = null;
    fileInput.value = '';
    document.getElementById('fileSelected').classList.remove('show');
    dropZone.style.display = 'block';
    document.getElementById('uploadBtn').disabled = true;
}

// ===== UPLOAD FILE =====
function uploadFile() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('password', document.getElementById('password').value);
    formData.append('expiry', document.getElementById('expiry').value);

    const xhr = new XMLHttpRequest();
    const progress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const uploadBtn = document.getElementById('uploadBtn');

    progress.classList.add('show');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = pct + '%';
            if (pct === 100) {
                progressText.textContent = 'Finalizing...';
            } else {
                progressText.textContent = pct + '%';
            }
        }
    });

    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            try {
                const data = JSON.parse(xhr.responseText);
                document.getElementById('resultCode').textContent = data.code;
                document.getElementById('resultExpiry').textContent = data.expiresIn || '24h';
                document.getElementById('resultPassword').textContent =
                    data.passwordProtected ? 'Protected' : 'No password';

                if (data.qrCode) {
                    document.getElementById('qrImage').src = data.qrCode;
                    document.getElementById('qrContainer').style.display = 'block';
                }

                document.getElementById('uploadResult').classList.add('show');
                showToast('File uploaded successfully!');
            } catch (e) {
                showToast('Upload succeeded but response was invalid.');
            }
        } else {
            showToast('Upload failed: ' + (xhr.statusText || 'Server error'));
        }
        progress.classList.remove('show');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Upload & Get Code';
    });

    xhr.addEventListener('error', () => {
        showToast('Upload failed. Check your connection.');
        progress.classList.remove('show');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Upload & Get Code';
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
}

// ===== COPY CODE =====
function copyCode() {
    const code = document.getElementById('resultCode').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Code copied!');
        }).catch(() => {
            fallbackCopy(code);
        });
    } else {
        fallbackCopy(code);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Code copied!');
    } catch (e) {
        showToast('Failed to copy');
    }
    document.body.removeChild(textArea);
}

// ===== CODE INPUTS (6-digit) =====
document.querySelectorAll('.code-input').forEach((input, i, inputs) => {
    input.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        if (val && i < inputs.length - 1) {
            inputs[i + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
            inputs[i - 1].focus();
        }
    });

    // Paste full code support
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().toUpperCase();
        if (pasteData.length >= 6) {
            inputs.forEach((inp, idx) => {
                inp.value = pasteData[idx] || '';
            });
            inputs[Math.min(pasteData.length - 1, 5)].focus();
        }
    });
});

// ===== QR CAMERA SCANNER =====
let qrScanner = null;
let isScannerActive = false;

function toggleScanner() {
    if (isScannerActive) {
        stopScanner();
    } else {
        startScanner();
    }
}

function startScanner() {
    const container = document.getElementById('qrScannerContainer');
    const scanBtn = document.getElementById('scanBtn');
    const statusEl = document.getElementById('scannerStatus');

    container.classList.add('show');
    scanBtn.classList.add('active');
    scanBtn.innerHTML = '<i class="fas fa-times"></i> Close Scanner';
    statusEl.textContent = 'Starting camera...';

    qrScanner = new Html5Qrcode("qr-reader");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    qrScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            onQRCodeScanned(decodedText);
        },
        (errorMessage) => {
            // Ignore - fires constantly while scanning
        }
    ).then(() => {
        isScannerActive = true;
        statusEl.textContent = 'Point your camera at the QR code';
    }).catch((err) => {
        console.error('Camera error:', err);
        statusEl.textContent = 'Camera access denied.';
        container.classList.remove('show');
        scanBtn.classList.remove('active');
        scanBtn.innerHTML = '<i class="fas fa-qrcode"></i> Open Camera Scanner';
        showToast('Could not access camera. Allow camera permission.');
    });
}

function stopScanner() {
    const container = document.getElementById('qrScannerContainer');
    const scanBtn = document.getElementById('scanBtn');

    if (qrScanner && isScannerActive) {
        qrScanner.stop().then(() => {
            qrScanner.clear();
            isScannerActive = false;
        }).catch(() => {
            isScannerActive = false;
        });
    }

    container.classList.remove('show');
    scanBtn.classList.remove('active');
    scanBtn.innerHTML = '<i class="fas fa-qrcode"></i> Open Camera Scanner';
}

function onQRCodeScanned(decodedText) {
    stopScanner();

    let code = decodedText.trim().toUpperCase();

    // If QR contains a URL like https://yoursite.com/download/ABC123
    const urlMatch = code.match(/\/download\/([A-Z0-9]{6})/i);
    if (urlMatch) {
        code = urlMatch[1].toUpperCase();
    }

    // Try to extract 6-char alphanumeric code
    if (code.length > 6) {
        const codeMatch = code.match(/[A-Z0-9]{6}/);
        if (codeMatch) {
            code = codeMatch[0];
        } else {
            code = code.substring(0, 6);
        }
    }

    if (code.length === 6) {
        // Fill code inputs
        const inputs = document.querySelectorAll('.code-input');
        inputs.forEach((input, idx) => {
            input.value = code[idx] || '';
        });

        showToast('QR scanned: ' + code);

        // Auto-download after short delay
        setTimeout(() => {
            receiveFile();
        }, 500);
    } else {
        showToast('Invalid QR code format');
    }
}

// ===== RECEIVE / DOWNLOAD FILE =====
function receiveFile() {
    const inputs = document.querySelectorAll('.code-input');
    let code = '';
    inputs.forEach(input => {
        code += input.value;
    });
    code = code.trim().toUpperCase();

    if (code.length !== 6) {
        showToast('Please enter the full 6-digit code');
        return;
    }

    const password = document.getElementById('receivePassword').value;
    const receiveBtn = document.getElementById('receiveBtn');
    const loader = document.getElementById('receiveLoader');

    receiveBtn.disabled = true;
    receiveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    loader.classList.add('show');

    fetch(`/download/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
    })
    .then(res => {
        const contentType = res.headers.get('content-type') || '';

        if (res.ok) {
            // JSON response = needs password or has download URL
            if (contentType.includes('application/json')) {
                return res.json().then(data => {
                    if (data.requiresPassword) {
                        document.getElementById('receivePasswordGroup').style.display = 'block';
                        showToast('This file requires a password');
                    } else if (data.error) {
                        showToast(data.error);
                    } else if (data.downloadUrl) {
                        // Server gave a direct download URL
                        triggerDownloadFromUrl(data.downloadUrl, data.fileName || 'download');
                        showToast('Download started!');
                    }
                });
            }

            // Binary file response - download as blob
            const disposition = res.headers.get('content-disposition');
            let filename = 'download';
            if (disposition) {
                // Try filename*= first (RFC 5987)
                let matches = disposition.match(/filename\*=(?:UTF-8''|utf-8'')(.+?)(?:;|$)/i);
                if (matches) {
                    filename = decodeURIComponent(matches[1]);
                } else {
                    // Try regular filename=
                    matches = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (matches && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }
            }

            return res.blob().then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();

                // Cleanup after delay
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 1000);

                showToast('Download started!');
            });
        } else {
            // Error responses
            if (contentType.includes('application/json')) {
                return res.json().then(data => {
                    if (data.requiresPassword) {
                        document.getElementById('receivePasswordGroup').style.display = 'block';
                        showToast('This file requires a password');
                    } else {
                        showToast(data.error || data.message || 'Download failed');
                    }
                });
            } else {
                return res.text().then(text => {
                    showToast(text || 'Invalid code or file expired');
                });
            }
        }
    })
    .catch(err => {
        console.error('Download error:', err);
        showToast('Download failed. Check your connection.');
    })
    .finally(() => {
        receiveBtn.disabled = false;
        receiveBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
        loader.classList.remove('show');
    });
}

// Helper to trigger download from URL
function triggerDownloadFromUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
    }, 1000);
}

// ===== SOCIAL MEDIA DOWNLOAD =====
function socialDownload() {
    const url = document.getElementById('socialUrl').value.trim();

    if (!url) {
        showToast('Paste a video URL first');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('Enter a valid URL starting with http:// or https://');
        return;
    }

    const loader = document.getElementById('socialLoader');
    const result = document.getElementById('socialResult');
    const errorEl = document.getElementById('socialError');
    const fetchBtn = document.getElementById('socialFetchBtn');

    loader.classList.add('show');
    result.classList.remove('show');
    errorEl.classList.remove('show');
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';

    fetch('/api/social-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Server returned ' + res.status);
        }
        return res.json();
    })
    .then(data => {
        if (data.success && data.medias && data.medias.length > 0) {
            document.getElementById('socialTitle').textContent = data.title || 'Video';
            document.getElementById('socialPlatform').textContent = data.platform || detectPlatform(url);

            const thumb = document.getElementById('socialThumb');
            if (data.thumbnail) {
                thumb.src = data.thumbnail;
                thumb.style.display = 'block';
            } else {
                thumb.style.display = 'none';
            }

            const mediaList = document.getElementById('mediaList');
            mediaList.innerHTML = '';

            data.medias.forEach(media => {
                const item = document.createElement('div');
                item.className = 'media-item';
                item.innerHTML = `
                    <div class="media-info">
                        <span class="media-quality">${media.quality || 'Download'}</span>
                        <span class="media-type">${media.extension || media.type || ''}</span>
                    </div>
                    <a href="${media.url}" target="_blank" rel="noopener" class="media-download" download>
                        <i class="fas fa-download"></i> Download
                    </a>
                `;
                mediaList.appendChild(item);
            });

            result.classList.add('show');
        } else {
            const errMsg = data.error || 'No download links found. Try a different URL.';
            document.getElementById('socialErrorText').textContent = errMsg;
            errorEl.classList.add('show');
        }
    })
    .catch(err => {
        console.error('Social download error:', err);
        document.getElementById('socialErrorText').textContent =
            'Failed to fetch download links. Make sure the server is running and /api/social-download endpoint works.';
        errorEl.classList.add('show');
    })
    .finally(() => {
        loader.classList.remove('show');
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = '<i class="fas fa-search"></i> Fetch';
    });
}

// Detect platform from URL
function detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('tiktok.com')) return 'TikTok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('pinterest.com')) return 'Pinterest';
    if (url.includes('vimeo.com')) return 'Vimeo';
    if (url.includes('dailymotion.com')) return 'Dailymotion';
    return 'Media';
}

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
    if (qrScanner && isScannerActive) {
        qrScanner.stop().catch(() => {});
    }
});