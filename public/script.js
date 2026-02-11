const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFile = document.getElementById('remove-file');
const uploadBtn = document.getElementById('upload-btn');
const progressContainer = document.getElementById('progress-container');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const uploadSection = document.getElementById('upload-section');
const codeSection = document.getElementById('code-section');
const shareCode = document.getElementById('share-code');
const copyBtn = document.getElementById('copy-btn');
const newUpload = document.getElementById('new-upload');
const codeInput = document.getElementById('code-input');
const downloadBtn = document.getElementById('download-btn');
const downloadInfo = document.getElementById('download-info');
const downloadName = document.getElementById('download-name');
const downloadSize = document.getElementById('download-size');
const downloadError = document.getElementById('download-error');

let selectedFile = null;

function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFileSelect(file);
});

function handleFileSelect(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatSize(file.size);
  dropZone.classList.add('hidden');
  fileInfo.classList.remove('hidden');
  uploadBtn.classList.remove('hidden');
}

removeFile.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  dropZone.classList.remove('hidden');
  fileInfo.classList.add('hidden');
  uploadBtn.classList.add('hidden');
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append('file', selectedFile);

  uploadBtn.classList.add('hidden');
  progressContainer.classList.remove('hidden');

  try {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progress.style.width = percent + '%';
        progressText.textContent = `Uploading... ${percent}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        shareCode.textContent = response.code;
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

function resetUpload() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.classList.remove('hidden');
  fileInfo.classList.add('hidden');
  uploadBtn.classList.add('hidden');
  progressContainer.classList.add('hidden');
  progress.style.width = '0%';
}

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareCode.textContent);
  copyBtn.textContent = '✅ Copied!';
  setTimeout(() => {
    copyBtn.textContent = '📋 Copy';
  }, 2000);
});

newUpload.addEventListener('click', () => {
  resetUpload();
  codeSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
});

downloadBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (code.length !== 6) {
    downloadError.textContent = 'Please enter a 6-digit code';
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
      downloadInfo.classList.remove('hidden');
      downloadError.classList.add('hidden');
      
      window.location.href = `/download/${code}`;
    } else {
      downloadError.textContent = 'File not found or expired';
      downloadError.classList.remove('hidden');
      downloadInfo.classList.add('hidden');
    }
  } catch (error) {
    downloadError.textContent = 'Error checking file';
    downloadError.classList.remove('hidden');
    downloadInfo.classList.add('hidden');
  }
});

codeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
  downloadError.classList.add('hidden');
});