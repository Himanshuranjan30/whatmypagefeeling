// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  try {
    if (request.action === 'getPageContent') {
      // Get all text content from the page
      const content = extractPageText();
      console.log('Extracted content length:', content.length);
      sendResponse({ content: content });
    } else if (request.action === 'applyEmotionColors') {
      // Apply emotion colors to the page
      applyEmotionColors(request.emotions);
      sendResponse({ success: true });
    } else if (request.action === 'clearHighlights') {
      // Clear existing highlights
      clearAllHighlights();
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ error: error.message });
  }
  
  return true;
});

// Extract text content from the page with better structure preservation
function extractPageText() {
  try {
    if (!document.body) {
      console.warn('No document body found');
      return '';
    }
    
    // Get text from meaningful elements while preserving structure
    const meaningfulElements = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th, blockquote, article, section'
    );
    
    const textBlocks = [];
    
    meaningfulElements.forEach(element => {
      // Skip if element is inside script, style, or already processed
      if (isSkippableElement(element)) return;
      
      const text = element.textContent?.trim();
      if (text && text.length > 20 && text.length < 500) {
        // Avoid duplicates by checking if this text is already captured
        const isDuplicate = textBlocks.some(block => 
          block.includes(text) || text.includes(block)
        );
        
        if (!isDuplicate) {
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

// Check if element should be skipped
function isSkippableElement(element) {
  if (!element || !element.parentElement) return true;
  
  // Skip script, style, and other non-content elements
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS'];
  if (skipTags.includes(element.tagName)) return true;
  
  // Skip if parent is skippable
  let parent = element.parentElement;
  while (parent) {
    if (skipTags.includes(parent.tagName)) return true;
    if (parent.classList.contains('emotion-highlight')) return true;
    parent = parent.parentElement;
  }
  
  // Skip hidden elements
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  
  return false;
}

// Apply emotion colors with improved text matching and layout preservation
function applyEmotionColors(emotions) {
  console.log('Content script: Applying emotions:', emotions?.length || 0);
  
  if (!emotions || emotions.length === 0) {
    showNotification('No emotions to apply', 'error');
    return;
  }
  
  // Clear existing highlights first
  clearAllHighlights();
  
  // Show processing notification
  showNotification(`Processing ${emotions.length} emotion blocks...`, 'info');
  
  // Define emotion colors with better contrast
  const emotionColors = {
    happy: { bg: '#FFF9C4', border: '#F59E0B' },
    excited: { bg: '#FFF9C4', border: '#F59E0B' },
    sad: { bg: '#DBEAFE', border: '#3B82F6' },
    angry: { bg: '#FEE2E2', border: '#EF4444' },
    frustrated: { bg: '#FEE2E2', border: '#EF4444' },
    love: { bg: '#FCE7F3', border: '#EC4899' },
    fear: { bg: '#EDE9FE', border: '#8B5CF6' },
    worried: { bg: '#EDE9FE', border: '#8B5CF6' },
    neutral: { bg: '#F3F4F6', border: '#6B7280' },
    calm: { bg: '#F3F4F6', border: '#6B7280' },
    surprise: { bg: '#FED7AA', border: '#F97316' },
    surprised: { bg: '#FED7AA', border: '#F97316' },
    disgust: { bg: '#E7E5E4', border: '#78716C' },
    trust: { bg: '#D1FAE5', border: '#10B981' },
    trusting: { bg: '#D1FAE5', border: '#10B981' },
    anticipation: { bg: '#FECACA', border: '#F87171' }
  };

  let totalHighlighted = 0;
  const processedTexts = new Set();

  // Process each emotion with improved matching
  emotions.forEach(({ text: emotionText, emotion }, index) => {
    if (!emotionText || emotionText.length < 10) return;
    
    // Avoid processing duplicate texts
    const textKey = emotionText.toLowerCase().trim();
    if (processedTexts.has(textKey)) return;
    processedTexts.add(textKey);
    
    const colors = emotionColors[emotion.toLowerCase()] || emotionColors.calm;
    const highlighted = highlightTextImproved(emotionText, colors, emotion);
    totalHighlighted += highlighted;
    
    // Add small delay to prevent blocking
    if (index % 10 === 0) {
      setTimeout(() => {}, 1);
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
}

// Improved text highlighting with better matching and layout preservation
function highlightTextImproved(searchText, colors, emotion) {
  if (!searchText || searchText.length < 10) return 0;
  
  console.log(`Highlighting: "${searchText.substring(0, 50)}..." (${emotion})`);
  
  let highlightedCount = 0;
  
  // Clean and prepare search text
  const cleanSearch = searchText.toLowerCase().trim();
  const searchWords = cleanSearch.split(/\s+/).filter(w => w.length > 2);
  
  // Find all text nodes that could contain this text
  const textNodes = getAllTextNodes();
  
  textNodes.forEach(node => {
    if (highlightedCount >= 3) return; // Limit highlights per emotion to prevent over-highlighting
    
    const nodeText = node.textContent;
    const cleanNode = nodeText.toLowerCase().trim();
    
    if (shouldHighlightNode(cleanNode, cleanSearch, searchWords)) {
      const success = wrapTextNode(node, colors, emotion);
      if (success) {
        highlightedCount++;
        console.log(`✓ Highlighted: "${nodeText.substring(0, 30)}..."`);
      }
    }
  });
  
  return highlightedCount;
}

// Improved text matching logic
function shouldHighlightNode(nodeText, searchText, searchWords) {
  // Direct substring match
  if (nodeText.includes(searchText)) return true;
  
  // Word overlap match (at least 60% of words should match)
  if (searchWords.length > 2) {
    const matchingWords = searchWords.filter(word => nodeText.includes(word));
    if (matchingWords.length >= Math.ceil(searchWords.length * 0.6)) return true;
  }
  
  // Reverse match for shorter nodes
  if (nodeText.length > 20 && searchText.includes(nodeText)) return true;
  
  return false;
}

// Safely wrap text node without breaking layout
function wrapTextNode(textNode, colors, emotion) {
  try {
    const parent = textNode.parentElement;
    if (!parent || parent.classList.contains('emotion-highlight')) return false;
    
    // Check if parent is suitable for highlighting
    if (!isSuitableForHighlighting(parent)) return false;
    
    // Create highlight wrapper
    const wrapper = document.createElement('span');
    wrapper.className = 'emotion-highlight';
    wrapper.setAttribute('data-emotion', emotion);
    wrapper.setAttribute('data-original-text', textNode.textContent.substring(0, 100));
    
    // Apply styles that preserve layout
    wrapper.style.cssText = `
      background-color: ${colors.bg} !important;
      border-left: 3px solid ${colors.border} !important;
      padding: 1px 3px !important;
      border-radius: 3px !important;
      display: inline !important;
      position: relative !important;
      transition: all 0.2s ease !important;
      box-decoration-break: clone !important;
      -webkit-box-decoration-break: clone !important;
      line-height: inherit !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      color: inherit !important;
      text-decoration: inherit !important;
      margin: 0 !important;
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

// Check if element is suitable for highlighting
function isSuitableForHighlighting(element) {
  // Skip certain elements that might break layout
  const unsuitableTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'CODE', 'PRE'];
  if (unsuitableTags.includes(element.tagName)) return false;
  
  // Skip elements with certain classes
  const unsuitableClasses = ['btn', 'button', 'nav', 'menu', 'toolbar'];
  if (unsuitableClasses.some(cls => element.classList.contains(cls))) return false;
  
  // Skip very small elements
  const rect = element.getBoundingClientRect();
  if (rect.width < 50 || rect.height < 20) return false;
  
  return true;
}

// Add hover effects to highlighted elements
function addHoverEffects(wrapper, colors, emotion) {
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.backgroundColor = colors.border + '20';
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
  tooltip.textContent = `Emotion: ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`;
  
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    z-index: 10000;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(tooltip);
  
  // Position tooltip
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width - tooltipRect.width) / 2;
  
  // Adjust if tooltip goes off screen
  if (top < 0) top = rect.bottom + 8;
  if (left < 0) left = 8;
  if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 8;
  
  tooltip.style.top = top + window.scrollY + 'px';
  tooltip.style.left = left + window.scrollX + 'px';
}

// Hide tooltip
function hideTooltip() {
  const existing = document.querySelector('.emotion-tooltip');
  if (existing) existing.remove();
}

// Get all text nodes efficiently
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
        if (!parent || isSkippableElement(parent)) {
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

// Clear all existing highlights
function clearAllHighlights() {
  const highlights = document.querySelectorAll('.emotion-highlight');
  highlights.forEach(highlight => {
    // Move children out of highlight wrapper
    while (highlight.firstChild) {
      highlight.parentNode.insertBefore(highlight.firstChild, highlight);
    }
    // Remove the wrapper
    highlight.remove();
  });
  
  // Remove any tooltips
  hideTooltip();
  
  console.log(`Cleared ${highlights.length} existing highlights`);
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease;
  `;
  
  // Add slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Initialize content script
if (!window.whatMyPageFeelingLoaded) {
  window.whatMyPageFeelingLoaded = true;
  console.log('What My Page Feeling content script loaded successfully');
  
  // Add global styles for highlights
  const globalStyles = document.createElement('style');
  globalStyles.textContent = `
    .emotion-highlight {
      box-sizing: border-box !important;
    }
    .emotion-highlight:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
    }
  `;
  document.head.appendChild(globalStyles);
  
  console.log('Content script ready for emotion analysis');
}