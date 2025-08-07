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
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.tagName === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT;
        }
        // Only accept nodes with meaningful text
        if (node.nodeValue.trim().length > 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  let textContent = '';
  let node;
  while (node = walker.nextNode()) {
    textContent += node.nodeValue + ' ';
  }

  return textContent.trim();
}

// Apply emotion colors to text nodes
function applyEmotionColors(emotions) {
  // First, remove any existing emotion spans
  removeExistingEmotionSpans();

  // Define emotion colors
  const emotionColors = {
    happy: '#FFE66D',
    sad: '#4A90E2',
    angry: '#FF6B6B',
    love: '#FF69B4',
    fear: '#9B59B6',
    neutral: '#95A5A6',
    surprise: '#FFA500',
    disgust: '#8B4513',
    trust: '#32CD32',
    anticipation: '#FF1493'
  };

  // Process each emotion block
  emotions.forEach(emotionBlock => {
    const { text, emotion } = emotionBlock;
    const color = emotionColors[emotion.toLowerCase()] || emotionColors.neutral;
    
    // Find and highlight matching text
    highlightText(text, color, emotion);
  });
}

// Remove existing emotion spans
function removeExistingEmotionSpans() {
  const existingSpans = document.querySelectorAll('.emotion-highlight');
  existingSpans.forEach(span => {
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });
}

// Highlight specific text with emotion color
function highlightText(searchText, color, emotion) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.tagName === 'NOSCRIPT' ||
            node.parentElement.classList.contains('emotion-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.nodeValue;
    const lowerText = text.toLowerCase();
    const lowerSearchText = searchText.toLowerCase();
    
    if (lowerText.includes(lowerSearchText)) {
      nodesToProcess.push(node);
    }
  }

  // Process nodes
  nodesToProcess.forEach(node => {
    const text = node.nodeValue;
    const lowerText = text.toLowerCase();
    const lowerSearchText = searchText.toLowerCase();
    const index = lowerText.indexOf(lowerSearchText);
    
    if (index !== -1) {
      const parent = node.parentElement;
      const beforeText = text.substring(0, index);
      const matchedText = text.substring(index, index + searchText.length);
      const afterText = text.substring(index + searchText.length);
      
      // Create new nodes
      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText);
      
      // Create highlighted span
      const span = document.createElement('span');
      span.className = 'emotion-highlight';
      span.style.backgroundColor = color;
      span.style.padding = '2px 4px';
      span.style.borderRadius = '3px';
      span.style.color = getContrastColor(color);
      span.style.fontWeight = '500';
      span.style.transition = 'all 0.3s ease';
      span.setAttribute('data-emotion', emotion);
      span.textContent = matchedText;
      
      // Add hover effect
      span.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      });
      
      span.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
      });
      
      // Replace the text node
      parent.insertBefore(beforeNode, node);
      parent.insertBefore(span, node);
      parent.insertBefore(afterNode, node);
      parent.removeChild(node);
    }
  });
}

// Get contrasting text color based on background
function getContrastColor(hexcolor) {
  // Convert hex to RGB
  const r = parseInt(hexcolor.slice(1, 3), 16);
  const g = parseInt(hexcolor.slice(3, 5), 16);
  const b = parseInt(hexcolor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}