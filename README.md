# Weekend AI — Local Setup Guide

## Requirements
- Mac with **Node.js** installed (free: https://nodejs.org → download LTS)
- A Google Gemini API key

## Setup (3 steps)

### Step 1 — Set your API key
Open Terminal and set the environment variable before running the server:
```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### Step 2 — Run the server
Open **Terminal** on your Mac, go to this folder:
```bash
cd ~/Downloads/weekend-ai
node server.js
```
You'll see:
```
✅  Weekend AI is running!
👉  Open: http://localhost:3000
```

### Step 3 — Open in browser
Go to: **http://localhost:3000**

---

## Features
- 🏠 **Home** — Popular destinations, traveler reviews
- ✨ **Plan Trip** — AI generates real day-by-day itinerary with cost estimate
- 🎫 **Book** — Hotel, bus, flight, tour package options
- 💬 **AI Chat** — Live chatbot (Bangla + English)

## Getting a FREE API key
1. Go to https://cloud.google.com/vertex-ai/docs/generative-ai/overview
2. Create or use an existing Google Cloud project
3. Enable the Generative AI API and create an API key
4. Set the key in your terminal with `export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"`

## Stop the server
Press **Ctrl + C** in Terminal.
