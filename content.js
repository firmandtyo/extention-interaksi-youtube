// YouTube Auto Interaction - Content Script
let botRunning = false;
let currentSettings = null;
let actionTimeout = null;
let videoIndex = 0; // Track which video in search results to watch next

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    currentSettings = request.settings;
    botRunning = true;
    videoIndex = 0;
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

async function startBot() {
  sendLog('Bot dimulai di halaman YouTube', 'success');
  
  // Wait for page to fully load
  await sleep(2000);
  
  if (!botRunning) return;
  
  // If niche keyword is set, navigate to search results first
  if (currentSettings.nicheKeyword) {
    sendLog(`🔍 Niche mode: "${currentSettings.nicheKeyword}"`, 'info');
    await navigateToNicheSearch();
  }
  
  await runInteractionCycle();
}

async function navigateToNicheSearch() {
  const keyword = currentSettings.nicheKeyword;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
  
  // Check if already on search page for this keyword
  const currentUrl = window.location.href;
  if (currentUrl.includes('/results') && currentUrl.includes(encodeURIComponent(keyword))) {
    sendLog(`Sudah di halaman pencarian "${keyword}"`, 'info');
    return;
  }
  
  // Check if already watching a video (might be from a previous cycle)
  if (window.location.pathname.includes('/watch')) {
    sendLog('Sudah di halaman video, lanjutkan...', 'info');
    return;
  }
  
  // Navigate to search
  sendLog(`Mencari video niche: "${keyword}"...`, 'info');
  window.location.href = searchUrl;
  
  // Wait for navigation
  await sleep(5000);
}

async function runInteractionCycle() {
  while (botRunning) {
    try {
      // Check if we're on a video page
      if (!window.location.pathname.includes('/watch')) {
        // If niche keyword set, look for videos in search results
        if (currentSettings.nicheKeyword) {
          // Check if we're on search results page
          if (window.location.pathname.includes('/results')) {
            sendLog('Memilih video dari hasil pencarian niche...', 'info');
            await clickVideoFromSearch();
          } else {
            // Navigate to search page
            await navigateToNicheSearch();
          }
        } else {
          sendLog('Bukan halaman video, mencari video...', 'info');
          await clickFirstVideo();
        }
        await sleep(4000);
        continue;
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
        await sleep(5000); // Wait for new video to load
      } else {
        // If not auto next, stop the bot
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
    // Try to find the like button - YouTube updates their UI frequently
    // Method 1: Modern YouTube like button
    let likeButton = document.querySelector('like-button-view-model button');
    
    // Method 2: Older YouTube like button
    if (!likeButton) {
      likeButton = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child button');
    }
    
    // Method 3: Try segmented like button
    if (!likeButton) {
      likeButton = document.querySelector('ytd-menu-renderer yt-button-shape button[aria-label*="like" i]');
    }
    
    // Method 4: aria-label based approach
    if (!likeButton) {
      const buttons = document.querySelectorAll('button[aria-label]');
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if ((label.includes('like') && !label.includes('dislike')) || 
            label.includes('suka') && !label.includes('tidak')) {
          likeButton = btn;
          break;
        }
      }
    }

    if (likeButton) {
      // Check if already liked
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
      // Try alternative selector
      commentBox = document.querySelector('div[contenteditable="true"][aria-label*="komentar" i], div[contenteditable="true"][aria-label*="comment" i]');
    }
    
    if (!commentBox) {
      // Try one more time with more generic selector
      commentBox = document.querySelector('#comment-dialog div[contenteditable="true"], ytd-comment-simplebox-renderer div[contenteditable="true"]');
    }
    
    if (commentBox) {
      // Focus and type comment
      commentBox.focus();
      await sleep(500);
      
      // Clear existing content
      commentBox.textContent = '';
      
      // Input the comment text
      commentBox.textContent = comment;
      
      // Dispatch events to trigger YouTube's listeners
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      
      await sleep(1000);
      
      // Find and click submit button
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
      await goToNextNicheVideo();
      return;
    }
    
    // Method 1: Click next button in player
    let nextBtn = document.querySelector('.ytp-next-button');
    
    if (nextBtn) {
      nextBtn.click();
      sendLog('Pindah ke video selanjutnya ⏭️', 'success');
      return;
    }
    
    // Method 2: Click first video in recommendations
    const recommendations = document.querySelectorAll('ytd-compact-video-renderer a#thumbnail, ytd-rich-item-renderer a#thumbnail');
    if (recommendations.length > 0) {
      const randomIdx = Math.floor(Math.random() * Math.min(5, recommendations.length));
      recommendations[randomIdx].click();
      sendLog('Pindah ke video rekomendasi ⏭️', 'success');
      return;
    }
    
    // Method 3: Click autoplay
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

async function goToNextNicheVideo() {
  const keyword = currentSettings.nicheKeyword;
  videoIndex++;
  
  sendLog(`🔍 Kembali ke pencarian "${keyword}" (video #${videoIndex + 1})...`, 'info');
  
  // Navigate back to search results
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
  window.location.href = searchUrl;
  
  // Wait for page to load - the interaction cycle will pick up and click next video
  await sleep(5000);
}

async function clickVideoFromSearch() {
  try {
    // Get all video results from search page (exclude ads, shorts, etc.)
    const videoRenderers = document.querySelectorAll('ytd-video-renderer a#thumbnail, ytd-video-renderer #video-title');
    
    if (videoRenderers.length === 0) {
      sendLog('Tidak menemukan video di hasil pencarian', 'error');
      return;
    }
    
    // Filter to only get thumbnail links (actual video links)
    const videoLinks = document.querySelectorAll('ytd-video-renderer a#thumbnail');
    
    if (videoLinks.length > 0) {
      // Use videoIndex to pick sequential videos, wrap around if needed
      const idx = videoIndex % videoLinks.length;
      
      // Scroll to the video first if needed
      const videoElement = videoLinks[idx];
      videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(1000);
      
      // Get video title for logging
      const renderer = videoElement.closest('ytd-video-renderer');
      const titleEl = renderer ? renderer.querySelector('#video-title') : null;
      const title = titleEl ? titleEl.textContent.trim().substring(0, 50) : 'Unknown';
      
      videoElement.click();
      sendLog(`▶️ Membuka video #${idx + 1}: "${title}..."`, 'success');
      videoIndex++;
    } else {
      // Fallback: try any video link on the page
      const anyVideo = document.querySelector('a#thumbnail[href*="/watch"]');
      if (anyVideo) {
        anyVideo.click();
        sendLog('Membuka video dari hasil pencarian 🎬', 'success');
      } else {
        sendLog('Tidak ada video ditemukan di halaman pencarian', 'error');
      }
    }
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

// Auto-resume if bot was running
chrome.storage.local.get(['isRunning', 'settings', 'comments'], (result) => {
  if (result.isRunning && result.settings) {
    currentSettings = { ...result.settings, comments: result.comments || [] };
    botRunning = true;
    setTimeout(() => startBot(), 3000);
  }
});
