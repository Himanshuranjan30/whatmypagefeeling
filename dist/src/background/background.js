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
  const maxLength = 10000;
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  const prompt = `Analyze the following text and identify emotional content. 
For each distinct section or sentence that expresses a clear emotion, provide:
1. The exact text snippet (keep it short, 10-50 words)
2. The primary emotion (choose from: happy, sad, angry, love, fear, surprise, disgust, trust, anticipation, or neutral)

Format your response as a JSON array of objects like this:
[
  {"text": "exact text snippet here", "emotion": "happy"},
  {"text": "another text snippet", "emotion": "sad"}
]

Important:
- Extract meaningful phrases that clearly express emotions
- Keep text snippets concise but complete
- Choose the most dominant emotion for each snippet
- If no clear emotion, use "neutral"
- Aim for 10-20 emotion blocks for a typical webpage

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
          maxOutputTokens: 2048,
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
      const validatedEmotions = emotions
        .filter(item => item.text && item.emotion)
        .map(item => ({
          text: item.text.trim(),
          emotion: item.emotion.toLowerCase()
        }))
        .slice(0, 50); // Limit to 50 emotions max
      
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