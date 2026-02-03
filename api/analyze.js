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

// Scenario-specific prompt strategy guidance (Gemini conversational format)
function buildImagePromptGuidance(scenario) {
  const guidance = {
    heatwave: `
PROMPT STYLE: Conversational, descriptive.
Describe: "Edit this image to show an extreme heatwave. The sky should be orange-amber with heat haze. All vegetation should appear dead, brown, and dried out. The ground looks cracked and parched. Everything has a harsh, sun-bleached quality."
`,
    flood: `
PROMPT STYLE: Conversational, descriptive.
Describe: "Edit this image to show the aftermath of heavy rain. The sky is grey and overcast. All surfaces are wet and reflective. There are puddles on the ground. The colors are muted and desaturated. It looks like a grey, damp morning."
`,
    windstorm: `
PROMPT STYLE: Conversational, descriptive.
Describe: "Edit this image to show an approaching storm. The sky is dark and dramatic with turbulent clouds. The lighting is ominous and directional. The atmosphere feels threatening and heavy."
`,
    adaptation: `
PROMPT STYLE: Conversational, descriptive. POSITIVE outcome only.
Describe: "Edit this image to show a thriving, well-adapted future. The sky is clear blue with soft clouds. Vegetation is lush and vibrant green. The atmosphere is fresh and pleasant." NO orange, NO haze.`
  };

  return guidance[scenario] || '';
}

// Scenario-specific instructions (OPTIMIZED for FLUX strengths)
const scenarioInstructions = {

  heatwave: `
## HEATWAVE SCENARIO
Extreme heat/drought. Show the oppressive reality of a heatwave.

IMAGE DESCRIPTION:
Write a conversational prompt describing: orange-amber sky with heat haze, all vegetation dead and brown, parched cracked ground, harsh sun-bleached quality, everything looks dried out and scorched.

FICTION TONE: A scorching Tuesday in August. Mention temperature (42°C), water restrictions, siesta hours, shade-seeking. Mundane, not apocalyptic.
`,

  flood: `
## FLOOD SCENARIO
Post-rain atmosphere. Show the grey, wet aftermath.

IMAGE DESCRIPTION:
Write a conversational prompt describing: grey overcast sky, all surfaces wet and reflective, puddles on the ground, muted desaturated colors, damp and cold atmosphere, like a rainy Tuesday morning.

FICTION TONE: Describe waterlogged areas, drainage issues, cleanup efforts. Mundane, not disaster movie.
`,

  windstorm: `
## WINDSTORM SCENARIO
Approaching storm. Show the threatening sky before impact.

IMAGE DESCRIPTION:
Write a conversational prompt describing: dark dramatic turbulent storm clouds, ominous directional lighting, threatening atmosphere, greenish-grey sky, the tense calm before the storm.

FICTION TONE: Describe storm warnings, wind speeds, crews assessing damage, early closures. The image shows the threat; the fiction narrates the aftermath.
`,

  adaptation: `
## ADAPTATION — THE POSITIVE SCENARIO

This shows a SUCCESSFUL future. Life is BETTER, not worse.

IMAGE:
- Clear blue sky, soft clouds
- Lush vibrant green vegetation
- Fresh, pleasant atmosphere
- NEVER: orange, haze, amber, sepia, brown

FICTION:
- Success story: "retrofit worked", kids playing outside, open windows
- NEVER: crisis, alerts, air quality problems, restrictions

EXAMPLE:
IMG: CHANGE sky to clear blue with soft clouds. ENHANCE vegetation to lush vibrant green. MAKE atmosphere fresh and inviting. Keep same composition.
FICTION: The courtyard retrofit pays off—three degrees cooler. Kids do homework outside now.
`
};

// Scenario-specific reminders to inject into user message (reinforces system prompt)
const scenarioReminders = {
  heatwave: `⚠️ HEATWAVE SCENARIO:
- Image: Orange/amber sky, dead brown vegetation, heat haze, harsh light
- Fiction: Heat protocols, shade-seeking, adjusted routines, specific temperatures
- Mundane tone: "A hot Tuesday", not apocalypse`,

  flood: `⚠️ FLOOD SCENARIO:
- Image: Grey overcast sky, wet surfaces, puddles, muted colors
- Fiction: Post-rain cleanup, drainage issues, community response
- Mundane tone: "Morning after storms", not disaster movie`,

  windstorm: `⚠️ WINDSTORM SCENARIO:
- Image: Dark dramatic sky, ominous atmosphere, high contrast
- Fiction: Storm warnings, early closures, crews assessing
- Mundane tone: "Storm passed through", not destruction`,

  adaptation: `⚠️ ADAPTATION SCENARIO - THE ONLY POSITIVE ONE:
- Image: CLEAR BLUE SKY, lush GREEN vegetation, pleasant soft light. NO orange, NO haze, NO brown.
- Fiction: SUCCESS story only. Comfort, "the retrofit worked", kids playing outside, open windows.
- DO NOT write about: crisis, alerts, air quality problems, blinds down, restricted time outside.`
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

  // Check cache first
  const imageData = req.body.messages?.[0]?.content?.find(b => b.type === 'image')?.source?.data || '';
  const cacheKey = await getCacheKey(imageData, scenario, location?.city);
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[CACHE HIT]', cacheKey.slice(0, 8));
    return res.status(200).json(cached.data);
  }

  const locationContext = buildLocationContext(location);
  const scenarioGuide = scenarioInstructions[scenario] || scenarioInstructions.heatwave;
  const promptGuidance = buildImagePromptGuidance(scenario);

  const systemPrompt = `You are a climate design fiction specialist for Heated Studio. You transform architectural renders and design images into plausible climate futures.

## CORE PHILOSOPHY
- MUNDANE, NOT APOCALYPTIC: Show "a grey Tuesday in November", not catastrophe
- SPECTRUM OF MUNDANITY: Climate change isn't constant emergency. Vary the register:
  * Minor inconvenience (30%): "The café moved its umbrellas to the shaded side. Regulars adjusted."
  * Normalized routine change (30%): "Sara checks the UV index before her run now. Most days she goes at 6am."
  * Successful adaptation (20%): "The shade sails went up in 2029. The street feels almost pleasant."
  * Bureaucratic normal (15%): "Heat protocol kicks in above 42°C. Third time this month."
  * Latent tension (5%): "The fountain hasn't worked since April. Nobody knows when water comes back."
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

## IMAGE GENERATION (Gemini)
Write conversational, descriptive prompts that describe the desired transformation.
Focus on: sky, atmosphere, vegetation state, lighting, overall mood.

## IMAGE INTENSITY
Match image intensity to fiction register:
- Minor inconvenience → subtle changes
- Routine adaptation → moderate changes
- Protocol/alert → noticeable changes

ADAPTATION is always positive: clear blue sky, lush green, pleasant atmosphere.

## DIVISION OF LABOR
- IMAGE PROMPT: Describe the visual transformation (atmosphere, colors, mood)
- FICTION TEXT: Carry the narrative (policies, human response, specific details)

## PROMPT STYLE
Write as a natural instruction: "Edit this image to show [scenario]. The sky should be [description]. The vegetation appears [state]. The atmosphere feels [mood]."

${scenarioGuide}
${promptGuidance}
${locationContext}

## OUTPUT FORMAT (follow exactly)
IMG: [Conversational prompt describing the image transformation. 20-60 words. Describe the desired end state.]

FICTION: [2-3 sentences IN ENGLISH. Vary the emotional register—not every fiction is peak crisis. Show texture of adapted life. Be specific, hyper-local. Include one concrete detail. Always English regardless of location.]

## EXAMPLE OUTPUTS

Heatwave:
IMG: Edit this image to show an extreme heatwave. The sky is orange-amber with visible heat haze. All grass and plants are dead brown. The ground looks parched and dusty. Everything has a harsh, sun-bleached quality.
FICTION: The bus shelter's solar panels power a small fan now. It helps, a little. August in this part of town means finding shade has become second nature.

Flood:
IMG: Edit this image to show the aftermath of heavy rain. The sky is flat grey and overcast. All surfaces are wet and reflective with puddles. The colors are muted and desaturated. It feels like a cold, damp morning.
FICTION: Water marks on the pharmacy wall—third set this year, María notes on her way to work. The sandbags by the door stay out permanently now.

Adaptation:
IMG: Edit this image to show a thriving, well-adapted future. The sky is clear blue with soft clouds. All vegetation is lush and vibrant green. The atmosphere is fresh and pleasant.
FICTION: The green corridor keeps this block cooler. Kids play outside again.

Remember: Vary the register. Some days are just... different now.` + (scenarioSuffix[scenario] || '');

  try {
    // Get scenario reminder and random people instruction for user message
    const reminder = scenarioReminders[scenario] || '';
    const peopleInstruction = getRandomPeopleInstruction(scenario);
    const fullReminder = reminder + (peopleInstruction ? `\n\nPEOPLE IN IMAGE: If there are people visible, show them as: ${peopleInstruction}` : '');

    // Fix media types in image content blocks AND inject scenario reminder into text
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
        // Inject scenario reminder into user text message
        if (block.type === 'text' && fullReminder) {
          return {
            ...block,
            text: `${fullReminder}\n\n${block.text}`
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

    // Debug: Log system prompt for adaptation
    if (scenario === 'adaptation') {
      console.log('=== ADAPTATION PROMPT DEBUG ===');
      console.log('System prompt length:', systemPrompt.length);
      console.log('Contains CRITICAL INSTRUCTION:', systemPrompt.includes('CRITICAL INSTRUCTION'));
      console.log('Contains "kids playing":', systemPrompt.includes('kids playing'));
      console.log('Contains "DO NOT write about":', systemPrompt.includes('DO NOT write about'));
      console.log('Scenario guide preview:', scenarioGuide?.substring(0, 400));
      console.log('================================');
    }

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

    // Debug logging
    if (data.content && data.content[0]?.text) {
      const text = data.content[0].text;
      const imgMatch = text.match(/IMG:\s*(.+?)(?=FICTION:|$)/is);
      const imgPrompt = imgMatch ? imgMatch[1].trim() : '';
      const wordCount = imgPrompt.split(/\s+/).length;
      const validation = validateImagePrompt(imgPrompt);

      console.log('=== HEATED ANALYSIS ===');
      console.log('Scenario:', scenario);
      console.log('Expected performance:', SCENARIO_PERFORMANCE[scenario] || 'Unknown');
      console.log('Location:', location ? `${location.city}, ${location.country}` : 'Not detected');
      console.log('Prompt Word Count:', wordCount);
      console.log('Validation:', validation.valid ? '✓ Valid' : `✗ Issues: ${validation.issues.join(', ')}`);
      console.log('=======================');
    }

    // Store in cache
    analysisCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log('[CACHE MISS - STORED]', cacheKey.slice(0, 8));

    res.status(200).json(data);
  } catch (err) {
    console.error('Analyze API error:', err);
    res.status(500).json({ error: "API request failed" });
  }
}
