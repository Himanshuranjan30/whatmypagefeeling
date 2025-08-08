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
      console.log('Emotions to highlight:', emotions);
      
      // Apply highlights directly
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: applyHighlightsDirect,
          args: [emotions]
        });
        
        showStatus(`Analysis complete! Found ${emotions.length} emotions.`, 'success');
      } catch (highlightError) {
        console.error('Highlighting failed:', highlightError);
        showStatus('Highlighting failed: ' + highlightError.message, 'error');
      }
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
  console.log('DEBUG: Starting highlighting with', emotions.length, 'emotions');
  
  // Just highlight some fucking text to prove it works
  const testElements = document.querySelectorAll('p, span, div, h1, h2, h3, a');
  console.log('DEBUG: Found', testElements.length, 'elements');
  
  let count = 0;
  const colors = ['#FFE6E6', '#E6F3FF', '#E6FFE6', '#FFF3E6', '#F0E6FF'];
  
  testElements.forEach((el, index) => {
    if (count >= 10) return; // Only highlight 10 elements
    
    const text = el.textContent.trim();
    if (text.length > 20 && !el.classList.contains('emotion-highlight')) {
      const color = colors[index % colors.length];
      
      el.style.backgroundColor = color;
      el.style.borderRadius = '3px';
      el.style.padding = '2px';
      el.classList.add('emotion-highlight');
      el.title = `Emotion: ${emotions[count % emotions.length]?.emotion || 'happy'}`;
      
      count++;
      console.log('DEBUG: Highlighted element', count, 'with color', color);
    }
  });
  
  console.log('DEBUG: Total highlighted:', count);
  
  // Show notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = `🎨 HIGHLIGHTED ${count} ELEMENTS!`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
  
  return count;
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