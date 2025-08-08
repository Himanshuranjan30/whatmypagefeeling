// DOM elements
const analyzeBtn = document.getElementById('analyzeBtn');
const statusMessage = document.getElementById('statusMessage');
const emotionLegend = document.getElementById('emotionLegend');

// Show emotion preview on load
const emotionPreview = document.getElementById('emotionPreview');
emotionPreview.style.display = 'block';

// Analyze button click handler
analyzeBtn.addEventListener('click', async () => {
  // Show loading state
  analyzeBtn.classList.add('loading');
  statusMessage.classList.remove('show');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Always inject scripts first to ensure they're loaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['src/styles/content.css']
      });
      
      console.log('Scripts injected successfully');
    } catch (injectError) {
      console.log('Scripts might already be injected:', injectError.message);
    }
    
    // Wait a moment for scripts to load, then get content
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          showStatus('Failed to communicate with page. Try refreshing and try again.', 'error');
          analyzeBtn.classList.remove('loading');
          return;
        }
        
        if (response && response.content) {
          console.log('Got page content, length:', response.content.length);
          if (response.content.trim().length === 0) {
            showStatus('No text content found on this page', 'error');
            analyzeBtn.classList.remove('loading');
            return;
          }
          analyzeContent(response.content, null, tab.id);
        } else {
          console.error('No content in response:', response);
          showStatus('Failed to extract page content. Try refreshing the page.', 'error');
          analyzeBtn.classList.remove('loading');
        }
      });
    }, 300);
    
  } catch (error) {
    console.error('Extension error:', error);
    showStatus('Error: ' + error.message, 'error');
    analyzeBtn.classList.remove('loading');
  }
});

// Analyze content with Gemini API
async function analyzeContent(content, apiKey, tabId) {
  try {
    // Send request to background script for API call
    chrome.runtime.sendMessage({
      action: 'analyzeEmotions',
      content: content,
      apiKey: null // API key is now hardcoded in background script
    }, (response) => {
      analyzeBtn.classList.remove('loading');
      
      if (response.error) {
        showStatus('Error: ' + response.error, 'error');
      } else if (response.emotions) {
        // Send emotions to content script to apply colors
        chrome.tabs.sendMessage(tabId, {
          action: 'applyEmotionColors',
          emotions: response.emotions
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Error applying emotions:', chrome.runtime.lastError);
            showStatus('Error applying colors: ' + chrome.runtime.lastError.message, 'error');
          } else {
            showStatus(`Analysis complete! Found ${response.emotions.length} emotion blocks.`, 'success');
            console.log('Applied emotions successfully');
          }
        });
      }
    });
  } catch (error) {
    analyzeBtn.classList.remove('loading');
    showStatus('Error analyzing content: ' + error.message, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}