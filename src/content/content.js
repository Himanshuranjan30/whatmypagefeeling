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

// Extract meaningful text content from the page
function extractPageText() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        const parentTag = node.parentElement.tagName;
        if (parentTag === 'SCRIPT' || 
            parentTag === 'STYLE' ||
            parentTag === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Only accept nodes with meaningful text (more than 20 characters)
        const text = node.nodeValue.trim();
        if (text.length > 20 && /[a-zA-Z]{5,}/.test(text)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const textBlocks = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.nodeValue.trim();
    // Group text by parent element to preserve context
    const parent = node.parentElement;
    const parentText = parent.textContent.trim();
    
    // Only add substantial text blocks (paragraphs, sentences)
    if (parentText.length > 30 && !textBlocks.includes(parentText)) {
      textBlocks.push(parentText);
    }
  }

  return textBlocks.join(' ');
}

// Apply emotion colors to text nodes
function applyEmotionColors(emotions) {
  console.log('Received emotions to apply:', emotions.length);
  
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

  // Process each emotion block from Gemini
  let highlightedCount = 0;
  emotions.forEach(({ text: emotionText, emotion }) => {
    const color = emotionColors[emotion.toLowerCase()] || emotionColors.calm;
    
    // Find and highlight matching text on the page
    const highlighted = highlightTextOnPage(emotionText, color, emotion);
    if (highlighted) highlightedCount++;
  });
  
  console.log(`Successfully highlighted ${highlightedCount} out of ${emotions.length} emotion blocks`);
}

// Highlight specific text on the page
function highlightTextOnPage(searchText, color, emotion) {
  if (!searchText || searchText.length < 10) return false; // Skip very short text
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parentTag = node.parentElement.tagName;
        if (parentTag === 'SCRIPT' || 
            parentTag === 'STYLE' ||
            parentTag === 'NOSCRIPT' ||
            node.parentElement.classList.contains('emotion-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  
  // Normalize search text for better matching
  const normalizedSearch = searchText.toLowerCase().trim();
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 3);
  
  while (node = walker.nextNode()) {
    const nodeText = node.nodeValue;
    const normalizedNode = nodeText.toLowerCase();
    
    // Check if this node contains enough matching words
    let matchCount = 0;
    for (const word of searchWords) {
      if (normalizedNode.includes(word)) {
        matchCount++;
      }
    }
    
    // If at least 60% of words match, consider it a match
    if (matchCount >= searchWords.length * 0.6) {
      nodesToProcess.push({
        node: node,
        matchQuality: matchCount / searchWords.length
      });
    }
  }

  // Sort by match quality and process best matches
  const processedNodes = nodesToProcess
    .sort((a, b) => b.matchQuality - a.matchQuality)
    .slice(0, 3); // Take top 3 matches to avoid over-highlighting
  
  let highlightedAny = false;
  processedNodes.forEach(({ node }) => {
    // Skip if already highlighted
    if (node.parentElement.classList.contains('emotion-highlight')) return;
    
    wrapTextNode(node, color, emotion);
    highlightedAny = true;
  });
  
  return highlightedAny;
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
  span.style.display = 'inline';
  span.style.lineHeight = '1.6';
  span.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  span.setAttribute('data-emotion', emotion);
  
  // Add hover effect
  span.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  });
  
  span.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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