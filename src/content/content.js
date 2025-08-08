// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Get all text content from the page
    const content = extractPageText();
    sendResponse({ content: content });
  } else if (request.action === 'applyEmotionColors') {
    // Apply emotion colors to the page
    applyEmotionColors(request.emotions);
    sendResponse({ success: true });
  }
  return true;
});

// Extract text content from the page
function extractPageText() {
  // Get all text from body, excluding scripts and styles
  const bodyClone = document.body.cloneNode(true);
  
  // Remove script and style elements
  const scripts = bodyClone.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  // Get text content
  const text = bodyClone.textContent || bodyClone.innerText || '';
  
  // Clean up the text
  return text
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')  // Replace newlines with space
    .trim();
}

// Apply emotion colors to text nodes
function applyEmotionColors(emotions) {
  console.log('Content script: Applying emotions:', emotions);
  
  // Show a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #667eea;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;
  notification.textContent = `Analyzing ${emotions.length} emotion blocks...`;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
  
  if (!emotions || emotions.length === 0) {
    console.error('No emotions to apply');
    return;
  }
  
  // First, remove any existing emotion spans
  removeExistingEmotionSpans();

  // Define emotion colors - lighter, pastel versions
  const emotionColors = {
    happy: '#FFF4B3',      // Light yellow
    excited: '#FFF4B3',    // Light yellow
    sad: '#B3D4F5',        // Light blue
    angry: '#FFB3B3',      // Light red
    frustrated: '#FFB3B3', // Light red
    love: '#FFD6EC',       // Light pink
    fear: '#D4B3E6',       // Light purple (Worried)
    worried: '#D4B3E6',    // Light purple
    neutral: '#E0E5E6',    // Light gray (Calm)
    calm: '#E0E5E6',       // Light gray
    surprise: '#FFD4A3',   // Light orange
    surprised: '#FFD4A3',  // Light orange
    disgust: '#D4B3A3',    // Light brown
    trust: '#B3E6B3',      // Light green
    trusting: '#B3E6B3',   // Light green
    anticipation: '#FFB3D4' // Light rose
  };

  let totalHighlighted = 0;

  // Process each emotion
  emotions.forEach(({ text: emotionText, emotion }) => {
    const color = emotionColors[emotion.toLowerCase()] || emotionColors.calm;
    const highlighted = highlightText(emotionText, color, emotion);
    totalHighlighted += highlighted;
  });

  console.log(`Total highlighted: ${totalHighlighted} nodes`);
  
  // Update notification with results
  const notification = document.querySelector('div[style*="position: fixed"]');
  if (notification) {
    notification.textContent = `Highlighted ${totalHighlighted} text sections!`;
    notification.style.background = totalHighlighted > 0 ? '#22c55e' : '#ef4444';
  }
}

// Highlight text on the page
function highlightText(searchText, color, emotion) {
  if (!searchText || searchText.length < 10) return 0;
  
  console.log(`Searching for: "${searchText}" (emotion: ${emotion})`);
  
  let highlightedCount = 0;
  
  // Get all text nodes
  const textNodes = getTextNodes(document.body);
  console.log(`Found ${textNodes.length} text nodes on page`);
  
  // Clean search text for matching
  const cleanSearch = searchText.toLowerCase().trim();
  const searchWords = cleanSearch.split(/\s+/).filter(w => w.length > 2);
  
  textNodes.forEach(node => {
    const nodeText = node.textContent;
    const cleanNode = nodeText.toLowerCase();
    
    // Check if this node contains the search text or significant overlap
    let isMatch = false;
    
    // Method 1: Direct substring match
    if (cleanNode.includes(cleanSearch)) {
      isMatch = true;
    }
    
    // Method 2: Check if node contains most of the search words
    if (!isMatch && searchWords.length > 2) {
      const matchingWords = searchWords.filter(word => cleanNode.includes(word));
      if (matchingWords.length >= searchWords.length * 0.6) {
        isMatch = true;
      }
    }
    
    // Method 3: Check if search text contains this node (for shorter nodes)
    if (!isMatch && nodeText.length > 20 && cleanSearch.includes(cleanNode)) {
      isMatch = true;
    }
    
    if (isMatch && !node.parentElement.classList.contains('emotion-highlight')) {
      console.log(`Highlighting match: "${nodeText.substring(0, 50)}..." with emotion: ${emotion}`);
      
      // Create wrapper span
      const span = document.createElement('span');
      span.className = 'emotion-highlight';
      span.setAttribute('data-emotion', emotion);
      span.style.cssText = `
        background-color: ${color} !important;
        padding: 2px 4px;
        border-radius: 4px;
        display: inline;
        position: relative;
      `;
      
      // Wrap the text node
      try {
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
        highlightedCount++;
      } catch (e) {
        console.error('Error wrapping node:', e);
      }
    }
  });
  
  return highlightedCount;
}

// Get all text nodes
function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip empty nodes
        if (!node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip script/style content
        const parent = node.parentElement;
        if (parent.tagName === 'SCRIPT' || 
            parent.tagName === 'STYLE' || 
            parent.tagName === 'NOSCRIPT' ||
            parent.classList.contains('emotion-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Accept nodes with actual text
        if (node.nodeValue.trim().length > 5) {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}

// Remove existing emotion spans
function removeExistingEmotionSpans() {
  const existingSpans = document.querySelectorAll('.emotion-highlight');
  existingSpans.forEach(span => {
    // Move children out of span
    while (span.firstChild) {
      span.parentNode.insertBefore(span.firstChild, span);
    }
    // Remove the span
    span.parentNode.removeChild(span);
  });
}