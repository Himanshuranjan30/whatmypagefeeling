// DOM elements
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusMessage = document.getElementById('statusMessage');
const emotionLegend = document.getElementById('emotionLegend');
const apiKeySection = document.getElementById('apiKeySection');

// Hide emotion preview initially
const emotionPreview = document.getElementById('emotionPreview');

// Load saved API key on popup open
chrome.storage.local.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
    apiKeySection.style.display = 'none';
    emotionPreview.style.display = 'block';
  } else {
    emotionPreview.style.display = 'none';
  }
});

// Save API key
saveApiKeyBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showStatus('Please enter a valid API key', 'error');
    return;
  }

  chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
    showStatus('API key saved successfully!', 'success');
    // Animate hide
    apiKeySection.style.opacity = '0';
    setTimeout(() => {
      apiKeySection.style.display = 'none';
      emotionPreview.style.display = 'block';
    }, 300);
  });
});

// Analyze button click handler
analyzeBtn.addEventListener('click', async () => {
  // Check if API key exists
  chrome.storage.local.get(['geminiApiKey'], async (result) => {
    if (!result.geminiApiKey) {
      apiKeySection.style.display = 'block';
      showStatus('Please enter your Gemini API key first', 'error');
      return;
    }

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
                analyzeContent(response.content, result.geminiApiKey, tab.id);
              } else {
                showStatus('Failed to get page content', 'error');
                analyzeBtn.classList.remove('loading');
              }
            });
          }, 100);
        } else if (response && response.content) {
          analyzeContent(response.content, result.geminiApiKey, tab.id);
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
});

// Analyze content with Gemini API
async function analyzeContent(content, apiKey, tabId) {
  try {
    // Send request to background script for API call
    chrome.runtime.sendMessage({
      action: 'analyzeEmotions',
      content: content,
      apiKey: apiKey
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