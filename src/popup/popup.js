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
  console.log('Starting highlight process with', emotions.length, 'emotions');
  
  const emotionColors = {
    happy: '#FFE4E6', sad: '#E0F2FE', angry: '#FEF2F2',
    excited: '#FFF4E6', worried: '#F0F9FF', surprised: '#F5F3FF',
    trusting: '#F0FDF4', calm: '#F9FAFB'
  };
  
  // Remove existing highlights first
  document.querySelectorAll('.emotion-highlight').forEach(el => {
    const parent = el.parentNode;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  });
  
  let highlightCount = 0;
  
  emotions.forEach((emotion, index) => {
    console.log(`Processing emotion ${index}:`, emotion);
    const searchText = emotion.text.trim();
    const color = emotionColors[emotion.emotion] || '#F9FAFB';
    
    if (searchText.length < 5) return; // Skip very short text
    
    // Find all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and already highlighted nodes
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (parent.classList.contains('emotion-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    let node;
    let found = false;
    
    while (node = walker.nextNode() && !found) {
      const nodeText = node.nodeValue.toLowerCase().trim();
      const searchLower = searchText.toLowerCase().trim();
      
      // Try different matching strategies
      let match = false;
      
      // Strategy 1: Direct substring match
      if (nodeText.includes(searchLower.substring(0, 20))) {
        match = true;
      }
      
      // Strategy 2: Word-based matching (at least 3 words match)
      if (!match) {
        const nodeWords = nodeText.split(/\s+/).filter(w => w.length > 2);
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
        
        if (searchWords.length >= 3) {
          const matchingWords = searchWords.filter(word => 
            nodeWords.some(nodeWord => nodeWord.includes(word) || word.includes(nodeWord))
          );
          
          if (matchingWords.length >= Math.min(3, searchWords.length * 0.6)) {
            match = true;
          }
        }
      }
      
      if (match) {
        console.log(`Found match for "${searchText}" in node:`, nodeText.substring(0, 50));
        
        const parent = node.parentElement;
        if (parent) {
          // Create highlight span
          const span = document.createElement('span');
          span.className = 'emotion-highlight';
          span.style.cssText = `
            background-color: ${color} !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            display: inline !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
          `;
          span.setAttribute('data-emotion', emotion.emotion);
          span.setAttribute('title', `Emotion: ${emotion.emotion}`);
          
          // Replace the text node with highlighted span
          parent.insertBefore(span, node);
          span.appendChild(node);
          
          highlightCount++;
          found = true;
          
          console.log(`Applied highlight #${highlightCount} for emotion: ${emotion.emotion}`);
        }
      }
    }
    
    if (!found) {
      console.log(`No match found for: "${searchText}"`);
    }
  });
  
  console.log(`Highlighting complete! Applied ${highlightCount} highlights out of ${emotions.length} emotions.`);
  
  // Add a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: #4CAF50 !important;
    color: white !important;
    padding: 12px 20px !important;
    border-radius: 6px !important;
    z-index: 999999 !important;
    font-family: Arial, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
  `;
  notification.textContent = `✨ Highlighted ${highlightCount} text blocks with emotions!`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
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