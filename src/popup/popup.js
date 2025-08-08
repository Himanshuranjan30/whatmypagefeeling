// DOM elements
const analyzeBtn = document.getElementById('analyzeBtn');
const statusMessage = document.getElementById('statusMessage');
const emotionLegend = document.getElementById('emotionLegend');

// Show emotion preview on load
const emotionPreview = document.getElementById('emotionPreview');
emotionPreview.style.display = 'block';

// Analyze button click handler
analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.classList.add('loading');
  statusMessage.classList.remove('show');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Tab:', tab);
    
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    
    // Get page text with better error handling
    console.log('Executing script on tab:', tab.id);
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageTextDirect
      });
      console.log('Script results:', results);
    } catch (scriptError) {
      console.error('Script execution failed:', scriptError);
      throw new Error('Failed to access page content. Make sure you\'re on a regular website.');
    }
    
    if (!results || !results[0]) {
      throw new Error('No results from script execution');
    }
    
    const pageText = results[0].result || '';
    console.log('Page text length:', pageText.length);
    
    if (!pageText || pageText.trim().length === 0) {
      showStatus('No text found on page', 'error');
      analyzeBtn.classList.remove('loading');
      return;
    }
    
    console.log('Calling Gemini API...');
    
    // Call Gemini API directly
    const emotions = await callGeminiAPI(pageText);
    console.log('API returned emotions:', emotions.length);
    
    if (emotions && emotions.length > 0) {
      console.log('Applying highlights...');
      // Apply highlights directly
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: applyHighlightsDirect,
        args: [emotions]
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['src/styles/content.css']
      });
      
      showStatus(`Analysis complete! Highlighted ${emotions.length} text blocks.`, 'success');
    } else {
      showStatus('No emotions found in analysis', 'error');
    }
    
  } catch (error) {
    console.error('Full error:', error);
    showStatus('Error: ' + error.message, 'error');
  }
  
  analyzeBtn.classList.remove('loading');
});

// Direct text extraction function
function extractPageTextDirect() {
  const body = document.body;
  if (!body) return '';
  
  const clone = body.cloneNode(true);
  const scripts = clone.querySelectorAll('script, style, noscript, iframe');
  scripts.forEach(el => el.remove());
  
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

// Direct API call function
async function callGeminiAPI(content) {
  const API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `Analyze this webpage content and identify emotional sections. For each meaningful paragraph or sentence (skip single words, numbers, navigation), return JSON array with:
  {"text": "actual text snippet 10-50 words", "emotion": "happy/sad/angry/excited/worried/surprised/trusting/calm"}
  
  Content: ${content.substring(0, 20000)}`;
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  
  const data = await response.json();
  console.log('API response:', data);
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  // Check if response structure exists
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    console.error('Unexpected API response structure:', data);
    return [];
  }
  
  const text = data.candidates[0].content.parts[0].text;
  console.log('API response text:', text);
  
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed emotions:', parsed);
      return parsed.slice(0, 50);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return [];
    }
  }
  
  console.warn('No JSON array found in response');
  return [];
}

// Direct highlighting function
function applyHighlightsDirect(emotions) {
  console.log('Applying subtle highlights with', emotions.length, 'emotions');
  
  const emotionColors = {
    happy: '#FFF9C4', sad: '#E1F5FE', angry: '#FFEBEE',
    excited: '#FFF3E0', worried: '#F3E5F5', surprised: '#E8F5E8',
    trusting: '#E0F2F1', calm: '#F1F8E9'
  };
  
  // Remove existing highlights
  document.querySelectorAll('.emotion-highlight').forEach(span => {
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });
  
  let highlightCount = 0;
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'emotion-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: Arial, sans-serif;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    white-space: nowrap;
  `;
  document.body.appendChild(tooltip);
  
  emotions.forEach(emotion => {
    const searchText = emotion.text.trim();
    const emotionType = emotion.emotion;
    const color = emotionColors[emotionType] || '#F5F5F5';
    
    if (searchText.length < 10) return;
    
    // Find text in all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.nodeValue;
      const parent = node.parentElement;
      
      if (!parent || parent.tagName.toLowerCase() === 'script' || 
          parent.tagName.toLowerCase() === 'style' ||
          parent.classList.contains('emotion-highlight')) {
        continue;
      }
      
      // Simple text matching - look for first few words
      const searchWords = searchText.split(' ').slice(0, 3).join(' ').toLowerCase();
      if (nodeText.toLowerCase().includes(searchWords)) {
        
        // Wrap the text node in a highlight span
        const span = document.createElement('span');
        span.className = 'emotion-highlight';
        span.style.cssText = `
          background-color: ${color} !important;
          border-radius: 2px !important;
          transition: all 0.2s ease !important;
          cursor: help !important;
        `;
        span.setAttribute('data-emotion', emotionType);
        span.setAttribute('data-text', searchText);
        
        // Add hover events
        span.addEventListener('mouseenter', (e) => {
          const rect = span.getBoundingClientRect();
          tooltip.textContent = `Emotion: ${emotionType.charAt(0).toUpperCase() + emotionType.slice(1)}`;
          tooltip.style.left = (rect.left + window.scrollX) + 'px';
          tooltip.style.top = (rect.top + window.scrollY - 35) + 'px';
          tooltip.style.opacity = '1';
          
          // Slightly darken on hover
          span.style.backgroundColor = darkenColor(color);
        });
        
        span.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
          span.style.backgroundColor = color;
        });
        
        parent.insertBefore(span, node);
        span.appendChild(node);
        
        highlightCount++;
        break; // Only highlight first match per emotion
      }
    }
  });
  
  console.log(`Applied ${highlightCount} subtle highlights`);
  
  // Small notification in corner
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: #4CAF50 !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 6px !important;
    z-index: 999999 !important;
    font-family: Arial, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
    opacity: 0 !important;
    transition: opacity 0.3s !important;
  `;
  notification.textContent = `✨ Highlighted ${highlightCount} emotions`;
  document.body.appendChild(notification);
  
  // Fade in notification
  setTimeout(() => notification.style.opacity = '1', 100);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}

// Helper function to darken colors on hover
function darkenColor(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  const r = Math.max(0, parseInt(result[1], 16) - 20);
  const g = Math.max(0, parseInt(result[2], 16) - 20);
  const b = Math.max(0, parseInt(result[3], 16) - 20);
  
  return `rgb(${r}, ${g}, ${b})`;
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