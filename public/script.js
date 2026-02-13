// TAB SWITCHING
document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
});

// FILE UPLOAD LOGIC
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('file-name').innerText = file.name;
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('upload-options').classList.remove('hidden');
        uploadBtn.classList.remove('hidden');
    }
});
uploadBtn.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('password', document.getElementById('file-password').value);
    formData.append('expiry', document.getElementById('expiry-time').value);

    uploadBtn.classList.add('hidden');
    document.getElementById('progress-container').classList.remove('hidden');
    const pText = document.getElementById('progress-text');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload');

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 100);
            document.getElementById('progress').style.width = p + '%';
            if (p === 100) {
                pText.innerText = "> Finalizing... Please wait.";
            } else {
                pText.innerText = `> Uploading... ${p}%`;
            }
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const res = JSON.parse(xhr.responseText);
            document.getElementById('share-code').innerText = res.code;
            document.getElementById('qr-code').src = res.qrCode;
            document.getElementById('upload-section').classList.add('hidden');
            document.getElementById('code-section').classList.remove('hidden');
        } else {
            alert("Upload Failed: " + xhr.statusText);
            resetUpload(); // Make sure you have this function to reset the UI
        }
    };

    xhr.onerror = () => {
        alert("Connection Lost. Check your internet.");
        resetUpload();
    };

    xhr.send(formData);
});
// SOCIAL DOWNLOAD LOGIC
const fetchBtn = document.getElementById('fetch-btn');
fetchBtn.addEventListener('click', async () => {
    const url = document.getElementById('social-url').value;
    if (!url) return;

    document.getElementById('social-loading').classList.remove('hidden');
    document.getElementById('social-result').classList.add('hidden');
    document.getElementById('social-error').classList.add('hidden');

    try {
        const res = await fetch('/api/social-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('result-title').innerText = data.title;
            document.getElementById('result-thumbnail').src = data.thumbnail;
            const container = document.getElementById('download-options');
            container.innerHTML = '';
            data.medias.forEach(m => {
                const div = document.createElement('div');
                div.className = 'download-link';
                div.innerHTML = `<span>${m.quality} (${m.extension})</span><a href="${m.url}" target="_blank">SAVE</a>`;
                container.appendChild(div);
            });
            document.getElementById('social-result').classList.remove('hidden');
        } else {
            throw new Error();
        }
    } catch (e) {
        document.getElementById('social-error').classList.remove('hidden');
    } finally {
        document.getElementById('social-loading').classList.add('hidden');
    }
});