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
    'Shift color palette globally (green → brown)',
    'Add weather effects (haze, overcast)',
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
  ],
  bestResults: [
    'Heatwave scenario (color transformation)',
    'Images with clear surfaces and simple vegetation',
    'Architectural renders with hard surfaces',
    'Interior spaces',
    'Product photography'
  ],
  worstResults: [
    'Dense meadows or complex vegetation patterns',
    'Requests for physical object additions',
    'Windstorm debris',
    'Adaptation infrastructure'
  ]
};

// Scenario performance ratings
const SCENARIO_PERFORMANCE = {
  heatwave: '⭐⭐⭐⭐⭐ Excellent',
  flood: '⭐⭐⭐ Moderate',
  windstorm: '⭐⭐ Limited (atmosphere only)',
  adaptation: '⭐⭐ Limited (atmosphere only)'
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
    /bending trees/i,
    /motion blur/i,
    /submerged in water/i,
    /underwater/i,
    /trees blowing/i,
    /active flood/i,
    /fallen branches/i,
    /scattered debris/i,
    /overturned/i
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

// Scenario-specific prompt strategy guidance
function buildImagePromptGuidance(scenario) {
  const guidance = {
    heatwave: `
PROMPT STRATEGY: Focus on COLOR CHANGE verbs.
Use: "CHANGE sky to orange haze", "CHANGE all vegetation to dead brown", "CHANGE ground to cracked dry earth"
This scenario has 90%+ success rate.
`,
    flood: `
PROMPT STRATEGY: Focus on ATMOSPHERE and SURFACE changes.
Use: "CHANGE sky to grey overcast", "CHANGE surfaces to wet reflective", "ADD puddles"
Avoid: Expecting dense vegetation to transform completely.
Success rate: 60-70% depending on image complexity.
`,
    windstorm: `
PROMPT STRATEGY: Focus on SKY and LIGHTING only.
Use: "CHANGE sky to dark storm clouds", "CHANGE lighting to dramatic high contrast"
DO NOT request: debris, fallen branches, bent trees, scattered objects.
Success rate: 50% (atmosphere only, no physical damage).
`,
    adaptation: `
PROMPT STRATEGY: Focus on PLEASANT ATMOSPHERE.
Use: "CHANGE to pleasant daylight", "CHANGE vegetation to healthy Mediterranean"
DO NOT request: solar panels, green roofs, infrastructure additions.
Success rate: 40% (lighting change only, rely on FICTION for narrative).
`
  };

  return guidance[scenario] || '';
}

// Scenario-specific instructions with documented performance levels
const scenarioInstructions = {

  heatwave: `
## HEATWAVE — SSP3-7.0 (BEST PERFORMING SCENARIO)
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

NOTE: This scenario consistently produces strong results. Prioritize color transformation over object addition.
`,

  flood: `
## FLOOD — SSP3-7.0 (MODERATE PERFORMANCE)
Post-rain aftermath. Works for atmosphere; vegetation transformation is inconsistent.

VISUAL EFFECTS (focus on what works):
- Sky: CHANGE to uniform grey overcast. NOT dramatic storm clouds. This works well.
- Surfaces: CHANGE pavement to wet, dark, reflective. This works well.
- Puddles: ADD puddles on flat surfaces. Works partially.
- Walls: ADD waterline stains, wet marks on lower portions. Works partially.
- Vegetation: CHANGE to flattened, wet, muddy. INCONSISTENT with dense meadows.
- Color: Desaturate everything, grey/brown palette, muted tones

ATMOSPHERE: Grey, muted, wet, low saturation — like a rainy Tuesday morning

FICTION TONE: The morning after overnight storms. Mention drainage issues, cleanup, community response.

KNOWN LIMITATION: Dense flower meadows may remain partially green. Works better on sparse vegetation or hard surfaces.
`,

  windstorm: `
## WINDSTORM — SSP3-7.0 (LIMITED PERFORMANCE)
Storm aftermath. Atmosphere works; physical debris does NOT reliably appear.

VISUAL EFFECTS (focus on atmosphere only):
- Sky: CHANGE to dark dramatic storm clouds. This works well.
- Lighting: CHANGE to harsh directional light, high contrast. This works.
- Surfaces: CHANGE to wet, darkened. Works partially.
- Trees: CHANGE leaves to sparse, some bare branches. Inconsistent.

DO NOT REQUEST (FLUX cannot do these reliably):
- Fallen branches or debris on ground
- Bent or leaning trees
- Motion blur or active wind
- Scattered objects or overturned furniture
- Torn awnings or damaged structures

ATMOSPHERE: Dark, ominous, dramatic sky, post-storm stillness

FICTION TONE: The eerie calm after the storm passed. Mention wind speeds from last night, damage reports coming in.

KNOWN LIMITATION: This scenario primarily delivers atmosphere change. Physical damage/debris will not appear consistently.
`,

  adaptation: `
## ADAPTATION — SSP1-2.6 (LIMITED PERFORMANCE)
Positive climate-adapted future. FLUX struggles to ADD infrastructure.

VISUAL EFFECTS (manage expectations):
- Sky: CHANGE to pleasant daylight, soft warm tones. Works.
- Vegetation: CHANGE to lush, healthy, Mediterranean palette. Partially works.
- Light: Golden hour warmth acceptable but not just a sunset filter.

ASPIRATIONAL (request but don't expect):
- Solar panels on roofs
- Green roof sections
- Rain gardens or bioswales
- Permeable paving

ATMOSPHERE: Pleasant, hopeful, green-tinted, inviting

FICTION TONE: A comfortable Tuesday in the adapted city. Mention specific policies that worked, community gardens, improved quality of life.

KNOWN LIMITATION: FLUX cannot reliably ADD complex infrastructure. Results will show atmospheric/color changes more than physical additions. The FICTION text carries the adaptation narrative more than the image.
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
  const promptGuidance = buildImagePromptGuidance(scenario);

  const systemPrompt = `You are a climate design fiction specialist for Heated Studio. You transform architectural renders and design images into plausible climate futures.

## CORE PHILOSOPHY
- MUNDANE, NOT APOCALYPTIC: Show "a grey Tuesday in November", not catastrophe
- ECO-ANXIETY BALANCE: Both anxiety and hope correlate with climate action. Never create paralyzing despair
- HYPER-LOCAL: People relate to their zip code. Make it feel specific, not generic
- SCIENTIFIC GROUNDING: Scenarios align with IPCC AR6 Shared Socioeconomic Pathways (SSPs)
- HUMAN AGENCY: Always show signs of human adaptation and response

## FLUX KONTEXT CAPABILITIES (Critical - follow strictly)
FLUX CAN reliably do:
- Change sky/atmosphere dramatically
- Shift color palette globally (green → brown, saturated → muted)
- Add weather effects (haze, overcast, heat shimmer)
- Darken/lighten and wet surfaces
- Change lighting direction and mood

FLUX CANNOT reliably do:
- Add complex objects (debris, fallen branches, solar panels)
- Deform geometry (bend trees, lean structures)
- Create motion blur or active weather
- Transform dense texture patterns (flower meadows often resist change)
- Add or modify people

## FLUX KONTEXT SYNTAX RULES
- Use INSTRUCTIONAL verbs: "CHANGE the sky to..." / "ADD puddles" / "REPLACE grass with..."
- NEVER use: "The image shows..." / "A scene with..." / "Depicting..."
- Max 40 words for image prompt
- MUST end with: "Keep the exact same composition, camera angle, and framing."

${scenarioGuide}
${promptGuidance}
${locationContext}

## SCENARIO PERFORMANCE NOTES
- HEATWAVE: Your strongest scenario. Color transformation works excellently.
- FLOOD: Atmosphere works well. Vegetation transformation is hit-or-miss.
- WINDSTORM: Only atmosphere/sky will change. Do not promise debris or damage in the prompt.
- ADAPTATION: Rely on FICTION text to convey adaptation narrative. Image will show pleasant atmosphere only.

When generating the FICTION text, be specific and evocative to compensate for image limitations.
The FICTION does the heavy lifting for scenarios where visual transformation is limited.

## OUTPUT FORMAT (follow exactly)
IMG: [Your 40-word max FLUX Kontext prompt using CHANGE/ADD verbs. Focus on atmosphere and color changes. No line breaks.]

FICTION: [2-3 sentences. A mundane dispatch from this future—like local news or personal observation. Be specific to THIS design. Include a concrete detail: a date, temperature, regulation, or local reference. Written in present or past tense. Hyper-local if location is known. For limited-performance scenarios, the FICTION carries the narrative weight.]

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
      console.log('Expected performance:', SCENARIO_PERFORMANCE[scenario] || 'Unknown');
      console.log('Location:', location ? `${location.city}, ${location.country}` : 'Not detected');
      console.log('Prompt Word Count:', wordCount);
      console.log('Validation:', validation.valid ? '✓ Valid' : `✗ Issues: ${validation.issues.join(', ')}`);
      console.log('=======================');
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Analyze API error:', err);
    res.status(500).json({ error: "API request failed" });
  }
}
