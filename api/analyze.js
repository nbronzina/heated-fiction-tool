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

async function getCacheKey(imageBase64, scenario, locationCity) {
  // Use Web Crypto API (ES Module compatible)
  const data = imageBase64.slice(0, 2000) + (scenario || '') + (locationCity || '');
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

// Documented FLUX Kontext capabilities and limitations
const FLUX_LIMITATIONS = {
  canDo: [
    'Change sky/atmosphere dramatically',
    'Shift color palette globally (green → brown, or enhance greens)',
    'Add weather effects (haze, overcast, dramatic clouds)',
    'Darken/lighten surfaces',
    'Add puddles on flat simple surfaces',
    'Change lighting direction and mood',
    'Preserve composition and framing'
  ],
  cannotDo: [
    'Add complex objects (debris, fallen branches)',
    'Deform geometry (bend trees, lean structures)',
    'Create motion blur or active weather',
    'Transform dense texture patterns reliably (flower meadows)',
    'Add infrastructure (solar panels, green roofs)',
    'Submerge objects in water',
    'Add people or change their clothing reliably'
  ]
};

// Scenario performance ratings (UPDATED after optimization)
const SCENARIO_PERFORMANCE = {
  heatwave: '⭐⭐⭐⭐⭐ Excellent (color transformation)',
  flood: '⭐⭐⭐⭐ Good (atmosphere focus)',
  windstorm: '⭐⭐⭐⭐ Good (approaching storm)',
  adaptation: '⭐⭐⭐ Moderate (hopeful palette)'
};

// Validate that generated prompt follows FLUX Kontext requirements
function validateImagePrompt(prompt) {
  const issues = [];

  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 45) {
    issues.push(`Prompt too long: ${wordCount} words (max 40)`);
  }

  const hasInstructionalVerb = /\b(CHANGE|ADD|REPLACE|REMOVE|MAKE)\b/i.test(prompt);
  if (!hasInstructionalVerb) {
    issues.push('Missing instructional verb (CHANGE/ADD/REPLACE)');
  }

  const forbiddenPatterns = [
    // General FLUX limitations
    /bending trees/i,
    /motion blur/i,
    /submerged in water/i,
    /underwater/i,
    /trees blowing/i,
    /active flood/i,
    // Windstorm - no debris/damage
    /fallen branches/i,
    /scattered debris/i,
    /overturned/i,
    /torn awning/i,
    /damaged structure/i,
    // Adaptation - no infrastructure additions
    /solar panel/i,
    /green roof/i,
    /bioswale/i,
    /rain garden/i,
    /permeable pav/i
  ];

  forbiddenPatterns.forEach(pattern => {
    if (pattern.test(prompt)) {
      issues.push(`Contains unreliable request: ${pattern}`);
    }
  });

  if (!/keep.*same|maintain.*composition|preserve/i.test(prompt)) {
    issues.push('Missing preservation clause');
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

// Scenario-specific prompt strategy guidance (OPTIMIZED)
function buildImagePromptGuidance(scenario) {
  const guidance = {
    heatwave: `
PROMPT STRATEGY: Focus on COLOR CHANGE verbs.
Use: "CHANGE sky to orange haze", "CHANGE all vegetation to dead brown", "CHANGE ground to cracked dry earth"
This scenario has 90%+ success rate.
`,
    flood: `
PROMPT STRATEGY: Focus on ATMOSPHERE and WET SURFACES only.
Use: "CHANGE sky to uniform grey overcast", "CHANGE all surfaces to wet dark reflective", "ADD puddles", "MAKE colors muted desaturated"
DO NOT promise vegetation transformation - leave vegetation as-is or request subtle darkening only.
Success rate: 80%+ when focused on atmosphere.
`,
    windstorm: `
PROMPT STRATEGY: Show APPROACHING STORM, not aftermath.
Use: "CHANGE sky to dark dramatic turbulent storm clouds", "CHANGE lighting to ominous directional", "ADD threatening atmosphere"
DO NOT request: debris, fallen branches, damage, scattered objects. FLUX cannot add these.
The IMAGE shows the threat; the FICTION describes the damage.
Success rate: 85%+ for dramatic sky/atmosphere.
`,
    adaptation: `
PROMPT STRATEGY: Focus on HOPEFUL COLOR PALETTE only.
Use: "CHANGE to warm golden hour light", "CHANGE vegetation to lush vibrant healthy green", "MAKE atmosphere pleasant inviting"
DO NOT request: solar panels, green roofs, bioswales, infrastructure. FLUX cannot add objects.
The IMAGE shows a thriving future; the FICTION describes the policies and infrastructure.
Success rate: 75%+ for color/mood transformation.
`
  };

  return guidance[scenario] || '';
}

// Scenario-specific instructions (OPTIMIZED for FLUX strengths)
const scenarioInstructions = {

  heatwave: `
## HEATWAVE — SSP3-7.0 (BEST PERFORMING SCENARIO ⭐⭐⭐⭐⭐)
Extreme heat/drought. This scenario works excellently because it requires COLOR CHANGES, not object additions.

VISUAL EFFECTS (high success rate):
- Sky: CHANGE to harsh orange/amber haze, washed out, heat shimmer
- Vegetation: CHANGE ALL grass, plants, flowers to dead brown straw color. This works well.
- Trees: CHANGE foliage to wilted, brown-edged, sparse
- Ground: CHANGE to cracked dry earth, dust, parched soil
- Building surfaces: ADD warm color cast, slight weathering
- Overall: Desaturate greens completely, shift palette to browns/oranges

ATMOSPHERE: Harsh sunlight, high contrast, heat haze, orange/amber cast

FICTION TONE: A scorching Tuesday in August. Mention temperature (42°C), water restrictions, siesta hours, shade-seeking.
`,

  flood: `
## FLOOD — SSP3-7.0 (GOOD PERFORMANCE ⭐⭐⭐⭐)
Post-rain atmosphere. Focus ONLY on what FLUX does well: sky, surfaces, mood.

VISUAL EFFECTS (focus on atmosphere):
- Sky: CHANGE to uniform grey overcast. NOT dramatic storm clouds. Flat, mundane grey.
- Surfaces: CHANGE ALL pavement, concrete, roads to wet, dark, reflective black.
- Puddles: ADD standing water puddles on flat surfaces.
- Color: DESATURATE everything. Grey/muted palette. Low saturation.
- Light: Diffused, flat, no harsh shadows.

DO NOT REQUEST (unreliable):
- Vegetation transformation (leave plants as-is)
- Brown/dead vegetation (inconsistent with dense areas)
- Debris or mud (FLUX can't add objects)

ATMOSPHERE: Grey, muted, wet, cold — like a rainy Tuesday morning

FICTION TONE: The FICTION carries the flood narrative. Describe waterlogged gardens, damaged vegetation, drainage issues, cleanup efforts. The image shows the grey wet atmosphere; the text describes the impact.
`,

  windstorm: `
## WINDSTORM — SSP3-7.0 (GOOD PERFORMANCE ⭐⭐⭐⭐)
APPROACHING STORM — not aftermath. Show the threatening sky BEFORE impact.

Why this works: FLUX excels at dramatic skies and lighting. It cannot add debris or damage.

VISUAL EFFECTS (high success rate):
- Sky: CHANGE to dark, dramatic, turbulent storm clouds. Greenish-grey tint. Ominous.
- Lighting: CHANGE to harsh directional light, high contrast, dramatic shadows
- Atmosphere: ADD threatening, tense, pre-storm stillness
- Color: Dark, desaturated, ominous palette

DO NOT REQUEST (FLUX cannot do these):
- Fallen branches or debris
- Bent or leaning trees
- Scattered objects or overturned furniture
- Torn awnings or structural damage
- Motion blur or active wind

ATMOSPHERE: Dark, ominous, dramatic sky, the calm before the storm

FICTION TONE: The FICTION describes the aftermath and damage. "The storm that hit last night..." / "Wind speeds reached 140km/h..." / "Cleanup crews are assessing damage..." The image shows the threat; the text narrates the impact.
`,

  adaptation: `
⚠️ CRITICAL INSTRUCTION FOR ADAPTATION SCENARIO ⚠️

This is the ONLY positive scenario. It shows a SUCCESSFUL future where adaptation WORKED.
Life is BETTER, not worse. Comfort, not coping.

## FICTION: WHAT TO WRITE

DO NOT write about:
- Blinds staying down
- Air quality problems
- Heat alerts or protocols
- Checking forecasts anxiously
- Restricted outdoor time
- Constant ventilation needs
- Any form of suffering, limitation, or discomfort

DO write about:
- Open windows, fresh air flowing
- Comfortable outdoor dining
- Kids playing outside freely
- Green infrastructure working as designed
- "The retrofit was worth it"
- Life that feels BETTER than today
- Neighbors enjoying shared spaces
- Successful community decisions

## IMAGE: VISUAL EFFECTS

MUST show IMPROVEMENT over original. Greener, fresher, more pleasant.

- Sky: CLEAR blue sky, soft white clouds. NEVER haze, NEVER orange.
- Light: Soft pleasant daylight. NEVER harsh, NEVER amber/sepia.
- Vegetation: Lush, vibrant, healthy GREEN. Thriving.
- Atmosphere: Fresh, inviting, comfortable.
- Colors: Greens, blues, natural tones. NO orange filter.

NEVER use these words in IMG prompt: haze, shimmer, harsh, scorching, dust, amber, sepia, orange

## EXAMPLE ADAPTATION OUTPUT

IMG: ENHANCE vegetation to lush vibrant green. CHANGE sky to clear pleasant blue with soft clouds. CHANGE lighting to soft comfortable daylight. MAKE atmosphere fresh and inviting. Keep the exact same composition, camera angle, and framing.

FICTION: The courtyard retrofit finally pays off—three degrees cooler than the street, even in August. Marta's kids do homework at the outdoor table now. The building committee voted to expand the green wall to the east facade next spring.
`
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

## FLUX KONTEXT CAPABILITIES (Critical - follow strictly)
FLUX CAN reliably do:
- Change sky/atmosphere dramatically (dramatic clouds, overcast, haze)
- Shift color palette globally (green → brown, or enhance greens)
- Add weather mood (heat shimmer, wet surfaces, ominous lighting)
- Darken/lighten surfaces, make surfaces wet/reflective
- Change lighting direction, contrast, and mood

FLUX CANNOT reliably do:
- Add objects (debris, branches, solar panels, infrastructure)
- Deform geometry (bend trees, lean structures)
- Transform dense vegetation patterns consistently
- Add or modify people

## IMAGE INTENSITY SPECTRUM
Match image intensity to fiction register. Not always orange apocalyptic sky.

HEATWAVE:
- Intense: orange sky, dense haze, dead vegetation
- Moderate: yellowish sky, visible heat but not extreme
- Mild: harsh light, hard shadows, stressed but living vegetation

FLOOD:
- Intense: large puddles, very wet surfaces
- Moderate: damp ground, uniform grey sky
- Mild: post-rain, some wet surfaces, scattered clouds

WINDSTORM:
- Intense: dark dramatic sky, turbulent clouds
- Moderate: threatening sky, strong directional light
- Mild: dynamic cloudy sky, visible breeze in vegetation

ADAPTATION (always positive, NEVER hazy/orange):
- Intense: lush vibrant vegetation, clear blue sky, beautiful day
- Moderate: healthy green vegetation, pleasant clear atmosphere
- Mild: subtle green improvements, calm fresh atmosphere

Rule: Minor inconvenience = mild visual. Latent tension = moderate. Bureaucratic protocol = intense OR mild depending on context.

## DIVISION OF LABOR
- IMAGE PROMPT: Focus on sky, atmosphere, color palette, lighting, surface treatment
- FICTION TEXT: Carry the narrative details (adaptation, routines, policies, human response)

## FLUX KONTEXT SYNTAX RULES
- Use INSTRUCTIONAL verbs: "CHANGE the sky to..." / "ADD wet reflections" / "MAKE atmosphere..."
- NEVER use: "The image shows..." / "A scene with..." / "Depicting..."
- Max 40 words for image prompt
- MUST end with: "Keep the exact same composition, camera angle, and framing."

${scenarioGuide}
${promptGuidance}
${locationContext}

## OUTPUT FORMAT (follow exactly)
IMG: [Your 40-word max FLUX Kontext prompt. Focus on SKY, ATMOSPHERE, COLOR, LIGHTING. No object additions. No line breaks.]

FICTION: [2-3 sentences IN ENGLISH. Vary the emotional register—not every fiction is peak crisis. Show texture of adapted life. Be specific, hyper-local. Include one concrete detail. Always English regardless of location.]

## EXAMPLE OUTPUTS (showing variety)

Heatwave (minor inconvenience):
IMG: CHANGE sky to hazy white-yellow with gentle heat shimmer on horizon. MAKE colors slightly washed out and warm. ADD subtle dust to air. Keep the exact same composition, camera angle, and framing.
FICTION: The bus shelter's solar panels power a small fan now. It helps, a little. August in this part of town means finding shade has become second nature.

Flood (observation):
IMG: CHANGE sky to flat grey overcast. MAKE all ground surfaces wet and reflective. ADD muted, desaturated tones throughout. Keep the exact same composition, camera angle, and framing.
FICTION: Water marks on the pharmacy wall—third set this year, María notes on her way to work. The sandbags by the door stay out permanently now.

Adaptation (success):
IMG: ADD warm golden hour lighting with slight haze. MAKE greens more vibrant and lush. CHANGE atmosphere to hopeful amber tones. Keep the exact same composition, camera angle, and framing.
FICTION: The green corridor keeps this block five degrees cooler. Kids actually play outside again. Someone on the planning committee got it right.

Remember: Vary the register. Some days are just... different now.`;

  try {
    // Fix media types in image content blocks
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
