// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeEmotions') {
    analyzeTextWithGemini(request.content, request.apiKey)
      .then(emotions => {
        sendResponse({ emotions: emotions });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Analyze text with Gemini API
async function analyzeTextWithGemini(content, apiKey) {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  // Truncate content if too long (Gemini has token limits)
  const maxLength = 30000; // Increased for better analysis
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  const prompt = `Analyze the emotional content of this webpage text. Focus on meaningful sentences and paragraphs.

For each substantial text block (at least 20-30 words), provide:
1. The exact text snippet (20-150 words)
2. The dominant emotion (choose from: happy, excited, sad, angry, frustrated, love, worried, surprised, disgust, trusting, anticipation, or calm)

Format your response as a JSON array:
[
  {"text": "meaningful sentence or paragraph here", "emotion": "happy"},
  {"text": "another substantial text block", "emotion": "calm"}
]

IMPORTANT RULES:
- Focus on complete sentences and paragraphs, not fragments
- Skip navigation items, single words, numbers, or very short phrases
- Each text snippet should be substantial enough to convey emotion
- Aim for 20-100 emotion blocks depending on page content
- Prioritize main content over boilerplate text
- If no clear emotion, use "calm"

Text to analyze:
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
        .filter(item => item.text && item.emotion && item.text.length > 20)
        .map(item => ({
          text: item.text.trim(),
          emotion: validEmotions.includes(item.emotion.toLowerCase()) 
                   ? item.emotion.toLowerCase() 
                   : 'calm'
        }))
        .slice(0, 200); // Limit to 200 meaningful emotion blocks
      
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