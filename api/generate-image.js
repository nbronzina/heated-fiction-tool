export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY not set" });

  try {
    const { prompt, image_base64, media_type } = req.body;

    const dataUri = "data:" + (media_type || "image/jpeg") + ";base64," + image_base64;

    const response = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: dataUri,
        strength: 0.65,
        num_images: 1,
        image_size: "landscape_16_9",
        num_inference_steps: 28,
        guidance_scale: 3.5
      })
    });
    const data = await response.json();
    console.log("FAL status:", response.status);
    if (data.detail || data.error) {
      console.log("FAL error:", JSON.stringify(data));
      return res.status(400).json({ error: data.detail || data.error });
    }
    res.status(200).json(data);
  } catch (err) {
    console.error("FAL error:", err);
    res.status(500).json({ error: err.message });
  }
}
