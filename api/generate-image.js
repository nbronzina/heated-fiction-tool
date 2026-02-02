export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY not set" });

  try {
    const { prompt, image_url } = req.body;

    const response = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: image_url,
        strength: 0.75,
        num_images: 1,
        image_size: "landscape_16_9",
        num_inference_steps: 28,
        guidance_scale: 3.5
      })
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
