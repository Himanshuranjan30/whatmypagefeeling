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
    console.log('Active tab:', tab?.url);
    
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    
    // Check if we can access this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot analyze browser internal pages. Please navigate to a regular website.');
    }
    
    showStatus('Extracting page content...', 'info');
    
    // First inject the content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content.js']
      });
      console.log('Content script injected successfully');
    } catch (injectionError) {
      console.log('Content script already exists or injection failed:', injectionError);
    }
    
    // Extract page text
    let pageText;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageTextDirect
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
    
    // Analyze emotions with improved API call
    const emotions = await analyzeEmotionsImproved(pageText);
    console.log('Emotions found:', emotions.length);
    
    if (emotions && emotions.length > 0) {
      showStatus('Applying highlights to page...', 'info');
      
      // Apply highlights using the content script
      try {
        const highlightResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: applyHighlightsDirect,
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

// Direct text extraction function - improved
function extractPageTextDirect() {
  try {
    if (!document.body) return '';
    
    // Get meaningful text elements
    const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'span:not(.emotion-highlight)', 'div', 'a', 'li', 'td', 'th', 
      'blockquote', 'article', 'section'
    ];
    
    const elements = document.querySelectorAll(selectors.join(', '));
    const textBlocks = [];
    const seenTexts = new Set();
    
    elements.forEach(el => {
      // Skip hidden, script elements, or already highlighted
      if (el.offsetParent === null) return;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'].includes(el.tagName)) return;
      if (el.classList.contains('emotion-highlight')) return;
      
      const text = el.textContent?.trim();
      if (text && text.length > 15 && text.length < 500) {
        const textKey = text.toLowerCase().substring(0, 50);
        if (!seenTexts.has(textKey)) {
          seenTexts.add(textKey);
          textBlocks.push(text);
        }
      }
    });
    
    const result = textBlocks.join(' ').substring(0, 25000); // Limit for API
    console.log('Extracted text blocks:', textBlocks.length, 'Total length:', result.length);
    return result;
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

// Improved emotion analysis with better prompting
async function analyzeEmotionsImproved(content) {
  const API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `Analyze the emotional tone of this webpage content. Extract 10-20 meaningful text snippets that have clear emotional content.

For each snippet, provide:
1. The EXACT text from the content (15-100 words)
2. The primary emotion expressed

Use these emotions only: happy, sad, angry, excited, worried, surprised, trusting, calm, love, frustrated

Return ONLY a valid JSON array in this format:
[
  {"text": "exact text from content", "emotion": "happy"},
  {"text": "another exact text snippet", "emotion": "worried"}
]

Rules:
- Use EXACT text from the content, don't paraphrase
- Skip navigation, headers, and technical text
- Focus on content with clear emotional tone
- Ensure text snippets are substantial (15+ words)
- Return 10-20 results maximum

Content to analyze:
${content.substring(0, 20000)}`;

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
          maxOutputTokens: 3000,
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API response received');
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid API response structure');
    }
    
    const responseText = data.candidates[0].content.parts[0].text;
    console.log('API response text:', responseText.substring(0, 200) + '...');
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      throw new Error('Could not parse emotion data from AI response');
    }
    
    try {
      const emotions = JSON.parse(jsonMatch[0]);
      
      // Validate and clean emotions
      const validEmotions = ['happy', 'sad', 'angry', 'excited', 'worried', 'surprised', 'trusting', 'calm', 'love', 'frustrated'];
      
      const cleanedEmotions = emotions
        .filter(item => item.text && item.emotion && typeof item.text === 'string')
        .map(item => ({
          text: item.text.trim(),
          emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                   ? item.emotion.toLowerCase() 
                   : 'calm'
        }))
        .filter(item => item.text.length >= 15 && item.text.length <= 300)
        .slice(0, 20); // Limit results
      
      console.log(`Processed ${cleanedEmotions.length} valid emotions`);
      return cleanedEmotions;
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonMatch[0]);
      throw new Error('Failed to parse emotion analysis results');
    }
    
  } catch (error) {
    console.error('API call failed:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

// Improved highlighting function that actually works
function applyHighlightsDirect(emotions) {
  console.log('Starting to apply highlights for', emotions.length, 'emotions');
  
  if (!emotions || emotions.length === 0) {
    console.log('No emotions to highlight');
    return 0;
  }
  
  // Clear existing highlights first
  const existingHighlights = document.querySelectorAll('.emotion-highlight');
  existingHighlights.forEach(highlight => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
  });
  
  // Emotion color scheme
  const emotionColors = {
    happy: { bg: '#FFF9C4', border: '#F59E0B' },
    excited: { bg: '#FFF9C4', border: '#F59E0B' },
    sad: { bg: '#DBEAFE', border: '#3B82F6' },
    angry: { bg: '#FEE2E2', border: '#EF4444' },
    frustrated: { bg: '#FEE2E2', border: '#EF4444' },
    love: { bg: '#FCE7F3', border: '#EC4899' },
    worried: { bg: '#EDE9FE', border: '#8B5CF6' },
    calm: { bg: '#F3F4F6', border: '#6B7280' },
    surprised: { bg: '#FED7AA', border: '#F97316' },
    trusting: { bg: '#D1FAE5', border: '#10B981' }
  };
  
  let highlightCount = 0;
  const processedTexts = new Set();
  
  // Process each emotion
  emotions.forEach(({ text: emotionText, emotion }) => {
    if (highlightCount >= 15) return; // Limit total highlights
    
    const textKey = emotionText.toLowerCase().trim();
    if (processedTexts.has(textKey)) return;
    processedTexts.add(textKey);
    
    const colors = emotionColors[emotion] || emotionColors.calm;
    
    // Find and highlight matching text
    const highlighted = findAndHighlightText(emotionText, colors, emotion);
    if (highlighted) {
      highlightCount++;
      console.log(`✓ Highlighted: "${emotionText.substring(0, 50)}..." as ${emotion}`);
    }
  });
  
  console.log('Total highlights applied:', highlightCount);
  
  // Show completion notification
  if (highlightCount > 0) {
    showNotificationDirect(`✨ Highlighted ${highlightCount} emotion sections!`, 'success');
  }
  
  return highlightCount;
}

// Function to find and highlight specific text
function findAndHighlightText(searchText, colors, emotion) {
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const minWordMatch = Math.max(2, Math.ceil(searchWords.length * 0.6));
  
  // Get all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip script, style, and other non-content elements
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip already highlighted elements
        if (parent.classList.contains('emotion-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip very short text
        if (!node.nodeValue || node.nodeValue.trim().length < 10) {
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
  
  // Find best matching text node
  let bestMatch = null;
  let bestScore = 0;
  
  textNodes.forEach(textNode => {
    const nodeText = textNode.nodeValue.toLowerCase();
    
    // Direct substring match (highest priority)
    if (nodeText.includes(searchText.toLowerCase())) {
      if (!bestMatch || searchText.length > bestScore) {
        bestMatch = textNode;
        bestScore = searchText.length;
      }
      return;
    }
    
    // Word-based matching
    const matchingWords = searchWords.filter(word => nodeText.includes(word));
    if (matchingWords.length >= minWordMatch) {
      const score = matchingWords.length;
      if (score > bestScore) {
        bestMatch = textNode;
        bestScore = score;
      }
    }
  });
  
  // Highlight the best match
  if (bestMatch) {
    return highlightTextNode(bestMatch, colors, emotion);
  }
  
  return false;
}

// Function to highlight a specific text node
function highlightTextNode(textNode, colors, emotion) {
  try {
    const parent = textNode.parentElement;
    if (!parent || parent.classList.contains('emotion-highlight')) {
      return false;
    }
    
    // Create wrapper element
    const wrapper = document.createElement('span');
    wrapper.className = 'emotion-highlight';
    wrapper.setAttribute('data-emotion', emotion);
    
    // Apply styles
    wrapper.style.cssText = `
      background-color: ${colors.bg} !important;
      border-left: 3px solid ${colors.border} !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      display: inline !important;
      position: relative !important;
      transition: all 0.2s ease !important;
      line-height: inherit !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      color: inherit !important;
      text-decoration: inherit !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    `;
    
    // Add hover effects
    wrapper.addEventListener('mouseenter', function() {
      this.style.backgroundColor = colors.border + '30';
      this.style.transform = 'scale(1.02)';
      this.style.zIndex = '1000';
      
      // Show tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'emotion-tooltip';
      tooltip.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10001;
        pointer-events: none;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        font-family: Arial, sans-serif;
      `;
      this.appendChild(tooltip);
    });
    
    wrapper.addEventListener('mouseleave', function() {
      this.style.backgroundColor = colors.bg;
      this.style.transform = 'scale(1)';
      this.style.zIndex = 'auto';
      const tooltip = this.querySelector('.emotion-tooltip');
      if (tooltip) tooltip.remove();
    });
    
    // Insert wrapper and move text node
    parent.insertBefore(wrapper, textNode);
    wrapper.appendChild(textNode);
    
    return true;
  } catch (error) {
    console.error('Error highlighting text node:', error);
    return false;
  }
}

// Show notification function
function showNotificationDirect(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.emotion-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'emotion-notification';
  
  const colors = {
    info: { bg: '#3B82F6', text: 'white' },
    success: { bg: '#10B981', text: 'white' },
    error: { bg: '#EF4444', text: 'white' },
    warning: { bg: '#F59E0B', text: 'white' }
  };
  
  const color = colors[type] || colors.info;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${color.bg};
    color: ${color.text};
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
  
  // Auto-hide after delay based on type
  const delay = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, delay);
}

// Add clear highlights button functionality
document.addEventListener('DOMContentLoaded', () => {
  // Add clear button if it doesn't exist
  if (!document.getElementById('clearBtn')) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.className = 'clear-btn';
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
                while (highlight.firstChild) {
                  parent.insertBefore(highlight.firstChild, highlight);
                }
                parent.removeChild(highlight);
              });
              
              // Remove tooltips and notifications
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
    
    // Insert after analyze button
    analyzeBtn.parentNode.insertBefore(clearBtn, analyzeBtn.nextSibling);
  }
});