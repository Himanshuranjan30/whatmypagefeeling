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
    
    // Inject content script if needed and extract text
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
      
      // Clear existing highlights first
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: clearHighlightsDirect
      });
      
      // Apply new highlights
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: applyHighlightsDirect,
        args: [emotions]
      });
      
      showStatus(`✨ Analysis complete! Highlighted ${emotions.length} emotion sections.`, 'success');
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
      'span', 'div', 'a', 'li', 'td', 'th', 
      'blockquote', 'article', 'section'
    ];
    
    const elements = document.querySelectorAll(selectors.join(', '));
    const textBlocks = [];
    const seenTexts = new Set();
    
    elements.forEach(el => {
      // Skip hidden or script elements
      if (el.offsetParent === null) return;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;
      
      const text = el.textContent?.trim();
      if (text && text.length > 20 && text.length < 1000) {
        const textKey = text.toLowerCase().substring(0, 100);
        if (!seenTexts.has(textKey)) {
          seenTexts.add(textKey);
          textBlocks.push(text);
        }
      }
    });
    
    return textBlocks.join(' ').substring(0, 30000); // Limit for API
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

// Improved emotion analysis with better prompting
async function analyzeEmotionsImproved(content) {
  const API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `Analyze the emotional tone of this webpage content. Extract 15-25 meaningful text snippets that have clear emotional content.

For each snippet, provide:
1. The EXACT text from the content (10-80 words)
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
- Ensure text snippets are substantial (not just single words)
- Return 15-25 results maximum

Content to analyze:
${content.substring(0, 25000)}`;

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
          maxOutputTokens: 4096,
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
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
        .filter(item => item.text.length >= 10 && item.text.length <= 200)
        .slice(0, 25); // Limit results
      
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

// Clear highlights function
function clearHighlightsDirect() {
  const highlights = document.querySelectorAll('.emotion-highlight');
  highlights.forEach(highlight => {
    while (highlight.firstChild) {
      highlight.parentNode.insertBefore(highlight.firstChild, highlight);
    }
    highlight.remove();
  });
  
  // Remove tooltips
  const tooltips = document.querySelectorAll('.emotion-tooltip');
  tooltips.forEach(tooltip => tooltip.remove());
  
  console.log(`Cleared ${highlights.length} highlights`);
}

// Improved highlighting function
function applyHighlightsDirect(emotions) {
  console.log('Applying highlights for', emotions.length, 'emotions');
  
  if (!emotions || emotions.length === 0) return 0;
  
  // Emotion color scheme
  const emotionColors = {
    happy: { bg: '#FFF9C4', border: '#F59E0B' },
    excited: { bg: '#FFF9C4', border: '#F59E0B' },
    sad: { bg: '#DBEAFE', border: '#3B82F6' },
    angry: { bg: '#FEE2E2', border: '#EF4444' },
    frustrated: { bg: '#FEE2E2', border: '#EF4444' },
    love: { bg: '#FCE7F3', border: '#EC4899' },
    worried: { bg: '#EDE9FE', border: '#8B5CF6' },
    neutral: { bg: '#F3F4F6', border: '#6B7280' },
    calm: { bg: '#F3F4F6', border: '#6B7280' },
    surprised: { bg: '#FED7AA', border: '#F97316' },
    trusting: { bg: '#D1FAE5', border: '#10B981' }
  };
  
  let highlightCount = 0;
  const processedTexts = new Set();
  
  // Get all text nodes
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.nodeValue?.trim() || node.nodeValue.trim().length < 10) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  console.log('Found', textNodes.length, 'text nodes');
  
  // Process each emotion
  emotions.forEach(({ text: emotionText, emotion }) => {
    if (highlightCount >= 20) return; // Limit total highlights
    
    const textKey = emotionText.toLowerCase().trim();
    if (processedTexts.has(textKey)) return;
    processedTexts.add(textKey);
    
    const colors = emotionColors[emotion] || emotionColors.calm;
    const searchWords = emotionText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Find matching text nodes
    for (let i = 0; i < textNodes.length && highlightCount < 20; i++) {
      const textNode = textNodes[i];
      const nodeText = textNode.nodeValue.toLowerCase();
      
      // Check for match
      let isMatch = false;
      if (nodeText.includes(emotionText.toLowerCase())) {
        isMatch = true;
      } else if (searchWords.length > 2) {
        const matchingWords = searchWords.filter(word => nodeText.includes(word));
        if (matchingWords.length >= Math.ceil(searchWords.length * 0.6)) {
          isMatch = true;
        }
      }
      
      if (isMatch && !textNode.parentElement.classList.contains('emotion-highlight')) {
        try {
          const wrapper = document.createElement('span');
          wrapper.className = 'emotion-highlight';
          wrapper.setAttribute('data-emotion', emotion);
          
          wrapper.style.cssText = `
            background-color: ${colors.bg} !important;
            border-left: 3px solid ${colors.border} !important;
            padding: 1px 3px !important;
            border-radius: 3px !important;
            display: inline !important;
            transition: all 0.2s ease !important;
            position: relative !important;
            line-height: inherit !important;
            font-size: inherit !important;
            color: inherit !important;
          `;
          
          // Add hover effect
          wrapper.addEventListener('mouseenter', function() {
            this.style.backgroundColor = colors.border + '30';
            this.style.transform = 'scale(1.02)';
            
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
              z-index: 10000;
              pointer-events: none;
              top: -30px;
              left: 50%;
              transform: translateX(-50%);
            `;
            this.appendChild(tooltip);
          });
          
          wrapper.addEventListener('mouseleave', function() {
            this.style.backgroundColor = colors.bg;
            this.style.transform = 'scale(1)';
            const tooltip = this.querySelector('.emotion-tooltip');
            if (tooltip) tooltip.remove();
          });
          
          textNode.parentNode.insertBefore(wrapper, textNode);
          wrapper.appendChild(textNode);
          highlightCount++;
          
          break; // Only highlight once per emotion text
        } catch (error) {
          console.error('Error highlighting text:', error);
        }
      }
    }
  });
  
  console.log('Applied', highlightCount, 'highlights');
  
  // Show completion notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10B981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;
  notification.textContent = `✨ Highlighted ${highlightCount} emotion sections!`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
  
  return highlightCount;
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
            function: clearHighlightsDirect
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