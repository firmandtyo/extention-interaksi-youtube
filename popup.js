// Default comments list
const DEFAULT_COMMENTS = [
  "Video yang sangat informatif! Terima kasih sudah berbagi 👍",
  "Konten yang luar biasa! Terus berkarya 🔥",
  "Mantap banget, sangat membantu! 🙏",
  "Keren abis! Auto subscribe deh 🎉",
  "Penjelasannya sangat jelas dan mudah dipahami 👏",
  "Selalu konsisten bikin konten berkualitas! 💯",
  "Video ini exactly yang aku butuhkan, thanks!",
  "Wah keren banget nih, lanjutkan terus ya! 🚀",
  "Best channel ever! Selalu bermanfaat 🌟",
  "Suka banget sama kontennya, sangat edukatif 📚",
  "Nice video! Keep up the good work 👍",
  "Materinya sangat bagus dan well explained ✨",
  "Auto like, auto subscribe! 🎬",
  "Terima kasih atas ilmunya, sangat berharga! 💎",
  "The best content creator! Recommended banget 🏆"
];

let isRunning = false;
let logs = [];

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadLogs();
  updateUI();
});

function loadSettings() {
  chrome.storage.local.get(['settings', 'comments', 'isRunning'], (result) => {
    if (result.settings) {
      document.getElementById('autoLike').checked = result.settings.autoLike ?? true;
      document.getElementById('autoComment').checked = result.settings.autoComment ?? true;
      document.getElementById('autoNext').checked = result.settings.autoNext ?? true;
      document.getElementById('watchDuration').value = result.settings.watchDuration ?? 30;
      document.getElementById('actionDelay').value = result.settings.actionDelay ?? 3;
    }
    
    const comments = result.comments || DEFAULT_COMMENTS;
    renderComments(comments);
    
    isRunning = result.isRunning || false;
    updateUI();
  });
}

function saveSettings() {
  const settings = {
    autoLike: document.getElementById('autoLike').checked,
    autoComment: document.getElementById('autoComment').checked,
    autoNext: document.getElementById('autoNext').checked,
    watchDuration: parseInt(document.getElementById('watchDuration').value) || 30,
    actionDelay: parseInt(document.getElementById('actionDelay').value) || 3
  };
  
  chrome.storage.local.set({ settings });
}

function getComments() {
  const items = document.querySelectorAll('.comment-item span');
  return Array.from(items).map(item => item.textContent);
}

function saveComments() {
  const comments = getComments();
  chrome.storage.local.set({ comments });
}

function renderComments(comments) {
  const listEl = document.getElementById('commentList');
  if (comments.length === 0) {
    listEl.innerHTML = '<p class="log-empty">Belum ada komentar...</p>';
    return;
  }
  
  listEl.innerHTML = comments.map((comment, idx) => `
    <div class="comment-item">
      <span title="${comment}">${comment}</span>
      <button class="btn-remove" data-idx="${idx}">✕</button>
    </div>
  `).join('');
  
  // Add event listeners for remove buttons
  listEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const comments = getComments();
      comments.splice(idx, 1);
      renderComments(comments);
      saveComments();
    });
  });
}

function addComment() {
  const input = document.getElementById('newComment');
  const text = input.value.trim();
  if (!text) return;
  
  const comments = getComments();
  comments.push(text);
  renderComments(comments);
  saveComments();
  input.value = '';
}

function loadLogs() {
  chrome.storage.local.get(['logs'], (result) => {
    logs = result.logs || [];
    renderLogs();
  });
}

function renderLogs() {
  const container = document.getElementById('logContainer');
  if (logs.length === 0) {
    container.innerHTML = '<p class="log-empty">Belum ada aktivitas...</p>';
    return;
  }
  
  container.innerHTML = logs.slice(-50).map(log => `
    <div class="log-entry ${log.type}">[${log.time}] ${log.message}</div>
  `).join('');
  
  container.scrollTop = container.scrollHeight;
}

function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString('id-ID');
  logs.push({ time, message, type });
  chrome.storage.local.set({ logs });
  renderLogs();
}

function updateUI() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  if (isRunning) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDot.classList.add('active');
    statusText.textContent = 'Sedang Berjalan...';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDot.classList.remove('active');
    statusText.textContent = 'Tidak Aktif';
  }
}

// Event Listeners
document.getElementById('addCommentBtn').addEventListener('click', addComment);

document.getElementById('newComment').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addComment();
});

document.getElementById('resetCommentsBtn').addEventListener('click', () => {
  renderComments(DEFAULT_COMMENTS);
  saveComments();
  addLog('Komentar direset ke default', 'info');
});

document.getElementById('clearLogBtn').addEventListener('click', () => {
  logs = [];
  chrome.storage.local.set({ logs: [] });
  renderLogs();
});

// Setting change listeners
['autoLike', 'autoComment', 'autoNext', 'watchDuration', 'actionDelay'].forEach(id => {
  document.getElementById(id).addEventListener('change', saveSettings);
});

// Start button
document.getElementById('startBtn').addEventListener('click', () => {
  saveSettings();
  saveComments();
  
  const comments = getComments();
  if (document.getElementById('autoComment').checked && comments.length === 0) {
    addLog('Error: Tambahkan komentar terlebih dahulu!', 'error');
    return;
  }
  
  isRunning = true;
  chrome.storage.local.set({ isRunning: true });
  updateUI();
  addLog('Bot dimulai! 🚀', 'success');
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'start',
        settings: {
          autoLike: document.getElementById('autoLike').checked,
          autoComment: document.getElementById('autoComment').checked,
          autoNext: document.getElementById('autoNext').checked,
          watchDuration: parseInt(document.getElementById('watchDuration').value) || 30,
          actionDelay: parseInt(document.getElementById('actionDelay').value) || 3,
          comments: comments
        }
      });
    } else {
      addLog('Buka halaman YouTube terlebih dahulu!', 'error');
      isRunning = false;
      chrome.storage.local.set({ isRunning: false });
      updateUI();
    }
  });
});

// Stop button
document.getElementById('stopBtn').addEventListener('click', () => {
  isRunning = false;
  chrome.storage.local.set({ isRunning: false });
  updateUI();
  addLog('Bot dihentikan ⏹️', 'info');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    addLog(request.message, request.type || 'info');
  }
  if (request.action === 'stopped') {
    isRunning = false;
    chrome.storage.local.set({ isRunning: false });
    updateUI();
    addLog('Bot selesai/dihentikan', 'info');
  }
});
