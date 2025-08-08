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
    
    // Just get the fucking text directly from the page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageTextDirect
    });
    
    const pageText = results && results[0] && results[0].result ? results[0].result : '';
    
    if (!pageText || pageText.trim().length === 0) {
      showStatus('No text found on page', 'error');
      analyzeBtn.classList.remove('loading');
      return;
    }
    
    console.log('Got page text, length:', pageText.length);
    
    // Call Gemini API directly
    const emotions = await callGeminiAPI(pageText);
    
    if (emotions && emotions.length > 0) {
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
    console.error('Error:', error);
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
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  const text = data.candidates[0].parts[0].text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]).slice(0, 50);
  }
  
  return [];
}

// Direct highlighting function
function applyHighlightsDirect(emotions) {
  const emotionColors = {
    happy: '#FFE4E6', sad: '#E0F2FE', angry: '#FEF2F2',
    excited: '#FFF4E6', worried: '#F0F9FF', surprised: '#F5F3FF',
    trusting: '#F0FDF4', calm: '#F9FAFB'
  };
  
  emotions.forEach(emotion => {
    const text = emotion.text.trim();
    const color = emotionColors[emotion.emotion] || '#F9FAFB';
    
    // Find and highlight the text
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue.includes(text.substring(0, 30))) {
        const parent = node.parentElement;
        if (parent && !parent.classList.contains('emotion-highlight')) {
          const span = document.createElement('span');
          span.className = 'emotion-highlight';
          span.style.backgroundColor = color;
          span.style.padding = '2px 4px';
          span.style.borderRadius = '3px';
          span.style.display = 'inline';
          
          parent.insertBefore(span, node);
          span.appendChild(node);
          break;
        }
      }
    }
  });
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