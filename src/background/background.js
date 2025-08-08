// Background script for PagePulse extension
console.log('PagePulse background script loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      highlightEnabled: true,
      maxHighlights: 25,
      showTooltips: true
    });
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'analyzeEmotions') {
    handleEmotionAnalysis(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['highlightEnabled', 'maxHighlights', 'showTooltips'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'saveSettings') {
    chrome.storage.local.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Legacy function - no longer used (analysis now handled in popup.js)
async function handleEmotionAnalysis(request, sendResponse) {
  sendResponse({ error: 'This function is deprecated. Analysis is now handled directly in the popup.' });
}

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Content script will be injected when needed via executeScript
    console.log('Tab updated:', tab.url);
  }
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Background script initialization complete');