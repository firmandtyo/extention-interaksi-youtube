// Background service worker for YouTube Auto Interaction Extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Auto Interaction Extension installed!');
  
  // Set default settings
  chrome.storage.local.get(['settings', 'comments'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          autoLike: true,
          autoComment: true,
          autoNext: true,
          watchDuration: 30,
          actionDelay: 3
        }
      });
    }
    if (!result.comments) {
      chrome.storage.local.set({
        comments: [
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
        ]
      });
    }
  });
});

// Handle messages between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Forward log messages from content script to popup
  if (request.action === 'log' || request.action === 'stopped') {
    // Store log in storage for popup to read
    chrome.storage.local.get(['logs'], (result) => {
      const logs = result.logs || [];
      if (request.action === 'log') {
        const time = new Date().toLocaleTimeString('id-ID');
        logs.push({ time, message: request.message, type: request.type || 'info' });
        // Keep only last 100 logs
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        chrome.storage.local.set({ logs });
      }
    });
  }
  return true;
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.set({ isRunning: false });
});
