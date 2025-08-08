// DOM elements
const analyzeBtn = document.getElementById('analyzeBtn');
const statusMessage = document.getElementById('statusMessage');

// Show emotion preview on load
const emotionPreview = document.getElementById('emotionPreview');
emotionPreview.style.display = 'block';

// Analyze button click handler
analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.classList.add('loading');
  statusMessage.classList.remove('show');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab?.url);
    
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    
    // Check if we can access this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot analyze browser internal pages. Please navigate to a regular website.');
    }
    
    showStatus('Extracting page content...', 'info');
    
    // Extract page text directly
    let pageText;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageText
      });
      
      pageText = results?.[0]?.result || '';
    } catch (scriptError) {
      console.error('Script execution failed:', scriptError);
      throw new Error('Failed to access page content. Please refresh the page and try again.');
    }
    
    console.log('Extracted text length:', pageText.length);
    
    if (!pageText || pageText.trim().length < 50) {
      throw new Error('Not enough text content found on this page to analyze.');
    }
    
    showStatus('Analyzing emotions with AI...', 'info');
    
    // Analyze emotions
    const emotions = await analyzeEmotions(pageText);
    console.log('Emotions found:', emotions.length);
    
    if (emotions && emotions.length > 0) {
      showStatus('Applying highlights to page...', 'info');
      
      // Apply highlights
      try {
        const highlightResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: applyHighlights,
          args: [emotions]
        });
        
        const highlightCount = highlightResults?.[0]?.result || 0;
        console.log('Highlight count:', highlightCount);
        
        if (highlightCount > 0) {
          showStatus(`✨ Analysis complete! Highlighted ${highlightCount} emotion sections.`, 'success');
        } else {
          showStatus('Analysis complete but no text could be highlighted. Try a different page.', 'warning');
        }
      } catch (highlightError) {
        console.error('Highlighting failed:', highlightError);
        showStatus('Analysis complete but highlighting failed. The page may have restrictions.', 'warning');
      }
    } else {
      showStatus('No clear emotions detected in the page content.', 'warning');
    }
    
  } catch (error) {
    console.error('Analysis error:', error);
    showStatus('Error: ' + error.message, 'error');
  }
  
  analyzeBtn.classList.remove('loading');
});

// Extract text from page - simplified and more reliable
function extractPageText() {
  console.log('Starting text extraction...');
  
  // Remove any existing highlights first
  const existingHighlights = document.querySelectorAll('.emotion-highlight');
  existingHighlights.forEach(highlight => {
    const parent = highlight.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize();
    }
  });
  
  // Get text from meaningful elements
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'div', 'span', 'a', 'li', 'td', 'th', 
    'blockquote', 'article', 'section'
  ];
  
  const elements = document.querySelectorAll(selectors.join(', '));
  const textBlocks = [];
  const seenTexts = new Set();
  
  elements.forEach(el => {
    // Skip hidden elements
    if (el.offsetParent === null) return;
    
    // Skip script, style, nav elements
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'].includes(el.tagName)) return;
    
    // Skip if parent is also in our selector list (avoid duplicates)
    if (el.parentElement && selectors.some(sel => el.parentElement.matches && el.parentElement.matches(sel))) {
      return;
    }
    
    const text = el.textContent?.trim();
    if (text && text.length > 20 && text.length < 300) {
      const textKey = text.toLowerCase().substring(0, 50);
      if (!seenTexts.has(textKey)) {
        seenTexts.add(textKey);
        textBlocks.push(text);
      }
    }
  });
  
  const result = textBlocks.join('\n').substring(0, 20000);
  console.log('Extracted text blocks:', textBlocks.length, 'Total length:', result.length);
  return result;
}

// Analyze emotions with Gemini API
async function analyzeEmotions(content) {
  const API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `Analyze this webpage content and identify text snippets with clear emotions.

Extract 8-15 text snippets that express emotions. For each snippet:
1. Use EXACT text from the content (20-150 words)
2. Identify the primary emotion

Available emotions: happy, sad, angry, excited, worried, surprised, trusting, calm, love, frustrated

Return ONLY a valid JSON array:
[
  {"text": "exact text from webpage", "emotion": "happy"},
  {"text": "another exact text snippet", "emotion": "worried"}
]

Rules:
- Use EXACT text from content, don't modify it
- Skip navigation, headers, technical content
- Focus on meaningful content with clear emotions
- Each snippet should be 20+ words
- Return 8-15 results maximum

Content:
${content}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 2000,
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid API response');
    }
    
    const responseText = data.candidates[0].content.parts[0].text;
    console.log('API response:', responseText.substring(0, 200));
    
    // Extract JSON
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const emotions = JSON.parse(jsonMatch[0]);
    
    // Validate emotions
    const validEmotions = ['happy', 'sad', 'angry', 'excited', 'worried', 'surprised', 'trusting', 'calm', 'love', 'frustrated'];
    
    const cleanedEmotions = emotions
      .filter(item => item.text && item.emotion && typeof item.text === 'string')
      .map(item => ({
        text: item.text.trim(),
        emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                 ? item.emotion.toLowerCase() 
                 : 'calm'
      }))
      .filter(item => item.text.length >= 20 && item.text.length <= 300)
      .slice(0, 12);
    
    console.log(`Processed ${cleanedEmotions.length} valid emotions`);
    return cleanedEmotions;
    
  } catch (error) {
    console.error('API call failed:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

// Apply highlights to page - completely rewritten for reliability
function applyHighlights(emotions) {
  console.log('Applying highlights for', emotions.length, 'emotions');
  
  if (!emotions || emotions.length === 0) {
    return 0;
  }
  
  // Emotion colors
  const emotionColors = {
    happy: '#FFF9C4',
    excited: '#FFF9C4', 
    sad: '#DBEAFE',
    angry: '#FEE2E2',
    frustrated: '#FEE2E2',
    love: '#FCE7F3',
    worried: '#EDE9FE',
    calm: '#F3F4F6',
    surprised: '#FED7AA',
    trusting: '#D1FAE5'
  };
  
  let highlightCount = 0;
  const processedTexts = new Set();
  
  // Process each emotion
  emotions.forEach(({ text: emotionText, emotion }) => {
    if (highlightCount >= 10) return; // Limit highlights
    
    const textKey = emotionText.toLowerCase().trim();
    if (processedTexts.has(textKey)) return;
    processedTexts.add(textKey);
    
    const color = emotionColors[emotion] || emotionColors.calm;
    
    // Find and highlight text
    if (highlightTextSimple(emotionText, color, emotion)) {
      highlightCount++;
      console.log(`✓ Highlighted: "${emotionText.substring(0, 30)}..." as ${emotion}`);
    }
  });
  
  console.log('Total highlights applied:', highlightCount);
  
  // Show notification
  if (highlightCount > 0) {
    showNotification(`✨ Highlighted ${highlightCount} emotion sections!`, 'success');
  }
  
  return highlightCount;
}

// Simple, reliable text highlighting
function highlightTextSimple(searchText, backgroundColor, emotion) {
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  // Get all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 10) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip certain elements
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'];
        if (skipTags.includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip already highlighted
        if (parent.classList && parent.classList.contains('emotion-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Find best match
  let bestMatch = null;
  let bestScore = 0;
  
  textNodes.forEach(textNode => {
    const nodeText = textNode.nodeValue.toLowerCase();
    
    // Try exact substring match first
    if (nodeText.includes(searchText.toLowerCase().substring(0, 50))) {
      bestMatch = textNode;
      bestScore = 100;
      return;
    }
    
    // Try word matching
    const matchingWords = searchWords.filter(word => nodeText.includes(word));
    const score = matchingWords.length;
    
    if (score >= Math.min(3, searchWords.length * 0.6) && score > bestScore) {
      bestMatch = textNode;
      bestScore = score;
    }
  });
  
  // Highlight the best match
  if (bestMatch) {
    try {
      const parent = bestMatch.parentElement;
      if (!parent) return false;
      
      // Create highlight wrapper
      const wrapper = document.createElement('span');
      wrapper.className = 'emotion-highlight';
      wrapper.style.cssText = `
        background-color: ${backgroundColor} !important;
        padding: 2px 4px !important;
        border-radius: 3px !important;
        border-left: 3px solid ${backgroundColor.replace('C4', '00')} !important;
        display: inline !important;
        position: relative !important;
        cursor: help !important;
      `;
      
      // Add hover tooltip
      wrapper.addEventListener('mouseenter', function() {
        const tooltip = document.createElement('div');
        tooltip.className = 'emotion-tooltip';
        tooltip.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        tooltip.style.cssText = `
          position: absolute;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10000;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        `;
        this.appendChild(tooltip);
      });
      
      wrapper.addEventListener('mouseleave', function() {
        const tooltip = this.querySelector('.emotion-tooltip');
        if (tooltip) tooltip.remove();
      });
      
      // Wrap the text node
      parent.insertBefore(wrapper, bestMatch);
      wrapper.appendChild(bestMatch);
      
      return true;
    } catch (error) {
      console.error('Error highlighting:', error);
      return false;
    }
  }
  
  return false;
}

// Show notification
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.emotion-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'emotion-notification';
  
  const colors = {
    info: '#3B82F6',
    success: '#10B981', 
    error: '#EF4444',
    warning: '#F59E0B'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 4000);
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
  
  const delay = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, delay);
}

// Add clear highlights button
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('clearBtn')) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.innerHTML = '🧹 Clear Highlights';
    clearBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #6B7280;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 12px;
      transition: background 0.2s;
    `;
    
    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.background = '#4B5563';
    });
    
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.background = '#6B7280';
    });
    
    clearBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              const highlights = document.querySelectorAll('.emotion-highlight');
              highlights.forEach(highlight => {
                const parent = highlight.parentNode;
                if (parent) {
                  parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                  parent.normalize();
                }
              });
              
              document.querySelectorAll('.emotion-tooltip, .emotion-notification').forEach(el => el.remove());
              
              return highlights.length;
            }
          });
          showStatus('Highlights cleared!', 'success');
        }
      } catch (error) {
        showStatus('Error clearing highlights', 'error');
      }
    });
    
    analyzeBtn.parentNode.insertBefore(clearBtn, analyzeBtn.nextSibling);
  }
});