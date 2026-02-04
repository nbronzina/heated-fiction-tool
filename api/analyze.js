// Simple rate limiting (resets on cold start, sufficient for casual abuse prevention)
const rateLimit = new Map();
const RATE_LIMIT = 20; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];
  const recent = userRequests.filter(time => now - time < RATE_WINDOW);

  if (recent.length >= RATE_LIMIT) {
    return false;
  }

  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

// Detect media type from base64 header bytes
function getMediaTypeFromBase64(base64String) {
  if (base64String.startsWith('/9j/')) return 'image/jpeg';
  if (base64String.startsWith('iVBORw')) return 'image/png';
  if (base64String.startsWith('R0lGOD')) return 'image/gif';
  if (base64String.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // fallback
}

// Fiction registers with varied examples per scenario
const fictionRegisters = {
  heatwave: [
    { type: 'minor_inconvenience', examples: [
      "The AC unit's been humming since Monday. Nobody's turned it off.",
      "Third iced coffee before noon. The barista stopped commenting.",
      "The walk from the car feels longer every summer."
    ]},
    { type: 'normalized_routine', examples: [
      "Siesta hours are 2-5 now. Even the bank closes.",
      "Morning meetings only—the conference room's unbearable by lunch.",
      "The kids know to stay inside until the shadow reaches the fence."
    ]},
    { type: 'bureaucratic_normal', examples: [
      "Heat protocol level 2. Terrace service suspended.",
      "The city extended cooling center hours through September.",
      "Outdoor work permits require hourly shade breaks now."
    ]},
    { type: 'latent_tension', examples: [
      "The lawn went brown in June. Nobody's replanted.",
      "The pool's been drained since the restrictions started.",
      "Somewhere in the building, someone's AC is always running."
    ]}
  ],

  flood: [
    { type: 'minor_inconvenience', examples: [
      "The lobby flooded again. Mop's in its usual spot.",
      "Had to take the long way—underpass is closed.",
      "The basement dehumidifier runs 24/7 now."
    ]},
    { type: 'normalized_routine', examples: [
      "Sandbag delivery is the first Tuesday of storm season.",
      "Everyone checks the drainage forecast before parking.",
      "The ground floor moved everything above knee height years ago."
    ]},
    { type: 'bureaucratic_normal', examples: [
      "Flash flood warning means street parking relocates to level 3.",
      "Insurance requires photos within 24 hours now.",
      "The retrofit assessment came back. Expensive but necessary."
    ]},
    { type: 'latent_tension', examples: [
      "The waterline from last spring is still visible on the wall.",
      "Three houses on the block are for sale. Same reason.",
      "Nobody uses the basement storage anymore. Just in case."
    ]}
  ],

  windstorm: [
    { type: 'minor_inconvenience', examples: [
      "Had to reschedule the terrace lunch. Again.",
      "The recycling bins made it two streets over this time.",
      "Lost the patio umbrella. Third one this year."
    ]},
    { type: 'normalized_routine', examples: [
      "Storm prep is Sunday night now. Part of the routine.",
      "The outdoor furniture lives in the garage October through March.",
      "Wind advisory means the scaffolding comes down by 3pm."
    ]},
    { type: 'bureaucratic_normal', examples: [
      "Building management sends the checklist every storm season.",
      "Gusts above 90km/h trigger the automatic shutters.",
      "The arborist flags at-risk trees quarterly now."
    ]},
    { type: 'latent_tension', examples: [
      "That oak's been leaning since the last big one.",
      "The pergola's repair is still on the to-do list.",
      "Insurance called. They want photos of the roof anchors."
    ]}
  ],

  adaptation: [
    { type: 'successful_adaptation', examples: [
      "The courtyard retrofit pays off—five degrees cooler than the street.",
      "The green wall's doing exactly what the architect promised.",
      "Passive cooling works. Haven't touched the AC in weeks."
    ]},
    { type: 'community_win', examples: [
      "The building committee got it right. Worth every assessment.",
      "The street voted for permeable paving. No regrets.",
      "Neighbors pitched in for the shared rain garden. It works."
    ]},
    { type: 'normalized_improvement', examples: [
      "The kids do homework on the terrace now. It's comfortable.",
      "Dinner outside is possible again, even in August.",
      "The courtyard's actually pleasant. People use it."
    ]},
    { type: 'quiet_satisfaction', examples: [
      "Worth every euro of the renovation.",
      "The plants needed no watering last month. System works.",
      "Visitors always ask about the cooling. Happy to explain."
    ]}
  ]
};

// Get random fiction register for Claude to use
function getRandomRegister(scenario) {
  const registers = fictionRegisters[scenario];
  if (!registers) return null;

  const randomRegister = registers[Math.floor(Math.random() * registers.length)];
  return { type: randomRegister.type };
}

// Build location context for hyper-local predictions
function buildLocationContext(location) {
  if (!location || !location.city) return '';

  return `The design is located in ${location.city}${location.country ? `, ${location.country}` : ''}. Reference this place specifically—mention the city by name, use local context.`;
}

// Scenario descriptions for Claude
const scenarioDescriptions = {
  heatwave: 'extreme heat scenario - notice the sky color, vegetation state, any signs of heat stress',
  flood: 'post-rainfall/flood scenario - notice the grey sky, wet surfaces, puddles, people with rain gear',
  windstorm: 'windstorm scenario - notice the dramatic sky, wind effects, people bracing against wind',
  adaptation: 'successful climate adaptation - notice the lush green vegetation, comfortable atmosphere, people enjoying the space'
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not set" });

  // Extract parameters - NEW: now receives generatedImage
  const { scenario, location, generatedImage, generatedImageMimeType } = req.body;
  const originalImageData = req.body.messages?.[0]?.content?.find(b => b.type === 'image')?.source?.data || '';
  const originalImageMimeType = req.body.messages?.[0]?.content?.find(b => b.type === 'image')?.source?.media_type || 'image/jpeg';

  // Validate required fields
  if (!scenario) {
    return res.status(400).json({ error: "Scenario is required" });
  }

  if (!generatedImage) {
    return res.status(400).json({ error: "Generated image is required" });
  }

  console.log('=== FICTION GENERATION ===');
  console.log('Scenario:', scenario);
  console.log('Has generated image:', !!generatedImage);
  console.log('Has original image:', !!originalImageData);
  console.log('Location:', location ? `${location.city}, ${location.country}` : 'Not detected');
  console.log('==========================');

  // Get random register for variety
  const registerData = getRandomRegister(scenario);
  const register = registerData?.type?.replace(/_/g, ' ') || 'mundane observation';

  // Build location context
  const locationContext = buildLocationContext(location);

  // Build system prompt - Claude sees the generated image and writes fiction about it
  const systemPrompt = `Look at this image carefully. Write a micro-fiction: 2-3 short sentences from someone IN this exact scene.

Your fiction must reference elements actually visible in the image (the buildings, the people, the ground, the vegetation, etc.). Do not invent locations, people, or objects not visible.

Rules:
- Ordinary Tuesday tone — conditions are background, not story
- Small logistics, passing thoughts
- Present tense, no reflection
- Reference visible elements, not imagined ones

${locationContext}

Output ONLY the fiction text, nothing else. No analysis, no description, no headers.

FICTION:`;

  try {
    // Build messages with BOTH images
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: 'ORIGINAL IMAGE (the design today):' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: getMediaTypeFromBase64(originalImageData) || originalImageMimeType,
            data: originalImageData
          }
        },
        { type: 'text', text: 'GENERATED IMAGE:' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: generatedImageMimeType || getMediaTypeFromBase64(generatedImage) || 'image/png',
            data: generatedImage
          }
        },
        { type: 'text', text: 'Write a micro-fiction (2-3 sentences) referencing visible elements. Output ONLY the fiction, nothing else.' }
      ]
    }];

    const requestBody = {
      model: req.body.model || 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages,
      system: systemPrompt
    };

    console.log('=== CLAUDE REQUEST ===');
    console.log('Model:', requestBody.model);
    console.log('Register:', register);
    console.log('Sending both images to Claude...');
    console.log('======================');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();

    // Extract fiction from response
    if (data.content && data.content[0]?.text) {
      const rawText = data.content[0].text;
      // Clean up: remove "FICTION:" prefix, markdown, and any analysis text
      const fiction = rawText.replace(/.*FICTION:\s*/is, '').replace(/\*\*/g, '').trim();

      console.log('=== FICTION OUTPUT ===');
      console.log('Register used:', register);
      console.log('Raw:', rawText.substring(0, 100));
      console.log('Clean:', fiction.substring(0, 200));
      console.log('======================');

      // Return in expected format for frontend
      return res.status(200).json({
        success: true,
        fiction: fiction,
        register: register,
        content: [{ text: `FICTION: ${fiction}` }] // Backward compatible format
      });
    }

    // Handle error response from Claude
    if (data.error) {
      console.error('Claude API error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Claude API error' });
    }

    return res.status(500).json({ error: 'No fiction generated' });

  } catch (err) {
    console.error('Analyze API error:', err);
    res.status(500).json({ error: "API request failed" });
  }
}
