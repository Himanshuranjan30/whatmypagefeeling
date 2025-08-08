// Simple content script that just ensures we can inject functions
console.log('What My Page Feeling content script loaded');

// Add basic styles for highlights
if (!document.getElementById('emotion-highlight-styles')) {
  const styles = document.createElement('style');
  styles.id = 'emotion-highlight-styles';
  styles.textContent = `
    .emotion-highlight {
      transition: all 0.2s ease !important;
    }
    
    .emotion-highlight:hover {
      transform: scale(1.02) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
    }
    
    .emotion-tooltip {
      font-family: Arial, sans-serif !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    }
    
    .emotion-notification {
      font-family: Arial, sans-serif !important;
    }
  `;
  document.head.appendChild(styles);
}