import { GoogleGenAI } from "@google/genai";

// Rate limiting
const rateLimit = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];
  const recent = userRequests.filter(time => now - time < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
  if (!GOOGLE_AI_API_KEY) {
    return res.status(500).json({ error: "Google AI API key not configured" });
  }

  const { imageBase64, prompt, mimeType = "image/jpeg" } = req.body;

  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: "Missing imageBase64 or prompt" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    console.log('=== GEMINI IMAGE GENERATION ===');
    console.log('Prompt:', prompt.substring(0, 200));
    console.log('================================');

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    // Extract generated image from response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log('[GEMINI] Text response:', part.text.substring(0, 500));
        }
        if (part.inlineData) {
          console.log('[GEMINI] Image generated successfully');
          return res.status(200).json({
            success: true,
            imageBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "image/png"
          });
        }
      }
    }

    console.error('[GEMINI] No image in response:', JSON.stringify(response, null, 2));
    return res.status(500).json({ error: "No image generated in response" });

  } catch (error) {
    console.error('[GEMINI] Error:', error);
    return res.status(500).json({
      error: error.message || "Failed to generate image",
      details: error.toString()
    });
  }
}
