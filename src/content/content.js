// Content script for What My Page Feeling extension
console.log('What My Page Feeling content script loaded');

// Ensure CSS is properly loaded and add any dynamic style adjustments
document.addEventListener('DOMContentLoaded', function() {
  // Verify that our CSS classes are available
  const testEl = document.createElement('span');
  testEl.className = 'emotion-highlight';
  document.body.appendChild(testEl);
  
  const styles = window.getComputedStyle(testEl);
  console.log('Emotion highlight styles loaded:', styles.position === 'relative');
  
  document.body.removeChild(testEl);
});

// Add fallback styles if CSS file fails to load
setTimeout(() => {
  if (!document.getElementById('emotion-highlight-fallback')) {
    const testEl = document.createElement('span');
    testEl.className = 'emotion-highlight';
    testEl.style.background = '#F3F4F6';
    document.body.appendChild(testEl);
    
    const computedStyle = window.getComputedStyle(testEl);
    const hasCSS = computedStyle.borderLeftWidth && computedStyle.borderLeftWidth !== '0px';
    
    document.body.removeChild(testEl);
    
    if (!hasCSS) {
      console.log('Adding fallback styles for emotion highlights');
      const fallbackStyles = document.createElement('style');
      fallbackStyles.id = 'emotion-highlight-fallback';
      fallbackStyles.textContent = `
        .emotion-highlight {
          background-color: var(--emotion-bg, #F3F4F6) !important;
          border-left: 3px solid var(--emotion-border, #6B7280) !important;
          padding: 1px 3px !important;
          border-radius: 3px !important;
          display: inline !important;
          position: relative !important;
          transition: all 0.2s ease !important;
          cursor: help !important;
        }
        
        .emotion-highlight:hover {
          transform: scale(1.02) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
          z-index: 10 !important;
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
          z-index: 10000 !important;
          pointer-events: none !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          top: -30px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
        }
        
        .emotion-notification {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          padding: 12px 20px !important;
          border-radius: 8px !important;
          z-index: 999999 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          max-width: 300px !important;
          word-wrap: break-word !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(fallbackStyles);
    }
  }
}, 100);