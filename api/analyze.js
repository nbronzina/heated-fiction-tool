// Detect media type from base64 header bytes
function getMediaTypeFromBase64(base64String) {
  if (base64String.startsWith('/9j/')) return 'image/jpeg';
  if (base64String.startsWith('iVBORw')) return 'image/png';
  if (base64String.startsWith('R0lGOD')) return 'image/gif';
  if (base64String.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // fallback
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not set" });

  const systemPrompt = `You are a climate foresight analyst examining a design render or visualization.

## Your task:
1. Identify what TYPE of design this is (building, product, interior, site, furniture, vehicle, etc.)
2. Identify the IMPLICIT ASSUMPTIONS it makes (stable climate, functioning infrastructure, predictable conditions)
3. Generate a FLUX Kontext image editing prompt that shows THIS SAME DESIGN under climate stress
4. Write a design fiction dispatch from that future

## FLUX Kontext syntax rules (CRITICAL):
- INSTRUCTIONAL ONLY: Start with "Add", "Change", "Make"
- NEVER use: "Imagine", "Create", "Transform this into", "A scene where"
- Describe ONLY what CHANGES, never describe what already exists in the image
- MUST end with: "Keep the exact same design, composition, camera angle, and framing."
- Maximum 40 words total
- No line breaks in the prompt

## Climate scenario effects:

### EXTREME HEAT 2040 (45°C heatwaves, water scarcity, UV damage)
- Materials: bleached, faded, cracked, warped
- Vegetation: CHANGE all grass, plants, and trees to dead, brown, dried, withered. No green vegetation should remain.
- Surfaces: dusty, heat-damaged
- Light: harsh yellow-orange, heat shimmer, haze
- Atmosphere: abandoned during peak heat, water infrastructure visible

### FLASH FLOOD 2030 (heavy rainfall, drainage failure)
IMPORTANT: Aim for realistic post-rain aesthetic, NOT dramatic disaster movie. Think "grey November Tuesday after heavy rain" - muted, wet, reflective surfaces, overcast sky.
- Sky: CHANGE to uniform grey overcast sky, no dramatic storm clouds
- Surfaces: CHANGE all pavement, concrete, roads to wet, dark, reflective black with puddles
- Atmosphere: Add slight mist or haze, reduce overall saturation, muted desaturated colors
- Water: Add clear puddles with reflections, standing water on flat surfaces (NOT brown mud)
- Vegetation: CHANGE grass and plants to wet, muddy, flattened. Bare wet branches. Dark green, not dead.
- Materials: Add water stains, wet marks on walls, darkened wet surfaces everywhere
- Overall mood: grey, damp, cold, desaturated - realistic and mundane, not apocalyptic
- DO NOT request water covering or submerging elements

### EXTREME WIND 2035 (140km/h sustained winds)
IMPORTANT: FLUX cannot bend trees or show motion. Focus on AFTERMATH and DAMAGE:
- Sky: dramatic dark storm clouds, greenish-yellow tint
- Add: fallen branches and debris scattered on ground
- Add: torn and damaged canopy fabric, loose materials flapping
- Add: overturned furniture, displaced objects, scattered planters
- Add: leaves and papers scattered everywhere
- Vegetation: CHANGE plants and flowers to stripped, broken, flattened, shredded. Bare branches, scattered petals.
- Surfaces: wet from rain, puddles forming
- Atmosphere: dark, dramatic, emergency lighting
- DO NOT request bending trees or motion blur

### COMPOUND CRISIS 2050 (25 years of adaptation, still functioning)
- Additions: solar panels, water tanks, collection systems
- Surfaces: 25 years of weathering, patina, informal repairs
- Vegetation: growing on/around structure, urban farming
- Light: warm dusty golden hour
- Atmosphere: resilient occupation, adapted use

## People modifications (if people are visible in the design):
- HEAT: Add sun hats, UV face shields, water bottles, light loose clothing, seeking shade
- FLOOD: Add rain boots, umbrellas, rolled-up pants, wading carefully, carrying belongings
- WIND: Add people bracing, holding onto hats, hair and clothing disheveled
- COMPOUND: Add face masks, adapted utilitarian clothing, carrying supplies

## Location-based predictions (if LOCATION CONTEXT is provided):
When location data is available, the FICTION should:
- Reference the specific city/region by name
- Include plausible local climate predictions (sea level rise for coastal cities, drought for Mediterranean, flooding for river cities, heat islands for dense urban areas)
- Mention local landmarks, infrastructure, or cultural elements when relevant
- Make the scenario feel grounded in that specific place, not generic

## Output format (follow exactly):
IMG: [Your 40-word max FLUX Kontext prompt, no line breaks]

FICTION: [2-3 sentences. A design fiction dispatch from this future. Be specific to THIS design. Include a concrete detail: a date, a regulation, a product recall, a news headline, a maintenance log entry. Write in past tense or present tense, not future tense. No generic climate statements.]`;

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

    // Inject system prompt into the request
    const requestBody = {
      ...req.body,
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
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "API request failed" });
  }
}
