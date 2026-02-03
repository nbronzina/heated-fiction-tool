// People elements for combinatorial variety (1000+ combinations per scenario)
const peopleElements = {
  heatwave: {
    headwear: [
      'wide-brimmed sun hat',
      'baseball cap',
      'light scarf over head',
      'UV-protective visor',
      'straw hat',
      'bucket hat'
    ],
    clothing: [
      'loose linen shirt',
      'light cotton dress',
      'sleeveless top',
      'UV-protective long sleeves',
      'light-colored loose clothing',
      'breathable athletic wear'
    ],
    accessories: [
      'carrying water bottle',
      'holding portable fan',
      'with sunglasses',
      'carrying iced drink',
      'with cooling towel around neck',
      'holding parasol for shade'
    ],
    posture: [
      'seeking shade under awning',
      'fanning themselves',
      'wiping forehead',
      'standing in shadow',
      'moving slowly',
      'pausing to rest'
    ]
  },

  flood: {
    footwear: [
      'rubber boots',
      'waterproof wellies',
      'rain galoshes',
      'wrapped plastic bags over shoes',
      'barefoot carrying shoes',
      'hiking boots'
    ],
    clothing: [
      'rain poncho',
      'waterproof jacket with hood up',
      'rolled-up trousers',
      'raincoat',
      'plastic rain cover',
      'hooded windbreaker'
    ],
    accessories: [
      'carrying umbrella',
      'holding bags above water',
      'with waterproof backpack',
      'carrying belongings overhead',
      'with plastic shopping bags',
      'holding phone in plastic bag'
    ],
    posture: [
      'stepping carefully around puddles',
      'wading through shallow water',
      'helping someone across',
      'looking down at footing',
      'jumping over puddle',
      'standing on raised surface'
    ]
  },

  windstorm: {
    headwear: [
      'holding onto hat',
      'hood blown back',
      'hair blown wildly',
      'scarf wrapped tight',
      'cap pulled low',
      'no hat, hair streaming'
    ],
    clothing: [
      'coat flapping open',
      'jacket zipped tight',
      'clothes pressed against body by wind',
      'scarf flying horizontally',
      'loose clothing billowing',
      'buttoned-up overcoat'
    ],
    accessories: [
      'gripping bag tightly',
      'papers flying from hand',
      'holding umbrella struggling',
      'clutching belongings',
      'bag pressed to chest',
      'nothing loose visible'
    ],
    posture: [
      'leaning into wind',
      'bracing against gust',
      'shielding face with arm',
      'turned sideways to wind',
      'hurrying with head down',
      'gripping railing for support'
    ]
  },

  adaptation: {
    activity: [
      'relaxing in outdoor seating',
      'reading at shaded table',
      'having coffee on terrace',
      'chatting with neighbors',
      'working on laptop outside',
      'enjoying a meal outdoors'
    ],
    children: [
      'children playing freely',
      'kids doing homework outside',
      'children on bikes',
      'kids running on grass',
      'children at play structure',
      'kids with water toys'
    ],
    social: [
      'neighbors gathered talking',
      'group sharing picnic',
      'friends at outdoor table',
      'family barbecuing',
      'community gardening together',
      'people exercising in group'
    ],
    comfort: [
      'looking relaxed and comfortable',
      'wearing light casual clothing',
      'enjoying shade of green infrastructure',
      'moving at leisure pace',
      'sitting contentedly',
      'smiling in conversation'
    ]
  }
};

// Build people instruction by combining 2-3 random elements
function buildPeopleInstruction(scenario) {
  const elements = peopleElements[scenario];
  if (!elements) return '';

  const categories = Object.keys(elements);

  // Select 2-3 categories randomly
  const numCategories = Math.random() > 0.5 ? 3 : 2;
  const shuffled = categories.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, numCategories);

  // Take one random element from each category
  const parts = selected.map(cat => {
    const options = elements[cat];
    return options[Math.floor(Math.random() * options.length)];
  });

  // Combine into natural sentence
  if (scenario === 'adaptation') {
    return `People appear ${parts.join(', ')}`;
  } else {
    return `People are ${parts.join(', ')}`;
  }
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

  // Build combinatorial people instruction (1000+ combinations)
  const peopleInstruction = buildPeopleInstruction(scenario);
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { scenario } = req.body;

  if (!scenario) {
    return res.status(400).json({ error: "Scenario is required" });
  }

  const validScenarios = ['heatwave', 'flood', 'windstorm', 'adaptation'];
  if (!validScenarios.includes(scenario)) {
    return res.status(400).json({ error: `Invalid scenario. Must be one of: ${validScenarios.join(', ')}` });
  }

  const promptData = buildGeminiPrompt(scenario);

  if (!promptData) {
    return res.status(500).json({ error: "Failed to build image prompt" });
  }

  console.log('=== BUILD IMAGE PROMPT ===');
  console.log('Scenario:', scenario);
  console.log('Intensity:', promptData.intensity);
  console.log('People:', promptData.peopleInstruction);
  console.log('Prompt preview:', promptData.prompt.substring(0, 150) + '...');
  console.log('==========================');

  return res.status(200).json({
    success: true,
    prompt: promptData.prompt,
    intensity: promptData.intensity,
    peopleInstruction: promptData.peopleInstruction
  });
}
