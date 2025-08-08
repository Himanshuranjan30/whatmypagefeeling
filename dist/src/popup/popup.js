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
    
    // Check if tab is valid
    if (!tab || !tab.id) {
      showStatus('Unable to access current tab', 'error');
      analyzeBtn.classList.remove('loading');
      return;
    }

    // Check if it's a chrome:// or other restricted URL
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      showStatus('Cannot analyze browser internal pages. Please try on a regular website.', 'error');
      analyzeBtn.classList.remove('loading');
      return;
    }

    await injectScriptsAndAnalyze(tab.id);
    
  } catch (error) {
    console.error('Extension error:', error);
    showStatus('Error: ' + error.message, 'error');
    analyzeBtn.classList.remove('loading');
  }
});

// Function to inject scripts and analyze with retry logic
async function injectScriptsAndAnalyze(tabId, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    // Always inject scripts fresh
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content/content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['src/styles/content.css']
    });
    
    console.log('Scripts injected successfully, attempt:', retryCount + 1);
    
    // Wait longer for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 500 + (retryCount * 200)));
    
    // Try to get page content
    chrome.tabs.sendMessage(tabId, { action: 'getPageContent' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Message error on attempt', retryCount + 1, ':', chrome.runtime.lastError);
        
        if (retryCount < maxRetries) {
          console.log('Retrying script injection...');
          injectScriptsAndAnalyze(tabId, retryCount + 1);
        } else {
          showStatus('Failed to communicate with page after multiple attempts. Please refresh the page and try again.', 'error');
          analyzeBtn.classList.remove('loading');
        }
        return;
      }
      
      if (response && response.content) {
        console.log('Got page content, length:', response.content.length);
        if (response.content.trim().length === 0) {
          showStatus('No text content found on this page', 'error');
          analyzeBtn.classList.remove('loading');
          return;
        }
        analyzeContent(response.content, null, tabId);
      } else {
        console.error('No content in response:', response);
        if (retryCount < maxRetries) {
          console.log('Retrying due to empty response...');
          setTimeout(() => injectScriptsAndAnalyze(tabId, retryCount + 1), 1000);
        } else {
          showStatus('Failed to extract page content after multiple attempts. Please refresh the page.', 'error');
          analyzeBtn.classList.remove('loading');
        }
      }
    });
    
  } catch (injectError) {
    console.error('Script injection error:', injectError);
    if (retryCount < maxRetries) {
      console.log('Retrying script injection due to error...');
      setTimeout(() => injectScriptsAndAnalyze(tabId, retryCount + 1), 1000);
    } else {
      showStatus('Failed to inject scripts. Please refresh the page and try again.', 'error');
      analyzeBtn.classList.remove('loading');
    }
  }
}

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