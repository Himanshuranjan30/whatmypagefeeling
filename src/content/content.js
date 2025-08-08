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

  // Define emotion colors - lighter, pastel versions
  const emotionColors = {
    happy: '#FFF4B3',      // Light yellow
    sad: '#B3D4F5',        // Light blue
    angry: '#FFB3B3',      // Light red
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

  // Get all text nodes
  const textNodes = getAllTextNodes();
  
  // Create a map of text to emotions for quick lookup
  const emotionMap = new Map();
  emotions.forEach(({ text, emotion }) => {
    emotionMap.set(text.toLowerCase().trim(), emotion);
  });

  // Process all text nodes
  textNodes.forEach(node => {
    const text = node.nodeValue.trim();
    if (text.length === 0) return;

    // Try to find emotion for this text
    let foundEmotion = null;
    let matchedText = '';

    // First try exact match
    if (emotionMap.has(text.toLowerCase())) {
      foundEmotion = emotionMap.get(text.toLowerCase());
      matchedText = text;
    } else {
      // Try to find partial matches
      for (const [emotionText, emotion] of emotionMap) {
        if (text.toLowerCase().includes(emotionText) || emotionText.includes(text.toLowerCase())) {
          foundEmotion = emotion;
          matchedText = text;
          break;
        }
      }
    }

    // If still no match, assign neutral
    if (!foundEmotion) {
      foundEmotion = 'neutral';
      matchedText = text;
    }

    // Apply color to the entire text node
    const color = emotionColors[foundEmotion.toLowerCase()] || emotionColors.neutral;
    wrapTextNode(node, color, foundEmotion);
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



// Get all text nodes in the document
function getAllTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style, and other non-content elements
        const parentTag = node.parentElement.tagName;
        if (parentTag === 'SCRIPT' || 
            parentTag === 'STYLE' ||
            parentTag === 'NOSCRIPT' ||
            node.parentElement.classList.contains('emotion-highlight')) {
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

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  return textNodes;
}

// Wrap a text node with emotion styling
function wrapTextNode(textNode, color, emotion) {
  const span = document.createElement('span');
  span.className = 'emotion-highlight';
  span.style.backgroundColor = color;
  span.style.padding = '3px 6px';
  span.style.borderRadius = '4px';
  span.style.color = getContrastColor(color);
  span.style.fontWeight = '500';
  span.style.transition = 'all 0.3s ease';
  span.style.display = 'inline-block';
  span.style.margin = '1px';
  span.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  span.setAttribute('data-emotion', emotion);
  
  // Add hover effect
  span.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  });
  
  span.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = 'none';
  });
  
  // Clone the text content
  span.textContent = textNode.nodeValue;
  
  // Replace the text node with the span
  textNode.parentNode.replaceChild(span, textNode);
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