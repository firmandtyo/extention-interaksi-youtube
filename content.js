// YouTube Auto Interaction - Content Script
let botRunning = false;
let currentSettings = null;
let actionTimeout = null;
let urlObserver = null;
let lastUrl = window.location.href;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    currentSettings = request.settings;
    botRunning = true;
    // Reset video index when starting fresh
    chrome.storage.local.set({ videoIndex: 0 });
    startBot();
    sendResponse({ status: 'started' });
  }
  if (request.action === 'stop') {
    stopBot();
    sendResponse({ status: 'stopped' });
  }
  return true;
});

function sendLog(message, type = 'info') {
  try {
    chrome.runtime.sendMessage({ action: 'log', message, type });
  } catch (e) {
    console.log(`[YT Bot] ${message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => {
    actionTimeout = setTimeout(resolve, ms);
  });
}

function getRandomComment() {
  if (!currentSettings || !currentSettings.comments || currentSettings.comments.length === 0) {
    return null;
  }
  const idx = Math.floor(Math.random() * currentSettings.comments.length);
  return currentSettings.comments[idx];
}

function getVideoIndex() {
  return new Promise(resolve => {
    chrome.storage.local.get(['videoIndex'], (result) => {
      resolve(result.videoIndex || 0);
    });
  });
}

function setVideoIndex(idx) {
  chrome.storage.local.set({ videoIndex: idx });
}

// Watch for YouTube SPA navigation (URL changes without page reload)
function startUrlWatcher() {
  if (urlObserver) return;
  
  // Use MutationObserver on title to detect navigation
  urlObserver = setInterval(() => {
    if (!botRunning) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      const oldUrl = lastUrl;
      lastUrl = currentUrl;
      onUrlChanged(oldUrl, currentUrl);
    }
  }, 1000);
}

function stopUrlWatcher() {
  if (urlObserver) {
    clearInterval(urlObserver);
    urlObserver = null;
  }
}

async function onUrlChanged(oldUrl, newUrl) {
  if (!botRunning) return;
  
  sendLog(`Navigasi terdeteksi...`, 'info');
  
  // Navigated from search to video - start interaction
  if (newUrl.includes('/watch') && !oldUrl.includes('/watch')) {
    sendLog('Halaman video terdeteksi, mulai interaksi...', 'success');
    await sleep(3000); // Wait for video page to load
    await runInteractionCycle();
  }
  
  // Navigated to search results - click video
  if (newUrl.includes('/results') && !oldUrl.includes('/results')) {
    sendLog('Halaman pencarian terdeteksi, memilih video...', 'info');
    await sleep(3000);
    await clickVideoFromSearch();
  }
}

async function startBot() {
  sendLog('Bot dimulai di halaman YouTube', 'success');
  
  // Start URL watcher for SPA navigation
  startUrlWatcher();
  
  // Wait for page to fully load
  await sleep(3000);
  
  if (!botRunning) return;
  
  const currentUrl = window.location.href;
  lastUrl = currentUrl;
  const nicheKeyword = currentSettings.nicheKeyword;
  
  if (nicheKeyword) {
    sendLog(`🔍 Niche mode: "${nicheKeyword}"`, 'info');
    
    // Case 1: Already on a video page - proceed with watch/like/comment
    if (currentUrl.includes('/watch')) {
      sendLog('Sudah di halaman video, mulai interaksi...', 'info');
      await runInteractionCycle();
      return;
    }
    
    // Case 2: Already on search results page - click a video
    if (currentUrl.includes('/results')) {
      sendLog(`Mencari video niche: "${nicheKeyword}"...`, 'info');
      await sleep(2000);
      await clickVideoFromSearch();
      // YouTube may use SPA navigation - urlWatcher will handle it
      // Or page reload - auto-resume will handle it
      return;
    }
    
    // Case 3: On homepage or other page - navigate to search
    sendLog(`Mencari video niche: "${nicheKeyword}"...`, 'info');
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(nicheKeyword)}`;
    window.location.href = searchUrl;
    return;
  }
  
  // No niche keyword - run normally
  await runInteractionCycle();
}

async function runInteractionCycle() {
  while (botRunning) {
    try {
      // Check if we're on a video page
      if (!window.location.pathname.includes('/watch')) {
        if (currentSettings.nicheKeyword) {
          if (window.location.pathname.includes('/results')) {
            await clickVideoFromSearch();
            // Wait for SPA navigation or page reload
            await sleep(5000);
            // If still not on video page after wait, check again
            if (!window.location.pathname.includes('/watch')) {
              continue;
            }
          } else {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(currentSettings.nicheKeyword)}`;
            window.location.href = searchUrl;
            return;
          }
        } else {
          sendLog('Bukan halaman video, mencari video...', 'info');
          await clickFirstVideo();
          await sleep(5000);
          continue;
        }
      }
      
      // === NOW ON VIDEO PAGE ===
      sendLog(`Menonton video selama ${currentSettings.watchDuration} detik...`, 'info');
      
      // Watch the video for specified duration
      await ensureVideoPlaying();
      await sleep(currentSettings.watchDuration * 1000);
      
      if (!botRunning) break;
      
      // Auto Like
      if (currentSettings.autoLike) {
        sendLog('Mencoba like video...', 'info');
        await sleep(currentSettings.actionDelay * 1000);
        await autoLike();
      }
      
      if (!botRunning) break;
      
      // Auto Comment
      if (currentSettings.autoComment) {
        sendLog('Mencoba komentar...', 'info');
        await sleep(currentSettings.actionDelay * 1000);
        await autoComment();
      }
      
      if (!botRunning) break;
      
      // Auto Next Video
      if (currentSettings.autoNext) {
        await sleep(currentSettings.actionDelay * 1000);
        await goToNextVideo();
        
        if (currentSettings.nicheKeyword) {
          // For niche mode: wait for navigation then continue
          // URL watcher or page reload will handle next cycle
          await sleep(5000);
          // If URL changed to /results, the watcher handles clicking next video
          // If URL changed to /watch (direct), continue the loop
          if (window.location.pathname.includes('/watch')) {
            continue; // New video loaded via SPA
          }
          return; // Page will reload or watcher handles it
        }
        await sleep(5000);
      } else {
        sendLog('Siklus selesai (auto next tidak aktif)', 'info');
        stopBot();
        break;
      }
      
    } catch (error) {
      sendLog(`Error: ${error.message}`, 'error');
      await sleep(5000);
    }
  }
}

async function ensureVideoPlaying() {
  try {
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
      sendLog('Video diputar ▶️', 'success');
    }
  } catch (e) {
    sendLog('Gagal memutar video', 'error');
  }
}

async function autoLike() {
  try {
    // Wait for like button to be available
    await sleep(2000);
    
    let likeButton = null;
    
    // Method 1: Modern YouTube like button (2024+)
    likeButton = document.querySelector('like-button-view-model button');
    
    // Method 2: Segmented like/dislike button
    if (!likeButton) {
      likeButton = document.querySelector('ytd-segmented-like-dislike-button-renderer button:first-child');
    }
    
    // Method 3: Toggle button renderer
    if (!likeButton) {
      likeButton = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child button');
    }
    
    // Method 4: aria-label based
    if (!likeButton) {
      const allButtons = document.querySelectorAll('button[aria-label]');
      for (const btn of allButtons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        // Match "like this video" or just "like" but not "dislike"
        if ((label.includes('like') && !label.includes('dislike') && !label.includes('unlike')) ||
            (label.includes('suka') && !label.includes('tidak'))) {
          likeButton = btn;
          break;
        }
      }
    }
    
    // Method 5: Find by icon path in SVG
    if (!likeButton) {
      const shapes = document.querySelectorAll('#segmented-like-button button, #like-button button');
      if (shapes.length > 0) {
        likeButton = shapes[0];
      }
    }

    if (likeButton) {
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
      
      if (!isLiked) {
        likeButton.click();
        sendLog('Video di-like! 👍', 'success');
      } else {
        sendLog('Video sudah di-like sebelumnya ✓', 'info');
      }
    } else {
      sendLog('Tombol like tidak ditemukan', 'error');
    }
  } catch (e) {
    sendLog(`Gagal like: ${e.message}`, 'error');
  }
}

async function autoComment() {
  try {
    const comment = getRandomComment();
    if (!comment) {
      sendLog('Tidak ada komentar tersedia', 'error');
      return;
    }
    
    // Scroll down to load comments section
    sendLog('Scroll ke kolom komentar...', 'info');
    
    // Scroll multiple times to ensure comments section loads
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, 400);
      await sleep(1000);
    }
    
    await sleep(2000);
    
    // Find the comment input placeholder and click it
    let commentPlaceholder = document.querySelector('#placeholder-area');
    if (!commentPlaceholder) {
      commentPlaceholder = document.querySelector('#simplebox-placeholder');
    }
    if (!commentPlaceholder) {
      commentPlaceholder = document.querySelector('ytd-comment-simplebox-renderer #placeholder-area');
    }
    if (!commentPlaceholder) {
      // Try finding by the placeholder text
      const placeholders = document.querySelectorAll('[placeholder], [aria-placeholder]');
      for (const el of placeholders) {
        const ph = (el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '').toLowerCase();
        if (ph.includes('komentar') || ph.includes('comment') || ph.includes('add a comment')) {
          commentPlaceholder = el;
          break;
        }
      }
    }
    
    if (commentPlaceholder) {
      commentPlaceholder.click();
      sendLog('Kolom komentar diklik...', 'info');
      await sleep(2000);
    } else {
      sendLog('Placeholder komentar tidak ditemukan', 'error');
      return;
    }
    
    // Find the actual comment input box (contenteditable div)
    let commentBox = document.querySelector('#contenteditable-root');
    
    if (!commentBox) {
      commentBox = document.querySelector('#creation-box #contenteditable-root');
    }
    
    if (!commentBox) {
      commentBox = document.querySelector('div[contenteditable="true"][aria-label*="komentar" i]');
    }
    
    if (!commentBox) {
      commentBox = document.querySelector('div[contenteditable="true"][aria-label*="comment" i]');
    }
    
    if (!commentBox) {
      commentBox = document.querySelector('div[contenteditable="true"][aria-label*="Add" i]');
    }

    if (!commentBox) {
      // Last resort: any contenteditable in comments area
      commentBox = document.querySelector('ytd-comment-simplebox-renderer div[contenteditable="true"]');
    }
    
    if (commentBox) {
      // Focus the comment box
      commentBox.focus();
      await sleep(500);
      
      // Clear and set comment using execCommand for better compatibility
      commentBox.textContent = '';
      document.execCommand('insertText', false, comment);
      
      // Also dispatch input event
      commentBox.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      
      sendLog(`Komentar diketik: "${comment.substring(0, 30)}..."`, 'info');
      await sleep(2000);
      
      // Find and click submit/komentar button
      let submitBtn = null;
      
      // Method 1: Direct selector
      submitBtn = document.querySelector('#submit-button yt-button-shape button');
      
      // Method 2: paper button
      if (!submitBtn) {
        submitBtn = document.querySelector('tp-yt-paper-button#submit-button');
      }
      
      // Method 3: by aria-label
      if (!submitBtn) {
        submitBtn = document.querySelector('#submit-button button');
      }
      
      // Method 4: search by text content
      if (!submitBtn) {
        const allBtns = document.querySelectorAll('#comments button, #comment-dialog button');
        for (const btn of allBtns) {
          const text = (btn.textContent || '').trim().toLowerCase();
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if ((text === 'komentar' || text === 'comment' || text === 'comentar') ||
              (label.includes('comment') || label.includes('komentar'))) {
            submitBtn = btn;
            break;
          }
        }
      }
      
      if (submitBtn) {
        // Check if button is enabled
        if (submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true') {
          sendLog('Tombol kirim masih disabled, tunggu...', 'info');
          await sleep(2000);
        }
        
        if (!submitBtn.disabled && submitBtn.getAttribute('aria-disabled') !== 'true') {
          submitBtn.click();
          sendLog(`Komentar dikirim: "${comment.substring(0, 40)}..."`, 'success');
        } else {
          sendLog('Tombol kirim komentar masih disabled', 'error');
        }
      } else {
        sendLog('Tombol submit komentar tidak ditemukan', 'error');
      }
    } else {
      sendLog('Kolom komentar tidak ditemukan (pastikan sudah login)', 'error');
    }
  } catch (e) {
    sendLog(`Gagal komentar: ${e.message}`, 'error');
  }
}

async function goToNextVideo() {
  try {
    // If niche keyword is set, go back to search results and pick next video
    if (currentSettings.nicheKeyword) {
      const keyword = currentSettings.nicheKeyword;
      const currentIdx = await getVideoIndex();
      const nextIdx = currentIdx + 1;
      setVideoIndex(nextIdx);
      
      sendLog(`🔍 Kembali ke pencarian "${keyword}" (video #${nextIdx + 1})...`, 'info');
      
      // Navigate back to search results
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
      window.location.href = searchUrl;
      return;
    }
    
    // No niche - use recommendations
    let nextBtn = document.querySelector('.ytp-next-button');
    if (nextBtn) {
      nextBtn.click();
      sendLog('Pindah ke video selanjutnya ⏭️', 'success');
      return;
    }
    
    const recommendations = document.querySelectorAll('ytd-compact-video-renderer a#thumbnail, ytd-rich-item-renderer a#thumbnail');
    if (recommendations.length > 0) {
      const randomIdx = Math.floor(Math.random() * Math.min(5, recommendations.length));
      recommendations[randomIdx].click();
      sendLog('Pindah ke video rekomendasi ⏭️', 'success');
      return;
    }
    
    const autoplayVideo = document.querySelector('.ytp-autonav-endscreen-upnext-button');
    if (autoplayVideo) {
      autoplayVideo.click();
      sendLog('Pindah via autoplay ⏭️', 'success');
      return;
    }
    
    sendLog('Tidak bisa pindah ke video selanjutnya', 'error');
  } catch (e) {
    sendLog(`Gagal next video: ${e.message}`, 'error');
  }
}

async function clickVideoFromSearch() {
  try {
    // Wait for search results to fully render
    await sleep(3000);
    
    // Get video index from storage
    const idx = await getVideoIndex();
    
    // Get all video results (multiple selectors for compatibility)
    let videoLinks = document.querySelectorAll('ytd-video-renderer a#thumbnail[href*="/watch"]');
    
    // Fallback selectors
    if (videoLinks.length === 0) {
      videoLinks = document.querySelectorAll('a#thumbnail[href*="/watch"]');
    }
    
    if (videoLinks.length === 0) {
      videoLinks = document.querySelectorAll('a[href*="/watch"]');
    }
    
    if (videoLinks.length === 0) {
      sendLog('Tidak menemukan video, tunggu loading...', 'error');
      await sleep(5000);
      // Retry
      videoLinks = document.querySelectorAll('a#thumbnail[href*="/watch"], ytd-video-renderer a[href*="/watch"]');
      if (videoLinks.length === 0) {
        sendLog('Tetap tidak ada video ditemukan', 'error');
        return;
      }
    }
    
    // Pick video by index (wrap around)
    const selectedIdx = idx % videoLinks.length;
    
    // Scroll to the video first
    const videoElement = videoLinks[selectedIdx];
    videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(1500);
    
    // Get video title for logging
    const renderer = videoElement.closest('ytd-video-renderer');
    const titleEl = renderer ? renderer.querySelector('#video-title') : null;
    const title = titleEl ? titleEl.textContent.trim().substring(0, 50) : 'Video';
    
    sendLog(`▶️ Membuka video #${selectedIdx + 1}: "${title}"`, 'success');
    
    // Click the video link
    videoElement.click();
    
    // Wait and check if navigation happened (SPA)
    await sleep(3000);
    
    // If we're now on a watch page via SPA navigation, start interaction
    if (window.location.pathname.includes('/watch')) {
      lastUrl = window.location.href;
      await sleep(2000);
      await runInteractionCycle();
    }
    // Otherwise, URL watcher or page reload will handle it
    
  } catch (e) {
    sendLog(`Error memilih video: ${e.message}`, 'error');
  }
}

async function clickFirstVideo() {
  try {
    const videoLinks = document.querySelectorAll('ytd-rich-item-renderer a#thumbnail, ytd-video-renderer a#thumbnail');
    if (videoLinks.length > 0) {
      const randomIdx = Math.floor(Math.random() * Math.min(10, videoLinks.length));
      videoLinks[randomIdx].click();
      sendLog('Membuka video dari halaman utama 🎬', 'success');
    } else {
      sendLog('Tidak menemukan video di halaman ini', 'error');
    }
  } catch (e) {
    sendLog(`Error: ${e.message}`, 'error');
  }
}

function stopBot() {
  botRunning = false;
  stopUrlWatcher();
  if (actionTimeout) {
    clearTimeout(actionTimeout);
    actionTimeout = null;
  }
  sendLog('Bot dihentikan', 'info');
  try {
    chrome.runtime.sendMessage({ action: 'stopped' });
  } catch (e) {
    // Popup might be closed
  }
}

// Auto-resume if bot was running (handles page reload/navigation)
chrome.storage.local.get(['isRunning', 'settings', 'comments'], (result) => {
  if (result.isRunning && result.settings) {
    currentSettings = { ...result.settings, comments: result.comments || [] };
    botRunning = true;
    // Delay to let page fully load
    setTimeout(() => startBot(), 4000);
  }
});
