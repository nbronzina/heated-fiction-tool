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
- Vegetation: dead, brown, dried
- Surfaces: dusty, heat-damaged
- Light: harsh yellow-orange, heat shimmer, haze
- Atmosphere: abandoned during peak heat, water infrastructure visible

### FLASH FLOOD 2030 (300mm rainfall in 3 hours, drainage failure)
- Ground: brown muddy water 30-50cm deep
- Surfaces: wet, mud-stained, water damage marks at consistent height
- Sky: dark grey storm clouds
- Atmosphere: emergency conditions, floating debris

### EXTREME WIND 2035 (140km/h sustained winds, debris)
- Flexible elements: bent sharply to one side, torn, flapping
- Sky: dramatic dark storm clouds
- Add: flying debris, leaves, papers in motion
- Atmosphere: displaced objects, emergency conditions

### COMPOUND CRISIS 2050 (25 years of adaptation, still functioning)
- Additions: solar panels, water tanks, collection systems
- Surfaces: 25 years of weathering, patina, informal repairs
- Vegetation: growing on/around structure, urban farming
- Light: warm dusty golden hour
- Atmosphere: resilient occupation, adapted use

## Output format (follow exactly):
IMG: [Your 40-word max FLUX Kontext prompt, no line breaks]

FICTION: [2-3 sentences. A design fiction dispatch from this future. Be specific to THIS design. Include a concrete detail: a date, a regulation, a product recall, a news headline, a maintenance log entry. Write in past tense or present tense, not future tense. No generic climate statements.]`;

  try {
    // Inject system prompt into the request
    const requestBody = {
      ...req.body,
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
