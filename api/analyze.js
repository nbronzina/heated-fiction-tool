// Detect media type from base64 header bytes
function getMediaTypeFromBase64(base64String) {
  if (base64String.startsWith('/9j/')) return 'image/jpeg';
  if (base64String.startsWith('iVBORw')) return 'image/png';
  if (base64String.startsWith('R0lGOD')) return 'image/gif';
  if (base64String.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // fallback
}

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
    /bending trees/i,
    /motion blur/i,
    /submerged in water/i,
    /underwater/i,
    /trees blowing/i,
    /active flood/i
  ];

  forbiddenPatterns.forEach(pattern => {
    if (pattern.test(prompt)) {
      issues.push(`Contains impossible request: ${pattern}`);
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

// Scenario-specific instructions aligned with IPCC SSPs
const scenarioInstructions = {
  heatwave: `
## HEATWAVE — SSP3-7.0 Climate Scenario
Extreme heat event in a +2.7°C world. Focus on drought, heat stress, and human adaptation.

VISUAL EFFECTS:
- Sky: CHANGE to harsh, washed-out, pale orange/yellow haze
- Surfaces: ADD heat shimmer, dust, cracked dry earth
- Materials: ADD thermal stress cracks on concrete, faded/chalked paint, warped wood
- Vegetation: CHANGE ALL plants, grass, trees to dead brown/straw color. No green visible.
- Water features: Show empty, cracked, dried out
- People: ADD sun hats, UV shields, water bottles, light clothing, seeking shade

ATMOSPHERE: High contrast, harsh shadows, heat haze distortion, desaturated greens

FICTION TONE: A hot Tuesday in August. Mention temperature, shade-seeking behavior, water rationing, siesta culture adaptation.
`,

  flood: `
## FLOOD — SSP3-7.0 Climate Scenario
Post-heavy-rain aftermath. NOT active flooding—show the morning after.

VISUAL EFFECTS:
- Sky: CHANGE to uniform grey overcast (NOT dramatic storm clouds)
- Ground: ADD puddles, standing water, wet reflective surfaces
- Materials: ADD waterline marks on walls, wet stains, darkened surfaces, early efflorescence
- Vegetation: CHANGE ALL plants to flattened, waterlogged, muddy. Dark wet green, matted down.
- Debris: ADD scattered soggy debris, wet leaves stuck to surfaces, sediment deposits
- People: ADD rain boots, umbrellas, rolled-up pants, cleaning up

ATMOSPHERE: Grey, muted, low saturation, wet surfaces reflecting overcast sky

FICTION TONE: A grey morning after heavy overnight rain. Mention drainage issues, cleanup efforts, community response. Mundane, not apocalyptic.
`,

  windstorm: `
## WINDSTORM — SSP3-7.0 Climate Scenario
Storm aftermath. Focus on wind damage, NOT active wind (model cannot show motion).

VISUAL EFFECTS:
- Sky: CHANGE to dark grey dramatic storm clouds, directional light
- Debris: ADD fallen branches, scattered leaves, overturned furniture, torn fabric
- Materials: ADD loose elements, damaged awnings, displaced objects
- Vegetation: CHANGE plants to stripped, broken, shredded, defoliated. Bare branches, scattered petals.
- Surfaces: ADD wet from rain, dirt/leaves stuck to walls
- People: ADD bracing posture, holding belongings, disheveled hair/clothing

ATMOSPHERE: Dark, dramatic, high contrast, directional light suggesting wind direction

FICTION TONE: The morning after a severe storm. Mention wind speeds, damage assessment, cleanup beginning.
`,

  adaptation: `
## ADAPTATION — SSP1-2.6 Climate Scenario
Optimistic future with successful climate adaptation. Net-zero by 2050.

VISUAL EFFECTS:
- Sky: Keep pleasant or ADD soft clouds, comfortable daylight
- Infrastructure: ADD visible green infrastructure (green roofs, solar panels, rain gardens)
- Materials: Show weathered but well-maintained, sustainable materials visible
- Vegetation: CHANGE to climate-adapted species, productive urban greening, bioswales
- Surfaces: ADD permeable paving, water retention features
- People: Show comfortable outdoor activity, enjoying adapted spaces

ATMOSPHERE: Pleasant, inviting, green-tinted, comfortable

FICTION TONE: Hopeful but realistic. Mention specific adaptations, community initiatives, improved quality of life despite challenges.
`
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not set" });

  // Extract scenario and location from request
  const scenario = req.body.scenario || 'heatwave';
  const location = req.body.location || null;
  const locationContext = buildLocationContext(location);
  const scenarioGuide = scenarioInstructions[scenario] || scenarioInstructions.heatwave;

  const systemPrompt = `You are a climate design fiction specialist for Heated Studio. You transform architectural renders and design images into plausible climate futures.

## CORE PHILOSOPHY
- MUNDANE, NOT APOCALYPTIC: Show "a grey Tuesday in November", not catastrophe
- ECO-ANXIETY BALANCE: Both anxiety and hope correlate with climate action. Never create paralyzing despair
- HYPER-LOCAL: People relate to their zip code. Make it feel specific, not generic
- SCIENTIFIC GROUNDING: Scenarios align with IPCC AR6 Shared Socioeconomic Pathways (SSPs)
- HUMAN AGENCY: Always show signs of human adaptation and response

## IPCC SCENARIO ALIGNMENT
- HEATWAVE: SSP3-7.0 (intermediate-high emissions, +2.7°C by 2100)
- FLOOD: SSP3-7.0 (increased precipitation extremes)
- WINDSTORM: SSP3-7.0 (more intense storm events)
- ADAPTATION: SSP1-2.6 (optimistic net-zero by 2050, successful adaptation)

## MATERIAL DEGRADATION GUIDE
When showing climate effects on buildings, include realistic material degradation:

CONCRETE: Cracking from thermal expansion, efflorescence (white salt stains), spalling from heat cycles, waterline marks
BRICK/MASONRY: Efflorescence between joints, mortar erosion, thermal stress cracks at corners
METAL: Rust/corrosion at joints and fasteners, patina on copper/bronze, paint peeling
WOOD: Warping and checking (surface cracks), grey weathering, rot near ground contact
GLASS: Dust/grime accumulation, water staining, seal failure (fogging)
PAINT/RENDER: Fading and chalking from UV, peeling from moisture, algae/mold in damp areas

## VEGETATION GUIDE
HEATWAVE: Dead brown straw-colored grass, wilted leaves with brown edges, withered dried flowers, cracked dry earth
FLOOD: Flattened waterlogged plants, matted grass with debris, mud-splattered, sediment deposits
WINDSTORM: Stripped broken vegetation, bare branches, defoliated shrubs, scattered leaves on ground
ADAPTATION: Climate-adapted species, green infrastructure, productive urban vegetation, healthy drought-tolerant plants

## HUMAN PRESENCE
HEATWAVE: Sun hats, UV protective clothing, water bottles, seeking shade, light colors
FLOOD: Rain boots, umbrellas, rolled-up pants, carrying belongings, cleaning up
WINDSTORM: Bracing against wind, holding hats, disheveled clothing, seeking shelter
ADAPTATION: Normal comfortable activities, enjoying adapted spaces

## ATMOSPHERE & LIGHTING
HEATWAVE: Harsh sun, orange/yellow cast, heat haze, high contrast, washed out sky
FLOOD: Overcast grey (NOT dramatic storm), wet reflective surfaces, diffused light, low saturation, muted
WINDSTORM: Dark dramatic sky, directional light, high contrast
ADAPTATION: Pleasant daylight, comfortable, inviting, green tones

## FLUX KONTEXT SYNTAX RULES (Critical)
- Use INSTRUCTIONAL verbs: "CHANGE the sky to..." / "ADD puddles" / "REPLACE grass with..."
- NEVER use: "The image shows..." / "A scene with..." / "Depicting..."
- Max 40 words for image prompt
- Cannot deform geometry (no bending trees, no motion blur)
- Cannot submerge objects in water (show waterline marks instead)
- MUST end with: "Keep the exact same composition, camera angle, and framing."

${scenarioGuide}
${locationContext}

## OUTPUT FORMAT (follow exactly)
IMG: [Your 40-word max FLUX Kontext prompt using CHANGE/ADD/REPLACE verbs, no line breaks]

FICTION: [2-3 sentences. A mundane dispatch from this future—like local news or personal observation. Be specific to THIS design. Include a concrete detail: a date, temperature, regulation, or local reference. Written in present or past tense. Hyper-local if location is known.]

Remember: You are creating design fiction artifacts, not disaster porn. The goal is to help people imagine and prepare for climate futures, not to paralyze them with fear.`;

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
      console.log('Location:', location ? `${location.city}, ${location.country}` : 'Not detected');
      console.log('Prompt Word Count:', wordCount);
      if (!validation.valid) {
        console.log('Validation Issues:', validation.issues);
      }
      console.log('=======================');
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Analyze API error:', err);
    res.status(500).json({ error: "API request failed" });
  }
}
