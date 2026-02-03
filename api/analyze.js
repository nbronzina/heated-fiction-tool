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

// Analysis caching (resets on cold start, sufficient for this volume)
const analysisCache = new Map();
const CACHE_TTL = 3600000; // 1 hour
const CACHE_VERSION = 'v2'; // bump to invalidate cache

async function getCacheKey(imageBase64, scenario, locationCity) {
  // Use Web Crypto API (ES Module compatible)
  const data = CACHE_VERSION + imageBase64.slice(0, 2000) + (scenario || '') + (locationCity || '');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Detect media type from base64 header bytes
function getMediaTypeFromBase64(base64String) {
  if (base64String.startsWith('/9j/')) return 'image/jpeg';
  if (base64String.startsWith('iVBORw')) return 'image/png';
  if (base64String.startsWith('R0lGOD')) return 'image/gif';
  if (base64String.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // fallback
}

// Gemini image generation capabilities (VLM - understands images semantically)
const GEMINI_CAPABILITIES = {
  canDo: [
    'Understand image content and context semantically',
    'Transform atmosphere, lighting, and mood',
    'Change color palettes and weather conditions',
    'Add contextual environmental changes',
    'Modify vegetation states (healthy ↔ stressed)',
    'Add weather effects (rain, heat haze, clouds)',
    'Preserve composition while transforming aesthetics'
  ],
  bestPractices: [
    'Use conversational, descriptive prompts',
    'Describe the desired end state, not step-by-step changes',
    'Be specific about mood and atmosphere',
    'Reference the original image context'
  ]
};

// Scenario performance ratings (Gemini)
const SCENARIO_PERFORMANCE = {
  heatwave: '⭐⭐⭐⭐⭐ Excellent',
  flood: '⭐⭐⭐⭐⭐ Excellent',
  windstorm: '⭐⭐⭐⭐ Very Good',
  adaptation: '⭐⭐⭐⭐⭐ Excellent'
};

// People variations per scenario (for Gemini image generation variety)
const peopleVariations = {
  heatwave: [
    "People wear wide-brimmed sun hats and carry refillable water bottles",
    "Figures seek shade under awnings, wearing light linen clothing",
    "People hold small portable fans, wearing UV-protective sleeves",
    "Figures wear baseball caps and sunglasses, carrying iced drinks",
    "People stand under umbrellas for shade, wearing loose cotton shirts"
  ],
  flood: [
    "People wear rubber boots and carry umbrellas",
    "Figures have rolled-up trousers, stepping carefully around puddles",
    "People in rain ponchos carry shopping bags above water level",
    "Figures wear waterproof jackets with hoods up",
    "People in wellies help each other navigate wet areas"
  ],
  windstorm: [
    "People brace against wind, holding onto hats",
    "Figures lean forward into the wind, coats flapping",
    "People shield their faces, hair blown sideways",
    "Figures grip railings or posts for stability",
    "People hurry with heads down, clutching bags tightly"
  ],
  adaptation: [
    "People relax comfortably in outdoor seating areas",
    "Figures enjoy coffee at shaded terraces, looking content",
    "Children play freely while adults chat nearby",
    "People cycle or walk leisurely, enjoying the space",
    "Figures gather socially in green communal areas"
  ]
};

// Select random people instruction for variety
function getRandomPeopleInstruction(scenario) {
  const variations = peopleVariations[scenario];
  if (!variations) return '';
  const randomIndex = Math.floor(Math.random() * variations.length);
  return variations[randomIndex];
}

// Intensity levels per scenario for image generation variety
const intensityLevels = {
  heatwave: {
    intense: { sky: 'harsh orange with visible heat shimmer', vegetation: 'completely dead and brown', surfaces: 'cracked and dusty' },
    moderate: { sky: 'yellowish and hazy', vegetation: 'stressed and browning', surfaces: 'dry and faded' },
    mild: { sky: 'washed out with harsh light', vegetation: 'wilting and dry', surfaces: 'sun-bleached' }
  },
  flood: {
    intense: { sky: 'dark heavy grey with low clouds', water: 'large muddy puddles collecting everywhere', surfaces: 'dark wet and waterlogged' },
    moderate: { sky: 'flat grey and overcast', water: 'standing water in low areas', surfaces: 'wet and reflective' },
    mild: { sky: 'grey and muted', water: 'damp with some puddles', surfaces: 'recently rained on' }
  },
  windstorm: {
    intense: { sky: 'dark dramatic with ominous storm clouds', mood: 'threatening and turbulent', light: 'harsh and directional' },
    moderate: { sky: 'grey with fast-moving clouds', mood: 'unsettled and tense', light: 'diffused and moody' },
    mild: { sky: 'overcast with dynamic clouds', mood: 'pre-storm stillness', light: 'flat and grey' }
  },
  adaptation: {
    vibrant: { vegetation: 'lush and deeply green', sky: 'clear bright blue', mood: 'beautiful and inviting' },
    pleasant: { vegetation: 'healthy and green', sky: 'pleasant with soft clouds', mood: 'comfortable and welcoming' },
    subtle: { vegetation: 'fresh and well-maintained', sky: 'clear and calm', mood: 'peaceful and improved' }
  }
};

// Build Gemini image prompt programmatically with varied intensity
function buildGeminiPrompt(scenario) {
  // Select random intensity level
  const levels = Object.keys(intensityLevels[scenario] || {});
  if (levels.length === 0) return null;

  const randomLevel = levels[Math.floor(Math.random() * levels.length)];
  const intensity = intensityLevels[scenario][randomLevel];

  // Get random people instruction
  const peopleInstruction = getRandomPeopleInstruction(scenario);
  const peopleText = peopleInstruction ? `Any people visible in the image: ${peopleInstruction}.` : '';

  let prompt = '';

  switch(scenario) {
    case 'heatwave':
      prompt = `Edit this image to show an extreme heatwave scenario. The sky should be ${intensity.sky}. All grass, plants and vegetation should appear ${intensity.vegetation}. Ground and surfaces look ${intensity.surfaces}. ${peopleText} Maintain the exact same composition, architecture, and camera angle.`;
      break;

    case 'flood':
      prompt = `Edit this image to show the aftermath of heavy rainfall and flooding. The sky is ${intensity.sky}. ${intensity.water}. All surfaces are ${intensity.surfaces}. ${peopleText} Maintain the exact same composition, architecture, and camera angle.`;
      break;

    case 'windstorm':
      prompt = `Edit this image to show an approaching severe windstorm. The sky is ${intensity.sky}. The atmosphere feels ${intensity.mood}. Lighting is ${intensity.light}. ${peopleText} Maintain the exact same composition, architecture, and camera angle.`;
      break;

    case 'adaptation':
      prompt = `Edit this image to show successful climate adaptation - a POSITIVE future. Vegetation is ${intensity.vegetation} and thriving. The sky is ${intensity.sky}. The overall atmosphere is ${intensity.mood}. ${peopleText} Do NOT add any orange tones, haze, or signs of stress. Maintain the exact same composition, architecture, and camera angle.`;
      break;

    default:
      return null;
  }

  return { prompt, intensity: randomLevel, peopleInstruction };
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

// Get random fiction starting point for Claude to expand
function getRandomFiction(scenario) {
  const registers = fictionRegisters[scenario];
  if (!registers) return null;

  const randomRegister = registers[Math.floor(Math.random() * registers.length)];
  const randomExample = randomRegister.examples[Math.floor(Math.random() * randomRegister.examples.length)];

  return { type: randomRegister.type, text: randomExample };
}

// Validate image prompt (lighter validation for Gemini)
function validateImagePrompt(prompt) {
  const issues = [];

  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 100) {
    issues.push(`Prompt too long: ${wordCount} words (max 100)`);
  }

  if (wordCount < 10) {
    issues.push(`Prompt too short: ${wordCount} words (min 10)`);
  }

  return { valid: issues.length === 0, issues };
}

// Build location context for hyper-local predictions
function buildLocationContext(location) {
  if (!location || !location.city) return '';

  return `
## LOCATION CONTEXT: ${location.city}${location.country ? `, ${location.country}` : ''}

Make the fiction hyper-local to this place:
- Reference the specific city/region by name in the FICTION
- Include plausible local climate predictions:
  * Coastal cities: mention sea level rise, storm surge, salt air corrosion
  * Mediterranean cities (Madrid, Barcelona, Rome): mention drought, heat waves, water restrictions
  * River cities: mention flood risk, drainage infrastructure
  * Northern cities: mention changing seasons, new weather patterns
- Mention local landmarks, street names, or cultural elements if recognizable
- The dispatch should feel like it was written BY someone from this place
`;
}

// Scenario-specific instructions (for Claude fiction generation)
const scenarioInstructions = {

  heatwave: `
## HEATWAVE — Extreme heat, mundane tone

FICTION REGISTER (the system has selected one for you):
- Minor inconvenience: "The AC's been running nonstop since Tuesday"
- Normalized routine: "Third siesta hour this week"
- Bureaucratic normal: "Heat protocol level 2 means the terrace closes at 2pm"
- Latent tension: "Nobody mentions the water bill anymore"

Your task: Expand on the provided starting point. Add specific details (temperatures, times, small observations). Keep the same register—don't escalate to crisis.
`,

  flood: `
## FLOOD — Post-rain aftermath, mundane tone

FICTION REGISTER (the system has selected one for you):
- Minor inconvenience: "The drainage couldn't keep up again"
- Normalized routine: "Third time this month we've had to mop the lobby"
- Bureaucratic normal: "Street-level parking suspended until further notice"
- Latent tension: "Insurance stopped covering ground floors last year"

Your task: Expand on the provided starting point. Add specific details (water levels, cleanup, community response). Keep the same register—don't escalate to disaster.
`,

  windstorm: `
## WINDSTORM — Approaching storm or aftermath, mundane tone

FICTION REGISTER (the system has selected one for you):
- Minor inconvenience: "Had to cancel the outdoor meeting again"
- Normalized routine: "The storm warning app has become part of morning coffee"
- Bureaucratic normal: "Wind advisory means the scaffolding comes down by 3pm"
- Latent tension: "The old oak out front has a lean nobody wants to talk about"

Your task: Expand on the provided starting point. Add specific details (wind speeds, preparations, small disruptions). Keep the same register—don't escalate to destruction.
`,

  adaptation: `
## ADAPTATION — Successful climate adaptation, POSITIVE tone only

FICTION REGISTER (the system has selected one for you):
- Successful adaptation: "The retrofit finally pays off—five degrees cooler"
- Community win: "The building committee got something right for once"
- Normalized improvement: "Kids do homework on the terrace now"
- Quiet satisfaction: "Worth every euro of the renovation"

Your task: Expand on the provided starting point. Add specific details (improvements, comfort, satisfaction). Keep it POSITIVE—no crisis, no alerts, no problems.

⚠️ NEVER use: orange, haze, brown, dead, harsh, crisis, emergency, restrictions
`
};

// Final check suffix for system prompt
const scenarioSuffix = {
  heatwave: `\n\n🔴 FINAL CHECK: Heatwave = orange sky + dead vegetation + heat details in fiction.`,
  flood: `\n\n🔴 FINAL CHECK: Flood = grey sky + wet surfaces + post-rain mundane fiction.`,
  windstorm: `\n\n🔴 FINAL CHECK: Windstorm = dramatic dark sky + ominous + storm aftermath fiction.`,
  adaptation: ``
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

  // Extract scenario and location from request
  const scenario = req.body.scenario || 'heatwave';
  const location = req.body.location || null;

  // Debug logging for scenario investigation
  console.log('=== SCENARIO DEBUG ===');
  console.log('Scenario received:', scenario);
  console.log('Has instructions:', !!scenarioInstructions[scenario]);
  if (scenario === 'adaptation') {
    console.log('Adaptation instructions preview:', scenarioInstructions.adaptation?.substring(0, 300));
  }
  console.log('========================');

  // NOTE: Cache disabled to ensure variety in outputs
  // Each request gets fresh intensity + fiction register combinations

  const locationContext = buildLocationContext(location);
  const scenarioGuide = scenarioInstructions[scenario] || scenarioInstructions.heatwave;

  // Generate image prompt programmatically (not by Claude)
  const geminiPromptData = buildGeminiPrompt(scenario);
  const generatedImagePrompt = geminiPromptData?.prompt || '';

  // Get random fiction starting point for Claude to expand
  const fictionData = getRandomFiction(scenario);
  const fictionStartingPoint = fictionData?.text || '';
  const fictionRegister = fictionData?.type?.replace(/_/g, ' ') || '';

  const systemPrompt = `You are a climate design fiction specialist for Heated Studio. Your ONLY task is to write a short fiction dispatch.

## CORE PHILOSOPHY
- MUNDANE, NOT APOCALYPTIC: Show "a grey Tuesday in November", not catastrophe
- HYPER-LOCAL: People relate to their zip code. Make it feel specific, not generic
- TIME HORIZON: Set fictions between 2030-2032 (optimal) or max 2036. Near enough to feel real.

## EMOTIONAL REGISTER & VOICE
Vary the narrative voice. Not always omniscient third person:
- Casual neighbor observation
- Someone's mental note while passing
- Overheard conversation fragment
- Detail noticed from the corner of an eye
- Fact accepted without comment

The tone should feel like texture of adapted life, not headlines.

## PROHIBITED WORDS
Never use: apocalyptic, devastating, catastrophic, scorching, desperate, flee, collapse, disaster, doom, crisis, emergency (unless naming an official protocol)

${scenarioGuide}
${locationContext}

## YOUR TASK
You are given a STARTING POINT for a fiction dispatch. Expand it into 2-3 sentences while:
- Keeping the same emotional register (${fictionRegister})
- Adding specific details (times, temperatures, names, measurements)
- Making it feel hyper-local if location is provided
- Staying mundane, not escalating to crisis

## OUTPUT FORMAT (follow exactly)
FICTION: [Your 2-3 sentence expansion. English only. Keep the register: ${fictionRegister}]

## STARTING POINT TO EXPAND
"${fictionStartingPoint}"` + (scenarioSuffix[scenario] || '');

  try {
    // Simplified user message - Claude only needs to write fiction now
    const userInstruction = `Look at this image. Write a climate fiction dispatch for the ${scenario} scenario.

Starting point to expand: "${fictionStartingPoint}"
Register to maintain: ${fictionRegister}

Output only FICTION: followed by your 2-3 sentence dispatch.`;

    // Fix media types in image content blocks AND replace text with simplified instruction
    const messages = (req.body.messages || []).map(msg => ({
      ...msg,
      content: (msg.content || []).map(block => {
        if (block.type === 'image' && block.source?.type === 'base64' && block.source?.data) {
          const detectedType = getMediaTypeFromBase64(block.source.data);
          return {
            ...block,
            source: {
              ...block.source,
              media_type: detectedType
            }
          };
        }
        // Replace user text with simplified instruction
        if (block.type === 'text') {
          return {
            ...block,
            text: userInstruction
          };
        }
        return block;
      })
    }));

    // Only pass valid Anthropic API fields (exclude scenario, location)
    const { model, max_tokens } = req.body;
    const requestBody = {
      model,
      max_tokens,
      messages,
      system: systemPrompt
    };

    // Debug: Log prompt generation
    console.log('=== PROMPT GENERATION ===');
    console.log('Scenario:', scenario);
    console.log('Image intensity:', geminiPromptData?.intensity || 'N/A');
    console.log('People instruction:', geminiPromptData?.peopleInstruction || 'None');
    console.log('Fiction register:', fictionRegister);
    console.log('Fiction starting point:', fictionStartingPoint);
    console.log('Generated IMG prompt:', generatedImagePrompt.substring(0, 150) + '...');
    console.log('=========================');

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

    // Combine programmatic IMG prompt with Claude's fiction response
    if (data.content && data.content[0]?.text) {
      const claudeText = data.content[0].text;

      // Extract fiction from Claude's response
      const fictionMatch = claudeText.match(/FICTION:\s*(.+)/is);
      const fiction = fictionMatch ? fictionMatch[1].trim() : claudeText.trim();

      // Combine into expected format for frontend
      const combinedResponse = `IMG: ${generatedImagePrompt}\n\nFICTION: ${fiction}`;

      // Replace Claude's response with combined format
      data.content[0].text = combinedResponse;

      // Debug logging
      const imgPrompt = generatedImagePrompt;
      const wordCount = imgPrompt.split(/\s+/).length;
      const validation = validateImagePrompt(imgPrompt);

      console.log('=== HEATED ANALYSIS ===');
      console.log('Scenario:', scenario);
      console.log('Expected performance:', SCENARIO_PERFORMANCE[scenario] || 'Unknown');
      console.log('Location:', location ? `${location.city}, ${location.country}` : 'Not detected');
      console.log('IMG Prompt Word Count:', wordCount);
      console.log('Validation:', validation.valid ? '✓ Valid' : `✗ Issues: ${validation.issues.join(', ')}`);
      console.log('Intensity level:', geminiPromptData?.intensity || 'N/A');
      console.log('People in prompt:', imgPrompt.toLowerCase().includes('people') || imgPrompt.toLowerCase().includes('any people') ? '✓ Yes' : '✗ No');
      console.log('Fiction register:', fictionRegister);
      console.log('Claude fiction preview:', fiction.substring(0, 150));
      console.log('=======================');
    }

    // NOTE: Cache disabled to ensure variety in outputs
    res.status(200).json(data);
  } catch (err) {
    console.error('Analyze API error:', err);
    res.status(500).json({ error: "API request failed" });
  }
}
