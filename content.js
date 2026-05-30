// YouTube Auto Interaction - Content Script
let botRunning = false;
let currentSettings = null;
let actionTimeout = null;

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

async function startBot() {
  sendLog('Bot dimulai di halaman YouTube', 'success');
  
  // Wait for page to fully load
  await sleep(3000);
  
  if (!botRunning) return;
  
  const currentUrl = window.location.href;
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
      // After clicking, page will navigate - content script restarts
      return;
    }
    
    // Case 3: On homepage or other page - navigate to search
    sendLog(`Mencari video niche: "${nicheKeyword}"...`, 'info');
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(nicheKeyword)}`;
    window.location.href = searchUrl;
    // Page will reload, content script will restart and hit Case 2
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
          // Should not happen often since startBot handles navigation
          // But just in case, click video from search
          if (window.location.pathname.includes('/results')) {
            await clickVideoFromSearch();
            return; // Page will reload
          } else {
            // Navigate to search
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(currentSettings.nicheKeyword)}`;
            window.location.href = searchUrl;
            return; // Page will reload
          }
        } else {
          sendLog('Bukan halaman video, mencari video...', 'info');
          await clickFirstVideo();
          await sleep(4000);
          continue;
        }
      }
      
      sendLog(`Menonton video selama ${currentSettings.watchDuration} detik...`, 'info');
      
      // Watch the video for specified duration
      await ensureVideoPlaying();
      await sleep(currentSettings.watchDuration * 1000);
      
      if (!botRunning) break;
      
      // Auto Like
      if (currentSettings.autoLike) {
        await sleep(currentSettings.actionDelay * 1000);
        await autoLike();
      }
      
      if (!botRunning) break;
      
      // Auto Comment
      if (currentSettings.autoComment) {
        await sleep(currentSettings.actionDelay * 1000);
        await autoComment();
      }
      
      if (!botRunning) break;
      
      // Auto Next Video
      if (currentSettings.autoNext) {
        await sleep(currentSettings.actionDelay * 1000);
        await goToNextVideo();
        // If niche mode, page will reload - exit loop
        if (currentSettings.nicheKeyword) {
          return;
        }
        await sleep(5000); // Wait for new video to load
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
    let likeButton = document.querySelector('like-button-view-model button');
    
    if (!likeButton) {
      likeButton = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child button');
    }
    
    if (!likeButton) {
      likeButton = document.querySelector('ytd-menu-renderer yt-button-shape button[aria-label*="like" i]');
    }
    
    if (!likeButton) {
      const buttons = document.querySelectorAll('button[aria-label]');
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if ((label.includes('like') && !label.includes('dislike')) || 
            (label.includes('suka') && !label.includes('tidak'))) {
          likeButton = btn;
          break;
        }
      }
    }

    if (likeButton) {
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true' || 
                      likeButton.classList.contains('style-default-active');
      
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
    window.scrollBy(0, 500);
    await sleep(2000);
    
    // Find the comment input placeholder
    const commentPlaceholder = document.querySelector('#placeholder-area, #simplebox-placeholder, ytd-comment-simplebox-renderer #placeholder-area');
    
    if (commentPlaceholder) {
      commentPlaceholder.click();
      await sleep(1500);
    }
    
    // Find the actual comment input box
    let commentBox = document.querySelector('#contenteditable-root, #creation-box #contenteditable-root');
    
    if (!commentBox) {
      commentBox = document.querySelector('div[contenteditable="true"][aria-label*="komentar" i], div[contenteditable="true"][aria-label*="comment" i]');
    }
    
    if (!commentBox) {
      commentBox = document.querySelector('#comment-dialog div[contenteditable="true"], ytd-comment-simplebox-renderer div[contenteditable="true"]');
    }
    
    if (commentBox) {
      commentBox.focus();
      await sleep(500);
      
      commentBox.textContent = '';
      commentBox.textContent = comment;
      
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      
      await sleep(1000);
      
      let submitBtn = document.querySelector('#submit-button yt-button-shape button, #submit-button button, tp-yt-paper-button#submit-button');
      
      if (!submitBtn) {
        const buttons = document.querySelectorAll('button, yt-button-shape button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (text.includes('komentar') || text.includes('comment') || 
              label.includes('komentar') || label.includes('comment')) {
            if (!text.includes('sort') && !text.includes('urutkan')) {
              submitBtn = btn;
              break;
            }
          }
        }
      }
      
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
        sendLog(`Komentar dikirim: "${comment.substring(0, 40)}..."`, 'success');
      } else {
        sendLog('Tombol kirim komentar tidak tersedia/disabled', 'error');
      }
    } else {
      sendLog('Kolom komentar tidak ditemukan (mungkin perlu login)', 'error');
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
      // Page will reload - content script will restart and pick next video
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
    
    // Get all video results from search page
    const videoLinks = document.querySelectorAll('ytd-video-renderer a#thumbnail[href*="/watch"]');
    
    if (videoLinks.length === 0) {
      // Try alternative selectors
      const altLinks = document.querySelectorAll('a#thumbnail[href*="/watch"]');
      if (altLinks.length > 0) {
        const selectedIdx = idx % altLinks.length;
        altLinks[selectedIdx].click();
        sendLog(`▶️ Membuka video #${selectedIdx + 1} dari pencarian`, 'success');
        return;
      }
      sendLog('Tidak menemukan video di hasil pencarian, tunggu...', 'error');
      await sleep(3000);
      // Try one more time
      const retryLinks = document.querySelectorAll('a#thumbnail[href*="/watch"]');
      if (retryLinks.length > 0) {
        retryLinks[0].click();
        sendLog('▶️ Membuka video dari pencarian (retry)', 'success');
      }
      return;
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
    const title = titleEl ? titleEl.textContent.trim().substring(0, 50) : 'Unknown';
    
    sendLog(`▶️ Membuka video #${selectedIdx + 1}: "${title}"`, 'success');
    
    // Click the video link
    videoElement.click();
    
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
    setTimeout(() => startBot(), 3000);
  }
});
