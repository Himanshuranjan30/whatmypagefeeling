// Background script for PagePulse extension
console.log('PagePulse background script loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      highlightEnabled: true,
      maxHighlights: 25,
      showTooltips: true
    });
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'analyzeEmotions') {
    handleEmotionAnalysis(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['highlightEnabled', 'maxHighlights', 'showTooltips'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'saveSettings') {
    chrome.storage.local.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle emotion analysis with improved error handling
async function handleEmotionAnalysis(request, sendResponse) {
  try {
    if (!request.content || request.content.trim().length === 0) {
      sendResponse({ error: 'No content to analyze' });
      return;
    }
    
    console.log('Starting emotion analysis...');
    const emotions = await analyzeTextWithGemini(request.content);
    console.log('Analysis complete:', emotions.length, 'emotions found');
    
    sendResponse({ emotions: emotions });
  } catch (error) {
    console.error('Analysis error:', error);
    sendResponse({ error: error.message });
  }
}

// Improved Gemini API integration
async function analyzeTextWithGemini(content) {
  const GEMINI_API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  // Prepare content with length limit
  const maxLength = 25000;
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  const prompt = `Analyze the emotional content of this webpage and identify text sections with clear emotional tones.

Extract 15-25 meaningful text snippets that express emotions. For each snippet:
1. Use the EXACT text from the content (10-100 words)
2. Identify the primary emotion

Available emotions: happy, excited, sad, angry, frustrated, love, worried, surprised, calm, trusting

Return ONLY a valid JSON array:
[
  {"text": "exact text from webpage", "emotion": "happy"},
  {"text": "another text snippet", "emotion": "worried"}
]

Important rules:
- Use EXACT text from the content, don't rephrase
- Skip navigation menus, headers, and technical content
- Focus on content with clear emotional expression
- Each text snippet should be 10-100 words
- Return 15-25 results maximum

Content to analyze:
${truncatedContent}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 30,
          topP: 0.8,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from AI model');
    }
    
    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Invalid response structure from AI');
    }
    
    const generatedText = candidate.content.parts[0].text;
    console.log('AI response received, length:', generatedText.length);
    
    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', generatedText);
      throw new Error('Could not extract emotion data from AI response');
    }
    
    try {
      const emotions = JSON.parse(jsonMatch[0]);
      
      // Validate emotions array
      if (!Array.isArray(emotions)) {
        throw new Error('Response is not an array');
      }
      
      // Clean and validate each emotion entry
      const validEmotions = ['happy', 'excited', 'sad', 'angry', 'frustrated', 
                              'love', 'worried', 'surprised', 'calm', 'trusting'];
      
      const validatedEmotions = emotions
        .filter(item => {
          return item && 
                 typeof item === 'object' && 
                 typeof item.text === 'string' && 
                 typeof item.emotion === 'string' &&
                 item.text.trim().length >= 10 &&
                 item.text.trim().length <= 200;
        })
        .map(item => ({
          text: item.text.trim(),
          emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                   ? item.emotion.toLowerCase() 
                   : 'calm'
        }))
        .slice(0, 25); // Limit to 25 emotions
      
      console.log(`Validated ${validatedEmotions.length} emotions from ${emotions.length} raw results`);
      
      if (validatedEmotions.length === 0) {
        throw new Error('No valid emotions found in the analysis');
      }
      
      return validatedEmotions;
      
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Attempted to parse:', jsonMatch[0].substring(0, 500));
      throw new Error('Failed to parse emotion analysis results');
    }
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('API_KEY')) {
      throw new Error('API key issue - please check configuration');
    } else if (error.message.includes('quota')) {
      throw new Error('API quota exceeded - please try again later');
    } else if (error.message.includes('network')) {
      throw new Error('Network error - please check your connection');
    } else {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }
}

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Content script will be injected when needed via executeScript
    console.log('Tab updated:', tab.url);
  }
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Background script initialization complete');