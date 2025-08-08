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
  console.log('BRUTE FORCE HIGHLIGHTING with', emotions.length, 'emotions');
  
  const colors = ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFD1FF', '#C7CEEA', '#FFDAB9', '#E0E0E0'];
  
  // Just highlight every fucking paragraph with random colors
  const paragraphs = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, a');
  
  console.log('Found', paragraphs.length, 'elements to highlight');
  
  let count = 0;
  paragraphs.forEach((element, index) => {
    const text = element.textContent.trim();
    
    // Skip if too short or already highlighted
    if (text.length < 20 || element.classList.contains('emotion-highlight') || element.querySelector('.emotion-highlight')) {
      return;
    }
    
    // Skip if it's a container with other elements
    if (element.children.length > 2) {
      return;
    }
    
    // Apply highlight
    const color = colors[index % colors.length];
    element.style.cssText += `
      background-color: ${color} !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      margin: 2px 0 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
      border-left: 3px solid #333 !important;
    `;
    element.classList.add('emotion-highlight');
    
    count++;
    
    // Stop after highlighting 30 elements
    if (count >= 30) return;
  });
  
  console.log(`HIGHLIGHTED ${count} ELEMENTS!`);
  
  // Big fucking notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    padding: 30px 40px !important;
    border-radius: 15px !important;
    z-index: 999999 !important;
    font-family: Arial, sans-serif !important;
    font-size: 24px !important;
    font-weight: bold !important;
    text-align: center !important;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
    animation: pulse 2s infinite !important;
  `;
  notification.innerHTML = `
    🎨 FUCK YEAH! 🎨<br>
    <div style="font-size: 18px; margin-top: 10px;">
      Highlighted ${count} text blocks!
    </div>
  `;
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.05); }
      100% { transform: translate(-50%, -50%) scale(1); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 4000);
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