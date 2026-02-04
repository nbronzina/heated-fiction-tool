# Heated — Artefacts from the Near Future

A climate design fiction tool that transforms architectural renders and product designs into speculative visions of climate futures.

![Heated Studio](https://heated.studio/og-image.png)

## What it does

Upload your design render, choose a climate scenario, and see how your building, product, or space might look in a climate-altered future. The tool generates:

1. **Speculative Image** — AI-transformed version of your design under the selected climate scenario
2. **Design Fiction** — A short narrative dispatch from that possible future

### Climate Scenarios

- **Heatwave** (44°C) — Extended heat protocol with adjusted routines and shade-seeking
- **Flood** (80mm/6h) — Post-storm conditions with wet streets and drainage at capacity
- **Windstorm** (120km/h) — Storm aftermath with overcast skies and debris
- **Adaptation** (2032) — Climate-adapted design with green infrastructure

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS with html2canvas for share card generation
- **Backend**: Express.js + Vercel serverless functions
- **AI Models**:
  - Google Gemini 2.0 Flash (image generation)
  - Claude Sonnet 4.5 (fiction generation)

## Getting Started

### Prerequisites

- Node.js 18+
- API keys for:
  - [Google AI Studio](https://aistudio.google.com/apikey) (Gemini)
  - [Anthropic Console](https://console.anthropic.com/) (Claude)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/heated-fiction-tool.git
cd heated-fiction-tool

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your API keys to .env
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_AI_API_KEY=...

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Deployment

Deploy to Vercel:

```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Project Structure

```
heated-fiction-tool/
├── api/                    # Vercel serverless functions
│   ├── analyze.js          # Claude fiction generation
│   ├── build-image-prompt.js   # Prompt builder for image generation
│   ├── generate-image-gemini.js # Gemini image generation
│   └── generate-image.js   # Legacy FAL.ai integration
├── public/
│   └── index.html          # Main application (single-page)
├── server.js               # Express server for local development
├── vercel.json             # Vercel configuration
└── package.json
```

## Features

- **Image Compression** — Automatic client-side compression for faster uploads
- **EXIF Location** — Extracts GPS data from photos for location-aware fiction
- **Share Cards** — Generate branded cards with before/after comparison
- **Mobile Optimized** — Touch-friendly UI with safe-area support for notched devices
- **Accessibility** — Focus-visible states and proper touch targets (44px+)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for fiction generation |
| `GOOGLE_AI_API_KEY` | Gemini API key for image generation |

## License

MIT License — see [LICENSE](LICENSE) for details.

## About Heated Studio

[Heated Studio](https://heated.studio) creates artefacts from the near future—using design fiction and AI to help organizations make resilient decisions in an uncertain climate.

**Contact**: hello@heated.studio | Madrid, Spain
