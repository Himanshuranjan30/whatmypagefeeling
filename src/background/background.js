// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request.action);
  
  if (request.action === 'analyzeEmotions') {
    if (!request.content || request.content.trim().length === 0) {
      sendResponse({ error: 'No content to analyze' });
      return;
    }
    
    analyzeTextWithGemini(request.content, request.apiKey)
      .then(emotions => {
        console.log('Analysis complete, returning', emotions.length, 'emotions');
        sendResponse({ emotions: emotions });
      })
      .catch(error => {
        console.error('Analysis error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Analyze text with Gemini API
async function analyzeTextWithGemini(content, apiKey) {
  // Use hardcoded API key
  const GEMINI_API_KEY = 'AIzaSyCKOUg7XmqbauqX8zcjdeNzzKOPbZnjxVo';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  // Truncate content if too long (Gemini has token limits)
  const maxLength = 30000; // Increased for better analysis
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  const prompt = `Analyze the emotional content of this webpage text and identify emotions in different sections.

For each meaningful section of text, provide:
1. A representative text snippet from that section (keep it 10-50 words)
2. The dominant emotion for that section

Use these emotions: happy, excited, sad, angry, frustrated, love, worried, surprised, disgust, trusting, anticipation, calm

Return a JSON array like this:
[
  {"text": "actual text from the page", "emotion": "happy"},
  {"text": "another section of text", "emotion": "sad"}
]

Rules:
- Extract ACTUAL text snippets from the content, don't paraphrase
- Keep snippets short but meaningful (10-50 words)
- Cover different sections of the content
- Return 10-50 results depending on content length

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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to analyze emotions');
    }

    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse emotion data from response');
    }
    
    try {
      const emotions = JSON.parse(jsonMatch[0]);
      
      // Validate and clean the emotions array
      const validEmotions = ['happy', 'excited', 'sad', 'angry', 'frustrated', 
                              'love', 'worried', 'surprised', 'disgust', 'trusting', 
                              'anticipation', 'calm', 'neutral'];
      
      const validatedEmotions = emotions
        .filter(item => item.text && item.emotion)
        .map(item => ({
          text: item.text.trim(),
          emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                   ? item.emotion.toLowerCase() 
                   : 'calm'
        }))
        .slice(0, 100); // Limit to 100 emotion blocks
      
      console.log('Validated emotions count:', validatedEmotions.length);
      console.log('Sample emotions:', validatedEmotions.slice(0, 3));
      
      return validatedEmotions;
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      throw new Error('Failed to parse emotion data');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}