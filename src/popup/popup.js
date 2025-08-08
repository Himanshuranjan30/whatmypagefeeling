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
      throw new Error('Failed to access page content. Please refresh the page and try again.');
    }
    
    if (!pageText || pageText.trim().length < 50) {
      throw new Error('Not enough text content found on this page to analyze.');
    }
    
    showStatus('Analyzing emotions with AI...', 'info');
    
    // Analyze emotions
    const { emotions, analysis } = await analyzeEmotions(pageText);
    
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
        
        if (highlightCount > 0) {
          showStatus(`Analysis complete! Highlighted ${highlightCount} emotion sections.`, 'success');
          // Show clear button after successful highlighting
          const clearBtn = document.getElementById('clearBtn');
          if (clearBtn) {
            clearBtn.style.display = 'block';
          }
          // Update example analysis panel with AI summary if present
          if (analysis) {
            const insight = document.querySelector('.preview-insight');
            if (insight) insight.textContent = analysis;
            // Hide example label and sample bar once real analysis is available
            const previewLabel = document.querySelector('.preview-label');
            if (previewLabel) {
              previewLabel.style.display = 'none';
              previewLabel.setAttribute('aria-hidden', 'true');
            }
            const previewBar = document.querySelector('.emotion-bar');
            if (previewBar) {
              previewBar.style.display = 'none';
              previewBar.setAttribute('aria-hidden', 'true');
            }
          }
        } else {
          showStatus('Analysis complete but no text could be highlighted. Try a different page.', 'warning');
        }
      } catch (highlightError) {
        showStatus('Analysis complete but highlighting failed. The page may have restrictions.', 'warning');
      }
    } else {
      showStatus('No clear emotions detected in the page content.', 'warning');
    }
    
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
  
  analyzeBtn.classList.remove('loading');
});

// Simple text extraction with ID mapping
function extractPageText() {
  // Clear any existing highlights
  document.querySelectorAll('.emotion-highlight').forEach(el => {
    el.classList.remove('emotion-highlight');
    el.style.removeProperty('background-color');
    el.style.removeProperty('border-left');
    el.style.removeProperty('padding');
    el.style.removeProperty('border-radius');
  });
  
  // Get ALL text elements on the page - comprehensive coverage
  const allTextElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span, li, td, th, blockquote, article, section, aside, main, header, footer, figcaption, caption, label, legend, summary, details');
  const textBlocks = [];
  let elementIndex = 0;
  
  allTextElements.forEach((element, index) => {
    // Skip hidden elements
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }
    
    // Skip certain elements that shouldn't be analyzed
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(element.tagName)) {
      return;
    }
    
    // Get text content
    let text = element.textContent?.trim() || '';
    
    // For container elements, be more selective about what to skip
    if (['DIV', 'SPAN', 'SECTION', 'ARTICLE', 'ASIDE', 'MAIN', 'HEADER', 'FOOTER'].includes(element.tagName)) {
      // Only skip containers that have multiple paragraphs/headings (likely just wrappers)
      const blockChildren = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      if (blockChildren.length > 1) {
        // This is likely a wrapper, skip it to avoid duplicate text
        return;
      }
      
      // If it has one child element, check if the text is mostly the same
      if (blockChildren.length === 1) {
        const childText = blockChildren[0].textContent?.trim() || '';
        // If container text is mostly just the child text, skip the container
        if (text.length > 0 && childText.length > 0 && text.includes(childText) && (childText.length / text.length) > 0.8) {
          return;
        }
      }
    }
    
    // More lenient text filtering - capture more content
    if (text && text.length >= 10 && text.length <= 2000) {
      // Assign unique ID if it doesn't have one
      if (!element.id) {
        element.id = `emotion-${element.tagName.toLowerCase()}-${elementIndex}`;
      }
      
      // Store text with its element ID and tag info
      textBlocks.push(`[ID:${element.id}] ${text}`);
      elementIndex++;
    }
  });
  
  const result = textBlocks.join('\n\n');
  return result;
}


// Analyze emotions with Gemini API
async function analyzeEmotionsWithGemini(content) {
  const API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `Analyze this webpage content and identify text elements with clear emotions.

Each text element has an ID marker at the start like [ID:emotion-p-0], [ID:emotion-h1-0], [ID:emotion-div-0], etc.

IMPORTANT: Copy the EXACT ID from the [ID:xxx] marker without modifying it.

For each emotional text element:
1) Find the [ID:emotion-xxx-n] marker at the beginning
2) Copy the EXACT ID (e.g., "emotion-p-0", "emotion-h1-1")
3) Identify the primary emotion

Available emotions: happy, sad, angry, excited, worried, surprised, trusting, calm, love, frustrated

Return ONLY a valid JSON object with two fields:
{
  "emotions": [
    {"id": "emotion-p-0", "emotion": "happy"},
    {"id": "emotion-h1-1", "emotion": "excited"},
    {"id": "emotion-div-2", "emotion": "worried"}
  ],
  "analysis": "One or two concise sentences summarizing the overall tone and suggested action."
}

Rules:
- The id must match pattern emotion-TAGNAME-NUMBER (e.g., emotion-p-5)
- Return 5-20 emotion items maximum
- Keep analysis under 250 characters, objective and professional

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
    
    // Parse JSON (object with emotions and analysis). Try direct parse first
    let parsed;
    try {
      parsed = JSON.parse(responseText.trim());
    } catch (_) {
      const objectMatch = responseText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      }
    }
    if (!parsed) {
      throw new Error('No JSON found in response');
    }
    const emotionsRaw = Array.isArray(parsed) ? parsed : parsed.emotions;
    const summaryText = Array.isArray(parsed) ? '' : (parsed.analysis || '');
    
    // Validate emotions and IDs
    const validEmotions = ['happy', 'sad', 'angry', 'excited', 'worried', 'surprised', 'trusting', 'calm', 'love', 'frustrated'];
    
    const cleanedEmotions = (emotionsRaw || [])
      .filter(item => {
        // Check if item has required fields
        if (!item.id || !item.emotion || typeof item.id !== 'string') {
          return false;
        }
        
        // Check if ID follows proper format (emotion-tagname-number)
        const validIdPattern = /^emotion-[a-z]+\d*-\d+$/;
        if (!validIdPattern.test(item.id.trim())) {
          return false;
        }
        
        return true;
      })
      .map(item => ({
        id: item.id.trim(),
        emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                 ? item.emotion.toLowerCase() 
                 : 'calm'
      }))
      .slice(0, 20);
    
    return { emotions: cleanedEmotions, analysis: (summaryText || '').toString().trim().slice(0, 300) };
    
  } catch (error) {
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
}

// Emotion analysis using real Gemini API
async function analyzeEmotions(content) {
  const result = await analyzeEmotionsWithGemini(content);
  return result;
}

// Super simple highlighting - just map IDs to colors
function applyHighlights(emotions) {
  if (!emotions || emotions.length === 0) {
    return 0;
  }
  
  // Transparent emotion colors for subtle highlighting
  const colors = {
    happy: 'rgba(255, 249, 196, 0.3)',      // Light yellow with transparency
    excited: 'rgba(251, 191, 36, 0.2)',     // Amber with transparency
    sad: 'rgba(219, 234, 254, 0.4)',        // Light blue with transparency
    angry: 'rgba(254, 226, 226, 0.4)',      // Light red with transparency
    frustrated: 'rgba(239, 68, 68, 0.15)',  // Red with low transparency
    love: 'rgba(252, 231, 243, 0.4)',       // Light pink with transparency
    worried: 'rgba(237, 233, 254, 0.4)',    // Light purple with transparency
    calm: 'rgba(203, 213, 225, 0.55)',      // Darker slate gray with more visibility
    surprised: 'rgba(254, 215, 170, 0.3)',  // Light orange with transparency
    trusting: 'rgba(209, 250, 229, 0.4)'    // Light green with transparency
  };
  
  let highlightCount = 0;
  
  // Process each emotion - just find by ID and color it
  emotions.forEach(({ id, emotion }) => {
    const element = document.getElementById(id);
    if (element) {
      const color = colors[emotion] || colors.calm;
      
      // Apply subtle highlighting that preserves layout
      element.classList.add('emotion-highlight');
      element.style.setProperty('background-color', color, 'important');
      element.style.setProperty('border-left', `3px solid ${color.replace('0.', '0.8').replace(/rgba\(([^,]+,[^,]+,[^,]+),\s*[\d.]+\)/, 'rgba($1, 0.8)')}`, 'important');
      
      // Preserve original layout - minimal changes
      const originalPadding = window.getComputedStyle(element).padding;
      const originalMargin = window.getComputedStyle(element).margin;
      
      // Only add subtle padding if element doesn't already have enough
      if (originalPadding === '0px' || originalPadding === '') {
        element.style.setProperty('padding', '8px 12px', 'important');
      } else {
        element.style.setProperty('padding-left', 'calc(' + window.getComputedStyle(element).paddingLeft + ' + 8px)', 'important');
      }
      
      element.style.setProperty('border-radius', '4px', 'important');
      element.style.setProperty('transition', 'all 0.2s ease', 'important');
      element.style.setProperty('box-sizing', 'border-box', 'important');
      
      // Preserve text properties - don't override existing styles
      element.style.setProperty('line-height', 'inherit', 'important');
      element.style.setProperty('font-size', 'inherit', 'important');
      element.style.setProperty('font-family', 'inherit', 'important');
      element.style.setProperty('font-weight', 'inherit', 'important');
      
      // Add subtle hover effect
      element.addEventListener('mouseenter', function() {
        this.style.setProperty('background-color', color.replace(/0\.\d+/, '0.5'), 'important');
      });
      
      element.addEventListener('mouseleave', function() {
        this.style.setProperty('background-color', color, 'important');
      });
      
      // Remove default title and add custom hover tooltip
      element.removeAttribute('title');
      
      // Add instant hover tooltip with larger font
      element.addEventListener('mouseenter', function(e) {
        // Remove any existing tooltip
        const existingTooltip = document.querySelector('.emotion-tooltip-custom');
        if (existingTooltip) existingTooltip.remove();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'emotion-tooltip-custom';
        tooltip.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        
        tooltip.style.cssText = `
          position: fixed !important;
          background: rgba(0, 0, 0, 0.9) !important;
          color: white !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          white-space: nowrap !important;
          z-index: 999999 !important;
          pointer-events: none !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          transition: opacity 0.1s ease !important;
        `;
        
        // Position tooltip near mouse
        const rect = this.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2 - 50) + 'px';
        tooltip.style.top = (rect.top - 40) + 'px';
        
        document.body.appendChild(tooltip);
      });
      
      element.addEventListener('mouseleave', function() {
        const tooltip = document.querySelector('.emotion-tooltip-custom');
        if (tooltip) tooltip.remove();
      });
      
      highlightCount++;
    }
  });
  
  // Simple notification
  if (highlightCount > 0) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #10B981; color: white;
      padding: 12px 20px; border-radius: 8px; z-index: 999999; font-family: Arial;
      font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = `✨ Highlighted ${highlightCount} emotions!`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }
  
  return highlightCount;
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

// Handle clear highlights button
document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearBtn');
  
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              const highlights = document.querySelectorAll('.emotion-highlight');
              highlights.forEach(highlight => {
                highlight.classList.remove('emotion-highlight');
                highlight.style.removeProperty('background-color');
                highlight.style.removeProperty('border-left');
                highlight.style.removeProperty('padding');
                highlight.style.removeProperty('border-radius');
                highlight.style.removeProperty('padding-left');
                highlight.style.removeProperty('transition');
                highlight.style.removeProperty('box-sizing');
                highlight.style.removeProperty('line-height');
                highlight.style.removeProperty('font-size');
                highlight.style.removeProperty('font-family');
                highlight.style.removeProperty('font-weight');
                highlight.removeAttribute('title');
              });
              
              document.querySelectorAll('.emotion-tooltip-custom, .emotion-notification').forEach(el => el.remove());
              
              return highlights.length;
            }
          });
          showStatus('All highlights cleared successfully', 'success');
          clearBtn.style.display = 'none';
        }
      } catch (error) {
        showStatus('Error clearing highlights', 'error');
      }
    });
  }
});

// Theme toggle (light/dark)
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  // Load saved theme
  const saved = localStorage.getItem('wmpf-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(initial);
  // Set CSS vars for theme
  if (initial === 'dark') {
    document.body.style.setProperty('--bg', '#0F172A');
    document.body.style.setProperty('--fg', '#E2E8F0');
    document.body.style.setProperty('--muted', '#94A3B8');
    document.body.style.setProperty('--panel', '#1E293B');
    document.body.style.setProperty('--panel-border', '#334155');
  } else {
    document.body.style.setProperty('--bg', '#FEFEFE');
    document.body.style.setProperty('--fg', '#1E293B');
    document.body.style.setProperty('--muted', '#64748B');
    document.body.style.setProperty('--panel', '#F8FAFC');
    document.body.style.setProperty('--panel-border', '#E2E8F0');
  }
  toggle.querySelector('.theme-icon').textContent = initial === 'dark' ? '🌙' : '☀️';

  toggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(next);
    localStorage.setItem('wmpf-theme', next);
    toggle.querySelector('.theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
    // Update vars on toggle
    if (next === 'dark') {
      document.body.style.setProperty('--bg', '#0F172A');
      document.body.style.setProperty('--fg', '#E2E8F0');
      document.body.style.setProperty('--muted', '#94A3B8');
      document.body.style.setProperty('--panel', '#1E293B');
      document.body.style.setProperty('--panel-border', '#334155');
    } else {
      document.body.style.setProperty('--bg', '#FEFEFE');
      document.body.style.setProperty('--fg', '#1E293B');
      document.body.style.setProperty('--muted', '#64748B');
      document.body.style.setProperty('--panel', '#F8FAFC');
      document.body.style.setProperty('--panel-border', '#E2E8F0');
    }
  });

  // Ensure subtitle wraps to avoid overlap
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.style.whiteSpace = 'normal';
    subtitle.style.wordBreak = 'break-word';
  }
});