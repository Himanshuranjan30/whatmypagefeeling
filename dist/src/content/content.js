// Content script for What My Page Feeling extension
console.log('What My Page Feeling content script loaded');

// Global flag to prevent multiple initializations
if (!window.whatMyPageFeelingLoaded) {
  window.whatMyPageFeelingLoaded = true;
  
  // Add global styles for highlights
  const globalStyles = document.createElement('style');
  globalStyles.id = 'emotion-highlight-styles';
  globalStyles.textContent = `
    .emotion-highlight {
      box-sizing: border-box !important;
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
      vertical-align: baseline !important;
    }
    
    .emotion-highlight:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      z-index: 1000 !important;
    }
    
    .emotion-tooltip {
      position: absolute !important;
      background: rgba(0, 0, 0, 0.9) !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
      z-index: 10001 !important;
      pointer-events: none !important;
      font-family: Arial, sans-serif !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    }
    
    .emotion-notification {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      z-index: 999999 !important;
      font-family: Arial, sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      max-width: 300px !important;
      word-wrap: break-word !important;
      pointer-events: none !important;
    }
    
    /* Ensure highlights work well with different text elements */
    h1 .emotion-highlight,
    h2 .emotion-highlight,
    h3 .emotion-highlight,
    h4 .emotion-highlight,
    h5 .emotion-highlight,
    h6 .emotion-highlight {
      font-weight: inherit !important;
      font-size: inherit !important;
    }
    
    p .emotion-highlight,
    span .emotion-highlight,
    div .emotion-highlight {
      line-height: inherit !important;
    }
    
    a .emotion-highlight {
      text-decoration: inherit !important;
      color: inherit !important;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .emotion-highlight {
        padding: 1px 2px !important;
      }
      
      .emotion-tooltip {
        font-size: 11px !important;
        padding: 3px 6px !important;
      }
      
      .emotion-notification {
        right: 10px !important;
        top: 10px !important;
        max-width: 250px !important;
        font-size: 13px !important;
      }
    }
    
    /* Print styles - hide highlights when printing */
    @media print {
      .emotion-highlight {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
      }
      
      .emotion-tooltip,
      .emotion-notification {
        display: none !important;
      }
    }
  `;
  
  // Only add styles if they don't exist
  if (!document.getElementById('emotion-highlight-styles')) {
    document.head.appendChild(globalStyles);
  }
  
  console.log('Content script initialized successfully');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  try {
    if (request.action === 'getPageContent') {
      const content = extractPageText();
      console.log('Extracted content length:', content.length);
      sendResponse({ content: content });
    } else if (request.action === 'applyEmotionColors') {
      const result = applyEmotionColors(request.emotions);
      sendResponse({ success: true, count: result });
    } else if (request.action === 'clearHighlights') {
      const count = clearAllHighlights();
      sendResponse({ success: true, count: count });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ error: error.message });
  }
  
  return true;
});

// Extract meaningful text content from the page
function extractPageText() {
  try {
    if (!document.body) {
      console.warn('No document body found');
      return '';
    }
    
    // Get text from meaningful elements
    const meaningfulElements = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, span:not(.emotion-highlight), div, a, li, td, th, blockquote, article, section'
    );
    
    const textBlocks = [];
    const seenTexts = new Set();
    
    meaningfulElements.forEach(element => {
      // Skip if element should be ignored
      if (shouldSkipElement(element)) return;
      
      const text = element.textContent?.trim();
      if (text && text.length > 15 && text.length < 500) {
        // Avoid duplicates
        const textKey = text.toLowerCase().substring(0, 50);
        if (!seenTexts.has(textKey)) {
          seenTexts.add(textKey);
          textBlocks.push(text);
        }
      }
    });
    
    const combinedText = textBlocks.join(' ');
    console.log('Text extraction complete. Blocks:', textBlocks.length, 'Total length:', combinedText.length);
    return combinedText;
  } catch (error) {
    console.error('Error extracting page text:', error);
    return '';
  }
}

// Check if element should be skipped during text extraction
function shouldSkipElement(element) {
  if (!element || !element.parentElement) return true;
  
  // Skip script, style, and other non-content elements
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS', 'NAV', 'HEADER', 'FOOTER'];
  if (skipTags.includes(element.tagName)) return true;
  
  // Skip already highlighted elements
  if (element.classList.contains('emotion-highlight')) return true;
  
  // Skip if parent is skippable
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (skipTags.includes(parent.tagName)) return true;
    if (parent.classList.contains('emotion-highlight')) return true;
    parent = parent.parentElement;
  }
  
  // Skip hidden elements
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  
  return false;
}

// Apply emotion colors to the page
function applyEmotionColors(emotions) {
  console.log('Applying emotions:', emotions?.length || 0);
  
  if (!emotions || emotions.length === 0) {
    showNotification('No emotions to apply', 'error');
    return 0;
  }
  
  // Clear existing highlights first
  clearAllHighlights();
  
  // Show processing notification
  showNotification(`Processing ${emotions.length} emotion blocks...`, 'info');
  
  // Define emotion colors
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

  let totalHighlighted = 0;
  const processedTexts = new Set();

  // Process each emotion
  emotions.forEach(({ text: emotionText, emotion }, index) => {
    if (!emotionText || emotionText.length < 15) return;
    if (totalHighlighted >= 15) return; // Limit total highlights
    
    // Avoid processing duplicate texts
    const textKey = emotionText.toLowerCase().trim();
    if (processedTexts.has(textKey)) return;
    processedTexts.add(textKey);
    
    const colors = emotionColors[emotion.toLowerCase()] || emotionColors.calm;
    const highlighted = highlightText(emotionText, colors, emotion);
    if (highlighted) {
      totalHighlighted++;
      console.log(`✓ Highlighted: "${emotionText.substring(0, 30)}..." as ${emotion}`);
    }
  });

  console.log(`Total highlighted: ${totalHighlighted} elements`);
  
  // Show completion notification
  setTimeout(() => {
    if (totalHighlighted > 0) {
      showNotification(`✨ Highlighted ${totalHighlighted} text sections!`, 'success');
    } else {
      showNotification('No matching text found to highlight', 'warning');
    }
  }, 500);
  
  return totalHighlighted;
}

// Highlight specific text on the page
function highlightText(searchText, colors, emotion) {
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const minWordMatch = Math.max(2, Math.ceil(searchWords.length * 0.6));
  
  // Get all text nodes
  const textNodes = getAllTextNodes();
  
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
    return wrapTextNode(bestMatch, colors, emotion);
  }
  
  return false;
}

// Get all valid text nodes
function getAllTextNodes() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip empty or very short text
        if (!node.nodeValue?.trim() || node.nodeValue.trim().length < 10) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if parent is not suitable
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) {
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
  
  return textNodes;
}

// Wrap text node with highlight
function wrapTextNode(textNode, colors, emotion) {
  try {
    const parent = textNode.parentElement;
    if (!parent || parent.classList.contains('emotion-highlight')) return false;
    
    // Create highlight wrapper
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
    
    // Insert wrapper and move text node
    parent.insertBefore(wrapper, textNode);
    wrapper.appendChild(textNode);
    
    // Add hover effects
    addHoverEffects(wrapper, colors, emotion);
    
    return true;
  } catch (error) {
    console.error('Error wrapping text node:', error);
    return false;
  }
}

// Add hover effects to highlighted elements
function addHoverEffects(wrapper, colors, emotion) {
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.backgroundColor = colors.border + '30';
    wrapper.style.transform = 'scale(1.02)';
    wrapper.style.zIndex = '1000';
    showTooltip(wrapper, emotion);
  });
  
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.backgroundColor = colors.bg;
    wrapper.style.transform = 'scale(1)';
    wrapper.style.zIndex = 'auto';
    hideTooltip();
  });
}

// Show emotion tooltip
function showTooltip(element, emotion) {
  hideTooltip(); // Remove any existing tooltip
  
  const tooltip = document.createElement('div');
  tooltip.className = 'emotion-tooltip';
  tooltip.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
  
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    z-index: 10001;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
  `;
  
  element.appendChild(tooltip);
}

// Hide tooltip
function hideTooltip() {
  const existing = document.querySelectorAll('.emotion-tooltip');
  existing.forEach(tooltip => tooltip.remove());
}

// Clear all existing highlights
function clearAllHighlights() {
  const highlights = document.querySelectorAll('.emotion-highlight');
  let count = 0;
  
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
    count++;
  });
  
  // Remove any tooltips and notifications
  document.querySelectorAll('.emotion-tooltip, .emotion-notification').forEach(el => el.remove());
  
  console.log(`Cleared ${count} existing highlights`);
  return count;
}

// Show notification to user
function showNotification(message, type = 'info') {
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