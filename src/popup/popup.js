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
    
    // Send message to content script to get page content
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (chrome.runtime.lastError) {
        // Inject content script if not already injected
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content.js']
        });
        
        // Also inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['src/styles/content.css']
        });
        
        // Try again after a short delay
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
            if (response && response.content) {
              analyzeContent(response.content, null, tab.id);
            } else {
              showStatus('Failed to get page content', 'error');
              analyzeBtn.classList.remove('loading');
            }
          });
        }, 100);
      } else if (response && response.content) {
        analyzeContent(response.content, null, tab.id);
      } else {
        showStatus('Failed to get page content', 'error');
        analyzeBtn.classList.remove('loading');
      }
    });
  } catch (error) {
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