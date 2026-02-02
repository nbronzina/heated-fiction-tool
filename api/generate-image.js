export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY not set" });

  try {
    const { prompt, image_base64, media_type } = req.body;

    // Convert base64 to a File/Blob for multipart upload
    const imageBuffer = Buffer.from(image_base64, "base64");
    const ext = media_type === "image/png" ? "png" : "jpeg";
    const blob = new Blob([imageBuffer], { type: media_type });

    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", blob, "image." + ext);
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", "1536x1024");
    formData.append("quality", "low");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY
      },
      body: formData
    });

    const data = await response.json();
    console.log("OpenAI status:", response.status);

    if (data.error) {
      console.log("OpenAI error:", JSON.stringify(data.error));
      return res.status(400).json({ error: data.error.message });
    }
    res.status(200).json(data);
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: err.message });
  }
}
