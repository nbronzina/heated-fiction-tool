// Simple rate limiting (resets on cold start)
const rateLimit = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];
  const recent = userRequests.filter(time => now - time < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY not set" });

  try {
    const { prompt, image_base64, media_type, width, height } = req.body;
    const dataUri = "data:" + (media_type || "image/jpeg") + ";base64," + image_base64;

    // Calculate dimensions maintaining aspect ratio
    // FAL accepts max ~1440px, min ~256px
    const maxSize = 1440;
    const minSize = 256;
    let finalWidth, finalHeight;

    if (width && height) {
      const aspectRatio = width / height;

      if (width >= height) {
        // Horizontal or square
        finalWidth = Math.min(Math.max(width, minSize), maxSize);
        finalHeight = Math.round(finalWidth / aspectRatio);
      } else {
        // Vertical
        finalHeight = Math.min(Math.max(height, minSize), maxSize);
        finalWidth = Math.round(finalHeight * aspectRatio);
      }

      // Ensure multiples of 8 (required by some models)
      finalWidth = Math.round(finalWidth / 8) * 8;
      finalHeight = Math.round(finalHeight / 8) * 8;

      // Ensure minimum size after rounding
      finalWidth = Math.max(finalWidth, minSize);
      finalHeight = Math.max(finalHeight, minSize);

      console.log("Original:", width, "x", height, "-> Final:", finalWidth, "x", finalHeight);
    } else {
      // Fallback if no dimensions provided
      finalWidth = 1024;
      finalHeight = 1024;
      console.log("No dimensions provided, using fallback:", finalWidth, "x", finalHeight);
    }

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
        guidance_scale: 4.5,
        image_size: {
          width: finalWidth,
          height: finalHeight
        }
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
