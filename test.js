const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Set it in your environment before running this script.");
  process.exit(1);
}

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-goog-api-key": GEMINI_API_KEY,
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Say hello" }] }]
  }),
})
.then(r => r.json())
.then(d => console.log("RESPONSE:", JSON.stringify(d, null, 2)))
.catch(e => console.log("ERROR:", e.message));