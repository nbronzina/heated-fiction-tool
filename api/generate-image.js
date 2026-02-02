export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY not set" });

  try {
    const { prompt, image_base64, media_type } = req.body;
    const dataUri = "data:" + (media_type || "image/jpeg") + ";base64," + image_base64;

    const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
      method: "POST",
      headers: {
        "Authorization": "Key " + FAL_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: dataUri,
        num_images: 1,
        output_format: "jpeg",
        guidance_scale: 4.0
      })
    });
    const data = await response.json();
    console.log("FAL Kontext status:", response.status);
    if (data.detail || data.error) {
      console.log("FAL error:", JSON.stringify(data));
      return res.status(400).json({ error: JSON.stringify(data.detail || data.error) });
    }
    res.status(200).json(data);
  } catch (err) {
    console.error("FAL error:", err);
    res.status(500).json({ error: err.message });
  }
}
