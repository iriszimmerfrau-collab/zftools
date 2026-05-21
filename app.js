/* ========== TABS ========== */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/* ========== TOAST ========== */
function showToast(msg, isError = false) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ========== FILE CONVERTER ========== */
const converterFile = document.getElementById('converter-file');
const converterDrop = document.getElementById('converter-drop');
const converterFilename = document.getElementById('converter-filename');
const convertBtn = document.getElementById('convert-btn');
const outputFormat = document.getElementById('output-format');
let selectedFile = null;

document.getElementById('converter-browse').addEventListener('click', e => {
  e.stopPropagation();
  converterFile.click();
});
converterDrop.addEventListener('click', () => converterFile.click());

converterFile.addEventListener('change', e => {
  if (e.target.files[0]) handleConverterFile(e.target.files[0]);
});

['dragover', 'dragenter'].forEach(evt => {
  converterDrop.addEventListener(evt, e => { e.preventDefault(); converterDrop.classList.add('drag-over'); });
});
['dragleave', 'drop'].forEach(evt => {
  converterDrop.addEventListener(evt, e => { e.preventDefault(); converterDrop.classList.remove('drag-over'); });
});
converterDrop.addEventListener('drop', e => {
  if (e.dataTransfer.files[0]) handleConverterFile(e.dataTransfer.files[0]);
});

function handleConverterFile(file) {
  selectedFile = file;
  converterFilename.textContent = `${file.name} (${formatSize(file.size)})`;
  convertBtn.disabled = false;
  document.getElementById('converter-result').classList.add('hidden');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'gif', 'svg'];
const mediaFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mp4', 'webm', 'avi', 'mkv', 'mov'];

function getExt(name) {
  return name.split('.').pop().toLowerCase();
}

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  const target = outputFormat.value;
  const srcExt = getExt(selectedFile.name);

  const progressArea = document.getElementById('converter-progress');
  const resultArea = document.getElementById('converter-result');
  const fill = document.getElementById('converter-fill');
  const status = document.getElementById('converter-status');

  resultArea.classList.add('hidden');
  progressArea.classList.remove('hidden');
  fill.style.width = '10%';
  status.textContent = 'Processing...';
  convertBtn.disabled = true;

  try {
    let blob;
    const isImageSrc = imageFormats.includes(srcExt);
    const isImageDst = imageFormats.includes(target);
    const isMediaSrc = mediaFormats.includes(srcExt);
    const isMediaDst = mediaFormats.includes(target);

    if (isImageSrc && isImageDst && target !== 'gif') {
      fill.style.width = '30%';
      status.textContent = 'Converting image...';
      blob = await convertImageCanvas(selectedFile, target);
    } else if (isMediaSrc || isMediaDst || target === 'gif') {
      status.textContent = 'Loading FFmpeg (first time may take a moment)...';
      fill.style.width = '20%';
      blob = await convertWithFFmpeg(selectedFile, target, (p) => {
        fill.style.width = (20 + p * 70) + '%';
        status.textContent = `Converting... ${Math.round(p * 100)}%`;
      });
    } else if (target === 'txt') {
      fill.style.width = '50%';
      status.textContent = 'Extracting text...';
      const text = await selectedFile.text();
      blob = new Blob([text], { type: 'text/plain' });
    } else if (target === 'json') {
      fill.style.width = '50%';
      const text = await selectedFile.text();
      try {
        const parsed = JSON.parse(text);
        blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      } catch {
        blob = new Blob([JSON.stringify({ content: text })], { type: 'application/json' });
      }
    } else if (target === 'csv') {
      fill.style.width = '50%';
      const text = await selectedFile.text();
      blob = new Blob([text], { type: 'text/csv' });
    } else {
      status.textContent = 'Loading FFmpeg...';
      fill.style.width = '20%';
      blob = await convertWithFFmpeg(selectedFile, target, (p) => {
        fill.style.width = (20 + p * 70) + '%';
      });
    }

    fill.style.width = '100%';
    status.textContent = 'Done!';

    const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
    const downloadLink = document.getElementById('converter-download');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${baseName}.${target}`;
    resultArea.classList.remove('hidden');
    showToast('Conversion complete!');
  } catch (err) {
    console.error(err);
    status.textContent = 'Error: ' + err.message;
    fill.style.width = '0%';
    showToast('Conversion failed: ' + err.message, true);
  } finally {
    convertBtn.disabled = false;
  }
});

function convertImageCanvas(file, format) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (format === 'jpg' || format === 'jpeg' || format === 'bmp' || format === 'ico') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon' };
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas conversion failed'));
      }, mimeMap[format] || 'image/png', 0.92);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

let ffmpegInstance = null;

async function toBlobURL(url, mimeType) {
  const resp = await fetch(url);
  const blob = new Blob([await resp.arrayBuffer()], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg } = FFmpegWASM;
  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message);
  });

  const baseCore = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseCore}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseCore}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseCore}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function fileToUint8Array(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function convertWithFFmpeg(file, target, onProgress) {
  const ffmpeg = await getFFmpeg();

  const inputName = 'input.' + getExt(file.name);
  const outputName = 'output.' + target;

  await ffmpeg.writeFile(inputName, await fileToUint8Array(file));

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress && progress >= 0) onProgress(Math.min(progress, 1));
  });

  const args = ['-i', inputName];

  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(target)) {
    args.push('-vn');
    if (target === 'mp3') args.push('-codec:a', 'libmp3lame', '-qscale:a', '2');
    else if (target === 'aac' || target === 'm4a') args.push('-codec:a', 'aac', '-b:a', '192k');
    else if (target === 'ogg') args.push('-codec:a', 'libvorbis', '-qscale:a', '5');
    else if (target === 'flac') args.push('-codec:a', 'flac');
  } else if (target === 'gif') {
    args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos', '-t', '10');
  } else if (['mp4', 'webm', 'avi', 'mkv', 'mov'].includes(target)) {
    if (target === 'webm') args.push('-codec:v', 'libvpx', '-codec:a', 'libvorbis', '-b:v', '1M');
    else if (target === 'mp4') args.push('-codec:v', 'libx264', '-preset', 'fast', '-crf', '23');
  }

  args.push('-y', outputName);

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  const mimeTypes = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
    flac: 'audio/flac', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska', mov: 'video/quicktime',
    gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp'
  };

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([data.buffer], { type: mimeTypes[target] || 'application/octet-stream' });
}


/* ========== BINARY <-> ASCII ========== */
const baInput = document.getElementById('ba-input');
const baOutput = document.getElementById('ba-output');
let baMode = 'ascii-to-bin';

document.querySelectorAll('#binary-ascii .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#binary-ascii .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    baMode = btn.dataset.mode;
    updateBALabels();
  });
});

function updateBALabels() {
  if (baMode === 'ascii-to-bin') {
    document.getElementById('ba-input-label').textContent = 'ASCII Text';
    document.getElementById('ba-output-label').textContent = 'Binary Output';
    baInput.placeholder = 'Type or paste text here...';
  } else {
    document.getElementById('ba-input-label').textContent = 'Binary Input';
    document.getElementById('ba-output-label').textContent = 'ASCII Output';
    baInput.placeholder = 'Paste binary here (e.g. 01001000 01101001)...';
  }
}

document.getElementById('ba-convert').addEventListener('click', () => {
  const delimiter = document.getElementById('ba-delimiter').value || ' ';
  try {
    if (baMode === 'ascii-to-bin') {
      baOutput.value = asciiToBinary(baInput.value, delimiter);
    } else {
      baOutput.value = binaryToAscii(baInput.value);
    }
  } catch (e) {
    showToast(e.message, true);
  }
});

document.getElementById('ba-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(baOutput.value).then(() => showToast('Copied!'));
});

document.getElementById('ba-swap').addEventListener('click', () => {
  const temp = baInput.value;
  baInput.value = baOutput.value;
  baOutput.value = temp;
  baMode = baMode === 'ascii-to-bin' ? 'bin-to-ascii' : 'ascii-to-bin';
  document.querySelectorAll('#binary-ascii .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === baMode);
  });
  updateBALabels();
});

document.getElementById('ba-clear').addEventListener('click', () => {
  baInput.value = '';
  baOutput.value = '';
});

function asciiToBinary(text, delimiter) {
  return text.split('').map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0')).join(delimiter);
}

function binaryToAscii(binary) {
  const cleaned = binary.replace(/[^01]/g, '');
  if (cleaned.length % 8 !== 0) throw new Error('Binary length must be a multiple of 8');
  let result = '';
  for (let i = 0; i < cleaned.length; i += 8) {
    result += String.fromCharCode(parseInt(cleaned.substring(i, i + 8), 2));
  }
  return result;
}

baInput.addEventListener('input', () => {
  const delimiter = document.getElementById('ba-delimiter').value || ' ';
  try {
    if (baMode === 'ascii-to-bin') {
      baOutput.value = asciiToBinary(baInput.value, delimiter);
    } else {
      baOutput.value = binaryToAscii(baInput.value);
    }
  } catch {}
});


/* ========== ENCRYPTION ========== */
let encMode = 'encrypt';

document.querySelectorAll('#encryption .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#encryption .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    encMode = btn.dataset.mode;
    updateEncLabels();
  });
});

function updateEncLabels() {
  const isEnc = encMode === 'encrypt';
  document.getElementById('enc-input-label').textContent = isEnc ? 'Plaintext' : 'Encrypted Text';
  document.getElementById('enc-output-label').textContent = isEnc ? 'Encrypted Output' : 'Decrypted Output';
  document.getElementById('enc-go').textContent = isEnc ? 'Encrypt' : 'Decrypt';
  document.getElementById('enc-input').placeholder = isEnc ? 'Enter text to encrypt...' : 'Paste encrypted text here...';
  document.getElementById('enc-file-go').textContent = isEnc ? 'Encrypt File' : 'Decrypt File';
  document.getElementById('enc-file-done-text').textContent = isEnc ? 'File encrypted!' : 'File decrypted!';
}

document.querySelectorAll('.enc-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.enc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.enc-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

document.getElementById('toggle-pw').addEventListener('click', () => {
  const pw = document.getElementById('enc-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

document.querySelector('.toggle-file-pw').addEventListener('click', () => {
  const pw = document.getElementById('enc-file-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

document.getElementById('gen-pw').addEventListener('click', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  const pw = Array.from(arr).map(b => chars[b % chars.length]).join('');
  document.getElementById('enc-password').value = pw;
  document.getElementById('enc-password').type = 'text';
  showToast('Password generated!');
});

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptText(plaintext, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptText(cipherB64, password) {
  const data = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

document.getElementById('enc-go').addEventListener('click', async () => {
  const password = document.getElementById('enc-password').value;
  const input = document.getElementById('enc-input').value;
  const output = document.getElementById('enc-output');

  if (!password) return showToast('Enter a password', true);
  if (!input) return showToast('Enter some text', true);

  try {
    if (encMode === 'encrypt') {
      output.value = await encryptText(input, password);
    } else {
      output.value = await decryptText(input, password);
    }
    showToast(encMode === 'encrypt' ? 'Encrypted!' : 'Decrypted!');
  } catch (e) {
    showToast('Failed — wrong password or corrupted data', true);
  }
});

document.getElementById('enc-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('enc-output').value).then(() => showToast('Copied!'));
});

/* File encryption */
const encFileInput = document.getElementById('enc-file-input');
const encFileDrop = document.getElementById('enc-file-drop');
const encFileName = document.getElementById('enc-file-name');
const encFileGo = document.getElementById('enc-file-go');
let encSelectedFile = null;

document.getElementById('enc-file-browse').addEventListener('click', e => {
  e.stopPropagation();
  encFileInput.click();
});
encFileDrop.addEventListener('click', () => encFileInput.click());

encFileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleEncFile(e.target.files[0]);
});

['dragover', 'dragenter'].forEach(evt => {
  encFileDrop.addEventListener(evt, e => { e.preventDefault(); encFileDrop.classList.add('drag-over'); });
});
['dragleave', 'drop'].forEach(evt => {
  encFileDrop.addEventListener(evt, e => { e.preventDefault(); encFileDrop.classList.remove('drag-over'); });
});
encFileDrop.addEventListener('drop', e => {
  if (e.dataTransfer.files[0]) handleEncFile(e.dataTransfer.files[0]);
});

function handleEncFile(file) {
  encSelectedFile = file;
  encFileName.textContent = `${file.name} (${formatSize(file.size)})`;
  encFileGo.disabled = false;
  document.getElementById('enc-file-result').classList.add('hidden');
}

encFileGo.addEventListener('click', async () => {
  const password = document.getElementById('enc-file-password').value;
  if (!password) return showToast('Enter a password', true);
  if (!encSelectedFile) return;

  encFileGo.disabled = true;

  try {
    const fileData = new Uint8Array(await encSelectedFile.arrayBuffer());
    let resultBlob, resultName;

    if (encMode === 'encrypt') {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileData);

      const nameBytes = new TextEncoder().encode(encSelectedFile.name);
      const nameLen = new Uint8Array([nameBytes.length]);

      const combined = new Uint8Array(1 + nameBytes.length + 16 + 12 + encrypted.byteLength);
      let offset = 0;
      combined.set(nameLen, offset); offset += 1;
      combined.set(nameBytes, offset); offset += nameBytes.length;
      combined.set(salt, offset); offset += 16;
      combined.set(iv, offset); offset += 12;
      combined.set(new Uint8Array(encrypted), offset);

      resultBlob = new Blob([combined], { type: 'application/octet-stream' });
      resultName = encSelectedFile.name + '.enc';
    } else {
      const nameLen = fileData[0];
      let offset = 1;
      const nameBytes = fileData.slice(offset, offset + nameLen); offset += nameLen;
      const originalName = new TextDecoder().decode(nameBytes);
      const salt = fileData.slice(offset, offset + 16); offset += 16;
      const iv = fileData.slice(offset, offset + 12); offset += 12;
      const encrypted = fileData.slice(offset);

      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

      resultBlob = new Blob([decrypted], { type: 'application/octet-stream' });
      resultName = originalName;
    }

    const dl = document.getElementById('enc-file-download');
    dl.href = URL.createObjectURL(resultBlob);
    dl.download = resultName;
    document.getElementById('enc-file-result').classList.remove('hidden');
    showToast(encMode === 'encrypt' ? 'File encrypted!' : 'File decrypted!');
  } catch (e) {
    showToast('Failed — wrong password or corrupted file', true);
  } finally {
    encFileGo.disabled = false;
  }
});
