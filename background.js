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
          "This track is absolutely fire! Been on repeat all day 🔥🎶",
          "The vibes on this one are unmatched. Pure masterpiece 🎵✨",
          "Goosebumps every single time I listen to this 🙌",
          "This is the kind of music that heals your soul 💫",
          "Can't stop listening! This beat is insane 🎧🔥",
          "The melody is so beautiful, instant classic right here 💎",
          "This song deserves millions of views. Sharing everywhere! 🚀",
          "Who else is listening to this in 2025? Still hits different 🎶",
          "The production quality is top tier. Amazing work! 🏆",
          "This gives me chills every time. What a vibe 🌊",
          "Discovered this today and I'm already obsessed 😍🎵",
          "The vocals are so smooth, can't get enough of this ❤️",
          "This track just made my whole playlist better 🎧",
          "Absolutely love the energy in this one! Keep it coming 💪🔥",
          "This is what real music sounds like. Respect! 🙏🎶",
          "Perfect song for late night vibes 🌙✨",
          "The bass on this track hits so hard! Love it 🔊",
          "Been searching for music like this. Finally found it! 🎉",
          "This artist never misses. Every release is gold 🥇",
          "Added to my favorites immediately. What a banger! 💥🎵"
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
