const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-mini";
const GEMINI_MODEL_LIST = process.env.GEMINI_MODEL_LIST
  ? process.env.GEMINI_MODEL_LIST.split(",").map(m => m.trim()).filter(Boolean)
  : [GEMINI_MODEL, "gemini-1.0", "gemini-flash-latest"];
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function initDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS travel_plans (
        id SERIAL PRIMARY KEY,
        origin TEXT,
        destination TEXT,
        budget INT,
        days INT,
        style TEXT,
        plan_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        travel_style TEXT,
        role TEXT DEFAULT 'customer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        booking_ref TEXT UNIQUE,
        user_id TEXT,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        destination TEXT,
        origin TEXT,
        trip_title TEXT,
        travelers INT,
        budget INT,
        days INT,
        style TEXT,
        travel_date DATE,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'confirmed',
        plan_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_date DATE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id TEXT,
        trip_id TEXT,
        booking_ref TEXT,
        customer_name TEXT,
        destination TEXT,
        rating INT,
        review_text TEXT,
        review_date TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'published'
      )
    `);

    const adminEmail = process.env.ADMIN_EMAIL || 'galib@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '125679@@';
    const existingAdmin = await db.query(`SELECT * FROM users WHERE email = $1`, [adminEmail]);
    if (existingAdmin.rowCount === 0) {
      const adminId = `admin_${Date.now()}`;
      await db.query(
        `INSERT INTO users (user_id, full_name, email, phone, password, travel_style, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'Weekend AI Admin', adminEmail, '', hashPassword(adminPassword), 'Admin', 'admin']
      );
      console.log(`→ Admin account created: ${adminEmail}`);
    }

    console.log("→ Database initialized.");
  } catch (err) {
    console.log("→ Database init skipped:", err.message);
  }
}

async function saveTravelPlan(request, plan) {

  try {
    const payload = {
      origin: request?.origin || "Dhaka",
      destination: request?.destination || "Cox's Bazar",
      budget: Number(request?.budget || 8000),
      days: Number(request?.duration || 3),
      style: request?.style || "Adventure",
      plan
    };

    await db.query(
      `INSERT INTO travel_plans (origin, destination, budget, days, style, plan_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [payload.origin, payload.destination, payload.budget, payload.days, payload.style, JSON.stringify(payload)]
    );
  } catch (err) {
    console.log("→ Failed to save travel plan:", err.message);
  }
}

function extractTravelRequest(contents, overrides = {}) {
  const raw = contents?.length ? contents[contents.length - 1]?.parts?.[0]?.text || "" : "";
  const text = raw.replace(/\s+/g, " ");
  const originMatch = text.match(/from\s+([A-Za-z\u0980-\u09FF'’\s]+?)\s+(?:to|for|with|under|budget)/i);
  // Accept punctuation after a place name: the planner message says
  // "to Sylhet. Budget is ...", which the old expression failed to parse.
  const destMatch = text.match(/\bto\s+(.+?)(?=[,.!?]?\s+(?:for|from|on|under|budget|trip duration|travel style|include)\b|[.!?]?$)/i);
  const budgetMatch = text.match(/(?:৳|BDT|Tk|taka)?\s*([0-9,]{3,})/i);
  const durationMatch = text.match(/(\d+)\s*(?:days?|day|nights?|night)/i);
  const travelersMatch = text.match(/(1 person|2 people|3–5 people|3-5 people|family(?: of \d+)?|couple|solo|group)/i);
  const styleMatch = text.match(/(budget-friendly|family|romantic|nature|wildlife|cultural|adventure|luxury|relaxation|budget)/i);

  return {
    raw,
    origin: String(overrides.origin || originMatch?.[1]?.trim() || "Dhaka").trim(),
    destination: String(overrides.destination || destMatch?.[1]?.trim().replace(/[,.!?]+$/, "") || "Cox's Bazar").trim(),
    budget: String(overrides.budget || (budgetMatch ? budgetMatch[1].replace(/,/g, "") : "8000")),
    duration: Number(overrides.duration || durationMatch?.[1] || 2),
    travelers: String(overrides.travelers || travelersMatch?.[1] || "2 people"),
    style: String(overrides.style || styleMatch?.[1] || "Budget-friendly adventure"),
  };
}

function normalizeStructuredPlan(rawText, fallbackPlan) {
  if (!rawText) return fallbackPlan;

  const cleaned = String(rawText).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    // Fall back to the offline structured itinerary.
  }

  return fallbackPlan;
}

// These profiles make the offline planner useful even when a Gemini key is not
// configured.  The final generic profile still uses the place the visitor typed,
// so an unfamiliar Bangladesh destination is never replaced with Cox's Bazar.
const DESTINATION_PROFILES = [
  { keys: ["cox", "কক্স"], hotel: "Hotel Sea Pearl", area: "Laboni Beach", attraction: "Laboni Beach", activity: "Beach walk and sunset view", transport: "AC Bus", provider: "Green Line Paribahan", transportCost: 1400, hotelRate: 2000, food: 500, entryFee: 0 },
  { keys: ["sylhet", "সিলেট"], hotel: "Hotel Noorjahan Grand", area: "Zindabazar", attraction: "Ratargul Swamp Forest", activity: "Boat ride and nature tour", transport: "AC Bus", provider: "Shyamoli Paribahan", transportCost: 1350, hotelRate: 1800, food: 500, entryFee: 200 },
  { keys: ["bandarban", "বান্দরবান"], hotel: "Meghla Tourist Complex", area: "Meghla", attraction: "Nilgiri Hills", activity: "Hill-view drive and short trek", transport: "Bus + Jeep", provider: "S Alam Service", transportCost: 1500, hotelRate: 1800, food: 450, entryFee: 100 },
  { keys: ["rangamati", "রাঙ্গামাটি"], hotel: "Hotel Sufia", area: "Reserve Bazar", attraction: "Kaptai Lake", activity: "Boat ride on Kaptai Lake", transport: "Bus", provider: "Hanif Enterprise", transportCost: 1300, hotelRate: 1600, food: 450, entryFee: 150 },
  { keys: ["khagrachari", "খাগড়াছড়ি"], hotel: "Hotel Jatramon", area: "Shapla Chattar", attraction: "Alutila Cave", activity: "Cave visit and hill walk", transport: "Bus + CNG", provider: "Shanti Paribahan", transportCost: 1350, hotelRate: 1500, food: 400, entryFee: 100 },
  { keys: ["sajek", "সাজেক"], hotel: "Meghpunji Resort", area: "Ruilui Para", attraction: "Sajek Valley", activity: "Cloud viewing and village walk", transport: "Bus + Chander Gari", provider: "Khagrachari local transport", transportCost: 1800, hotelRate: 2200, food: 500, entryFee: 0 },
  { keys: ["sreemangal", "srimangal", "শ্রীমঙ্গল"], hotel: "Grand Sultan Tea Resort", area: "Sreemangal", attraction: "Lawachara National Park", activity: "Tea-garden and forest walk", transport: "Train", provider: "Bangladesh Railway", transportCost: 900, hotelRate: 1800, food: 450, entryFee: 50 },
  { keys: ["sundarban", "সুন্দরবন"], hotel: "Mongla River View", area: "Mongla", attraction: "Sundarbans Mangrove Forest", activity: "Launch safari and wildlife watching", transport: "Bus + Launch", provider: "Khulna launch service", transportCost: 1700, hotelRate: 1700, food: 500, entryFee: 300 },
  { keys: ["kuakata", "কুয়াকাটা", "কুয়াকাটা"], hotel: "Kuakata Grand Hotel", area: "Sea Beach Road", attraction: "Kuakata Sea Beach", activity: "Sunrise and sunset beach visit", transport: "Bus", provider: "Sakura Paribahan", transportCost: 1500, hotelRate: 1700, food: 450, entryFee: 0 },
  { keys: ["saint martin", "st martin", "সেন্ট মার্টিন"], hotel: "Blue Marine Resort", area: "West Beach", attraction: "Saint Martin's Coral Island", activity: "Coral beach walk and sunset", transport: "Bus + Ship", provider: "Teknaf ship service", transportCost: 2300, hotelRate: 2200, food: 600, entryFee: 0 },
  { keys: ["rajshahi", "রাজশাহী"], hotel: "Hotel Star International", area: "Shaheb Bazar", attraction: "Padma River Bank", activity: "Riverbank sunset and heritage walk", transport: "Train", provider: "Bangladesh Railway", transportCost: 800, hotelRate: 1500, food: 400, entryFee: 0 },
  { keys: ["paharpur", "পাহাড়পুর", "পাহাড়পুর"], hotel: "Naogaon Guest House", area: "Naogaon", attraction: "Somapura Mahavihara", activity: "UNESCO heritage-site visit", transport: "Bus", provider: "National Travels", transportCost: 900, hotelRate: 1400, food: 400, entryFee: 100 },
  { keys: ["bogura", "bogra", "বগুড়া", "বগুড়া"], hotel: "Hotel Naz Garden", area: "Bogura Sadar", attraction: "Mahasthangarh", activity: "Ancient-city and museum visit", transport: "Bus", provider: "Shyamoli Paribahan", transportCost: 750, hotelRate: 1500, food: 400, entryFee: 100 },
  { keys: ["bagerhat", "বাগেরহাট"], hotel: "Bagerhat Tourist Lodge", area: "Bagerhat Sadar", attraction: "Sixty Dome Mosque", activity: "Mosque city heritage tour", transport: "Bus", provider: "Sohag Paribahan", transportCost: 1000, hotelRate: 1400, food: 400, entryFee: 50 },
  { keys: ["sonargaon", "সোনারগাঁও"], hotel: "Panam Resort", area: "Sonargaon", attraction: "Panam City", activity: "Folk-art museum and heritage walk", transport: "Bus", provider: "Local bus service", transportCost: 250, hotelRate: 1400, food: 400, entryFee: 100 },
  { keys: ["chattogram", "chittagong", "চট্টগ্রাম"], hotel: "Hotel Agrabad", area: "Agrabad", attraction: "Patenga Sea Beach", activity: "Beach sunset and city sightseeing", transport: "Train", provider: "Bangladesh Railway", transportCost: 1100, hotelRate: 1700, food: 500, entryFee: 0 },
  { keys: ["cumilla", "comilla", "কুমিল্লা"], hotel: "Nawab Faizunnessa Hotel", area: "Cumilla Sadar", attraction: "Mainamati Buddhist Ruins", activity: "Archaeological-site tour", transport: "Bus", provider: "Tisha Transport", transportCost: 400, hotelRate: 1300, food: 400, entryFee: 50 },
  { keys: ["jaflong", "জাফলং"], hotel: "Jaflong Inn", area: "Jaflong", attraction: "Jaflong Stone Collection Area", activity: "River, hills, and tea-garden sightseeing", transport: "Bus + CNG", provider: "Sylhet local transport", transportCost: 1300, hotelRate: 1600, food: 450, entryFee: 0 },
  { keys: ["bichanakandi", "bisnakandi", "বিছনাকান্দি"], hotel: "Sylhet Guest House", area: "Sylhet city", attraction: "Bichanakandi", activity: "Stone-bed river and mountain-view tour", transport: "Bus + CNG", provider: "Sylhet local transport", transportCost: 1350, hotelRate: 1600, food: 450, entryFee: 0 },
  { keys: ["tanguar", "টাঙ্গুয়ার", "টাঙ্গুয়ার"], hotel: "Sunamganj Guest House", area: "Sunamganj", attraction: "Tanguar Haor", activity: "Haor boat tour and bird watching", transport: "Bus + Boat", provider: "Sunamganj boat service", transportCost: 1400, hotelRate: 1500, food: 450, entryFee: 100 },
  { keys: ["barishal", "barisal", "বরিশাল"], hotel: "Hotel Grand Park", area: "Barishal Sadar", attraction: "Floating Guava Market", activity: "River cruise and floating-market visit", transport: "Launch", provider: "Dhaka-Barishal launch service", transportCost: 1000, hotelRate: 1500, food: 450, entryFee: 0 },
  { keys: ["bhola", "ভোলা"], hotel: "Bhola Hotel", area: "Bhola Sadar", attraction: "Char Kukri-Mukri", activity: "Island nature and wildlife tour", transport: "Launch + Boat", provider: "Bhola launch service", transportCost: 1400, hotelRate: 1400, food: 400, entryFee: 100 },
  { keys: ["nijhum", "নিঝুম"], hotel: "Hatiya Guest House", area: "Hatiya", attraction: "Nijhum Dwip", activity: "Island walk and deer watching", transport: "Launch + Boat", provider: "Noakhali boat service", transportCost: 1500, hotelRate: 1400, food: 400, entryFee: 100 },
  { keys: ["teknaf", "টেকনাফ"], hotel: "Teknaf Resort", area: "Teknaf", attraction: "Naf River", activity: "River-view and coastal sightseeing", transport: "Bus", provider: "Cox's Bazar bus service", transportCost: 1500, hotelRate: 1500, food: 450, entryFee: 0 },
  { keys: ["maheshkhali", "মহেশখালী", "মহেশখালি"], hotel: "Cox's Bazar Guest House", area: "Cox's Bazar", attraction: "Adinath Temple", activity: "Island boat ride and temple visit", transport: "Bus + Boat", provider: "Maheshkhali boat service", transportCost: 1500, hotelRate: 1600, food: 450, entryFee: 50 },
  { keys: ["sitakunda", "সীতাকুণ্ড", "সীতাকুন্ড"], hotel: "Sitakunda Eco Resort", area: "Sitakunda", attraction: "Chandranath Hill", activity: "Waterfall and hill trek", transport: "Bus", provider: "Chattogram local service", transportCost: 900, hotelRate: 1500, food: 450, entryFee: 50 },
  { keys: ["kaptai", "কাপ্তাই"], hotel: "Kaptai Lake Resort", area: "Kaptai", attraction: "Kaptai Lake", activity: "Lake cruise and hill sightseeing", transport: "Bus + Boat", provider: "Rangamati local service", transportCost: 1300, hotelRate: 1700, food: 450, entryFee: 100 },
  { keys: ["mymensingh", "ময়মনসিংহ", "ময়মনসিংহ"], hotel: "Mymensingh Tourist Lodge", area: "Mymensingh Sadar", attraction: "Shilpacharya Zainul Folk Art Museum", activity: "Museum and Brahmaputra riverfront visit", transport: "Train", provider: "Bangladesh Railway", transportCost: 500, hotelRate: 1400, food: 400, entryFee: 50 },
  { keys: ["netrokona", "নেত্রকোনা"], hotel: "Netrokona Guest House", area: "Netrokona", attraction: "Birishiri", activity: "China clay hills and Someshwari River tour", transport: "Bus", provider: "Mymensingh local service", transportCost: 650, hotelRate: 1300, food: 400, entryFee: 50 },
  { keys: ["dinajpur", "দিনাজপুর"], hotel: "Dinajpur Hotel", area: "Dinajpur Sadar", attraction: "Kantajew Temple", activity: "Terracotta temple and heritage tour", transport: "Train", provider: "Bangladesh Railway", transportCost: 900, hotelRate: 1400, food: 400, entryFee: 50 },
  { keys: ["panchagarh", "পঞ্চগড়", "পঞ্চগড়"], hotel: "Panchagarh Guest House", area: "Tetulia", attraction: "Banglabandha and Kangchenjunga viewpoint", activity: "Tea garden and mountain-view tour", transport: "Bus", provider: "North Bengal service", transportCost: 1100, hotelRate: 1300, food: 400, entryFee: 0 },
  { keys: ["rangpur", "রংপুর"], hotel: "Rangpur Hotel", area: "Rangpur Sadar", attraction: "Tajhat Palace", activity: "Palace and city heritage tour", transport: "Bus", provider: "North Bengal service", transportCost: 900, hotelRate: 1400, food: 400, entryFee: 50 },
  { keys: ["lalmonirhat", "লালমনিরহাট"], hotel: "Lalmonirhat Guest House", area: "Lalmonirhat", attraction: "Kakina Zamindar Bari", activity: "Heritage and rural landscape visit", transport: "Train", provider: "Bangladesh Railway", transportCost: 900, hotelRate: 1300, food: 400, entryFee: 50 },
  { keys: ["khulna", "খুলনা"], hotel: "Hotel Castle Salam", area: "Khulna city", attraction: "Khan Jahan Ali Bridge", activity: "Riverfront and local heritage tour", transport: "Train", provider: "Bangladesh Railway", transportCost: 900, hotelRate: 1500, food: 450, entryFee: 0 },
  { keys: ["kushtia", "কুষ্টিয়া", "কুষ্টিয়া"], hotel: "Kushtia Guest House", area: "Kushtia Sadar", attraction: "Lalon Shah's Shrine", activity: "Baul culture and shrine visit", transport: "Bus", provider: "Kushtia service", transportCost: 750, hotelRate: 1300, food: 400, entryFee: 0 },
  { keys: ["jashore", "jessore", "যশোর"], hotel: "Jashore Hotel", area: "Jashore Sadar", attraction: "Michael Madhusudan Dutt Museum", activity: "Literary heritage tour", transport: "Bus", provider: "Sohag Paribahan", transportCost: 700, hotelRate: 1300, food: 400, entryFee: 50 },
  { keys: ["natore", "নাটোর"], hotel: "Natore Guest House", area: "Natore Sadar", attraction: "Natore Rajbari", activity: "Royal palace and heritage walk", transport: "Bus", provider: "Rajshahi service", transportCost: 700, hotelRate: 1300, food: 400, entryFee: 50 },
  { keys: ["pabna", "পাবনা"], hotel: "Pabna Hotel", area: "Pabna Sadar", attraction: "Hardinge Bridge", activity: "River and historic bridge visit", transport: "Train", provider: "Bangladesh Railway", transportCost: 650, hotelRate: 1300, food: 400, entryFee: 0 }
];

function getDestinationProfile(destination) {
  const normalized = String(destination || "").toLowerCase();
  const matched = DESTINATION_PROFILES.find((profile) => profile.keys.some((key) => normalized.includes(key)));
  return matched || {
    hotel: `${destination} Tourist Lodge`, area: `${destination} town center`, attraction: `${destination} local attractions`,
    activity: `Sightseeing and local cultural exploration in ${destination}`, transport: "Intercity Bus", provider: "Bangladesh intercity service",
    transportCost: 1000, hotelRate: 1600, food: 450, entryFee: 100
  };
}

const CHATBOT_SYSTEM_PROMPT = "You are Weekend AI, a warm and knowledgeable travel assistant for Bangladesh tourism. Answer in 2-4 friendly, conversational sentences, use at most one emoji, and when it fits naturally, invite the traveler to try the AI Planner tab for a full day-by-day itinerary. Only discuss travel within Bangladesh.";

function getOfflineChatReply(message) {
  const text = String(message || "").toLowerCase().trim();

  if (!text) {
    return "I'm here whenever you're ready — ask me about destinations, hotels, transport, or budgets anywhere in Bangladesh! 🌍";
  }

  if (/^(hi|hello|hey|salam|assalamu alaikum|good morning|good afternoon|good evening)\b/.test(text)) {
    return "👋 Hello there! I'm Weekend AI — I can help you pick a destination, plan a budget, or find hotels and transport across Bangladesh. What are you in the mood for?";
  }

  if (/thank/.test(text)) {
    return "You're very welcome! 😊 Let me know if you'd like a full day-by-day plan — just head to the ✨ AI Planner tab.";
  }

  if (/\b(bye|goodbye|see you|talk later)\b/.test(text)) {
    return "Safe travels, and have an amazing trip! 👋 Come back anytime you need more travel ideas.";
  }

  if (/how are you/.test(text)) {
    return "I'm doing great and ready to help you plan your next getaway! What destination are you thinking about?";
  }

  if (/(help|what can you do|features|capab)/.test(text)) {
    return "I can suggest destinations, estimate budgets, recommend hotels and transport, and answer questions about weather or the best time to visit. For a full itinerary with costs, try the ✨ AI Planner tab!";
  }

  if (/\bbook(ing)?\b|reservation|reserve/.test(text)) {
    return "To book a trip, generate a plan in the ✨ AI Planner tab, then tap 'Book This Trip' — I'll guide you through confirming your details. 🎫";
  }

  const destinationMatch = DESTINATION_PROFILES.find((profile) => profile.keys.some((key) => text.includes(key)));
  if (destinationMatch) {
    return `${destinationMatch.attraction} is a wonderful pick! A popular activity there is ${destinationMatch.activity.toLowerCase()}. A comfortable stay is around ${destinationMatch.hotel} near ${destinationMatch.area}, with typical hotel rates from ৳${destinationMatch.hotelRate}/night. Want a full budget breakdown? Try the AI Planner! ✨`;
  }

  if (/budget|cheap|cost|price|koto taka|\bkoto\b/.test(text)) {
    return "A budget-friendly weekend trip in Bangladesh usually runs ৳4,000–৳9,000 per person, covering transport, a 2-night stay, meals, and one or two activities. Tell me your destination and I can estimate it more precisely — or use the AI Planner for an exact breakdown!";
  }

  if (/hotel|resort|stay|accommodation/.test(text)) {
    return "Bangladesh has everything from budget guesthouses to beachfront resorts. Popular picks include Cox's Bazar's Hotel Sea Pearl, Sreemangal's Grand Sultan Tea Resort, and Sajek's Meghpunji Resort. Tell me your destination for a specific recommendation!";
  }

  if (/\bbus\b|\btrain\b|\bflight\b|transport|how (do i|to) (go|reach|get)/.test(text)) {
    return "Most domestic trips are easiest by AC bus (Green Line, Shyamoli, Hanif) or Bangladesh Railway for routes like Dhaka–Sylhet or Dhaka–Rajshahi. A few coastal spots also need a short boat or launch ride. Where are you headed?";
  }

  if (/weather|season|best time|monsoon|winter|\brain\b/.test(text)) {
    return "November to February (winter) is the most popular season for most of Bangladesh — cool, dry, and great for beaches and hill areas. Tea gardens and waterfalls look their best just after the monsoon, around September–October.";
  }

  if (/food|\beat\b|restaurant|cuisine|dish/.test(text)) {
    return "Bangladeshi travel food is a highlight — try fresh seafood in Cox's Bazar, Sylheti shatkora beef in Sylhet, and local street food like fuchka and pitha almost anywhere. Want restaurant picks for a specific destination?";
  }

  if (/\bsafe\b|safety|security/.test(text)) {
    return "Bangladesh is generally safe for travelers, especially in popular tourist areas. As always, keep valuables secure, use registered transport and hotels, and check local conditions before visiting remote hill or border regions.";
  }

  return "I can help you with destinations, hotels, transport, budgets, food, and the best time to travel in Bangladesh — what would you like to know? Or head to the ✨ AI Planner tab for a full itinerary!";
}

function generateOfflinePlan(contents, overrides = {}) {
  const req = extractTravelRequest(contents, overrides);
  const dest = req.destination;
  const budget = Number(req.budget.replace(/,/g, "")) || 8000;
  const duration = Number(req.duration) || 2;
  const nights = Math.max(1, duration - 1);
  const peopleCount = /1 person|solo/i.test(req.travelers) ? 1 : /2 people/i.test(req.travelers) ? 2 : /3–5|3-5/i.test(req.travelers) ? 4 : 6;

  const profile = getDestinationProfile(dest);
  const transportCost = budget <= 6000 ? Math.max(250, Math.round(profile.transportCost * 0.85)) : profile.transportCost;
  const hotelRate = budget <= 6000 ? Math.round(profile.hotelRate * 0.85) : profile.hotelRate;
  const foodPerDay = budget <= 6000 ? Math.round(profile.food * 0.9) : profile.food;
  const activityCost = 500 + Math.max(0, duration - 2) * 100;
  const localTransportCost = 300 + Math.max(0, duration - 2) * 100;
  const hotelTotal = hotelRate * nights;
  const mealTotal = foodPerDay * duration;
  const transportTotal = transportCost * (duration > 1 ? 2 : 1);
  const extraCost = Math.max(200, Math.round(budget * 0.05));

  const dailyCosts = Array.from({ length: duration }, (_, index) => {
    const dayNumber = index + 1;
    const hotelForDay = dayNumber <= nights ? hotelRate : 0;
    const foodForDay = foodPerDay;
    const activityForDay = dayNumber === duration ? Math.round(activityCost / 2) : Math.round(activityCost / 2);
    const otherForDay = dayNumber === 1 ? Math.round(extraCost / 2) : dayNumber === 2 ? Math.round(extraCost / 3) : Math.round(extraCost / 4);
    const totalForDay = (dayNumber === 1 ? transportCost : 0) + hotelForDay + foodForDay + activityForDay + otherForDay;

    return {
      day: `Day ${dayNumber}`,
      transport: dayNumber === 1 ? transportCost : 0,
      hotel: hotelForDay,
      food: foodForDay,
      activities: activityForDay,
      other: otherForDay,
      total: totalForDay
    };
  });

  const structuredPlan = {
    tripTitle: `${req.origin} → ${req.destination} Travel Plan`,
    overview: {
      origin: req.origin,
      destination: req.destination,
      budget: Number(req.budget.replace(/,/g, "")) || 8000,
      days: duration,
      style: req.style
    },
    journey: [
      {
        from: req.origin,
        to: req.destination,
        mode: "Road",
        transport: profile.transport,
        provider: profile.provider,
        departureTime: "10:30 PM",
        arrivalTime: "05:30 AM",
        duration: "7 hours",
        cost: transportCost,
        details: `Comfortable ${profile.transport.toLowerCase()} ride to ${req.destination}`
      },
      ...(duration > 1 ? [{
        from: req.destination,
        to: req.origin,
        mode: "Road",
        transport: "Return Bus",
        provider: profile.provider,
        departureTime: "08:00 PM",
        arrivalTime: "03:00 AM",
        duration: "7 hours",
        cost: transportCost,
        details: `Return journey back to ${req.origin}`
      }] : [])
    ],
    accommodation: [{
      hotelName: profile.hotel,
      location: profile.area,
      roomType: "Deluxe AC",
      nights,
      costPerNight: hotelRate,
      totalCost: hotelTotal
    }],
    foodPlan: [
      {
        meal: "Breakfast",
        restaurant: `${dest} Breakfast Cafe`,
        foodItems: "Paratha, Egg, Tea",
        cost: Math.round(foodPerDay / 3)
      },
      {
        meal: "Lunch",
        restaurant: `${dest} Local Restaurant`,
        foodItems: "Rice, local curry, drink",
        cost: Math.round(foodPerDay / 3)
      },
      {
        meal: "Dinner",
        restaurant: `${dest} Evening Kitchen`,
        foodItems: "Local dinner, salad, tea",
        cost: Math.round(foodPerDay / 3)
      }
    ],
    activities: [{
      place: profile.attraction,
      transport: "CNG + Walk",
      details: profile.activity,
      entryFee: profile.entryFee,
      localTransportCost
    }],
    dailyCosts,
    summary: {
      transport: transportTotal,
      hotels: hotelTotal,
      food: mealTotal,
      activities: activityCost,
      extra: extraCost,
      grandTotal: transportTotal + hotelTotal + mealTotal + activityCost + extraCost
    }
  };

  const text = `Weekend AI travel itinerary\n\nRoute: ${req.origin} → ${req.destination}\nBudget: ৳${req.budget}\nStyle: ${req.style}\nDuration: ${duration} days\n\nThis itinerary includes transportation, hotel, meals, activities, daily costs, and a full trip summary.`;

  return {
    text,
    content: [{ type: "text", text }],
    fallback: true,
    structuredPlan
  };
}

async function fetchWithRetries(url, options, retries = 0, timeoutMs = 8000) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const signal = controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timer);
      if (response.ok) return response;

      if ([429, 503].includes(response.status) && attempt < retries) {
        const wait = 1000 * (attempt + 1);
        console.log(`→ Gemini busy or rate limited, retrying after ${wait}ms (attempt ${attempt + 1})`);
        await sleep(wait);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        const wait = 1000 * (attempt + 1);
        console.log(`→ Network timeout or error, retrying after ${wait}ms (attempt ${attempt + 1})`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function callGeminiWithFallback(options) {
  let lastResponse = null;
  let lastData = null;

  for (const model of GEMINI_MODEL_LIST) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    console.log(`→ Trying Gemini model ${model}...`);
    try {
      const response = await fetchWithRetries(url, options, 0, 10000);
      const data = await response.json();
      lastResponse = response;
      lastData = data;

      if (response.ok) {
        return { response, data, model };
      }

      const status = response.status;
      const isTransient = status === 503 || status === 429;
      const message = data?.error?.message || '';
      if (isTransient && model !== GEMINI_MODEL_LIST[GEMINI_MODEL_LIST.length - 1]) {
        console.log(`→ Model ${model} unavailable: ${message}. Trying next model.`);
        continue;
      }
      return { response, data, model };
    } catch (err) {
      console.log(`→ Model ${model} failed: ${err.message}`);
      lastData = { error: { message: err.message } };
      lastResponse = null;
      // If this is the last model, fail through.
      if (model === GEMINI_MODEL_LIST[GEMINI_MODEL_LIST.length - 1]) {
        throw err;
      }
    }
  }

  return { response: lastResponse, data: lastData, model: GEMINI_MODEL_LIST[GEMINI_MODEL_LIST.length - 1] };
}

initDatabase();

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/api/trips") {
    try {
      const result = await db.query(
        `SELECT id, origin, destination, budget, days, style, plan_json, created_at
         FROM travel_plans
         ORDER BY created_at DESC
         LIMIT 10`
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ trips: result.rows }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/bookings/count")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const destination = String(parsedUrl.searchParams.get("destination") || "").trim();
      if (!destination) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "destination is required" }));
        return;
      }
      const result = await db.query(`SELECT * FROM bookings ORDER BY created_at DESC`);
      const bookings = result.rows || [];
      const count = bookings.filter((b) => String(b.destination || "").toLowerCase() === destination.toLowerCase() && ["confirmed", "completed"].includes(String(b.status || "").toLowerCase())).length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ count }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/reviews")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const destination = String(parsedUrl.searchParams.get("destination") || "").trim().toLowerCase();
      const bookingId = Number(parsedUrl.searchParams.get("booking_id") || 0);
      const userId = String(parsedUrl.searchParams.get("user_id") || "").trim();
      const result = await db.query(`SELECT * FROM reviews ORDER BY review_date DESC LIMIT 20`);
      let rows = result.rows || [];
      if (bookingId) {
        rows = rows.filter((review) => Number(review.booking_id) === bookingId);
      }
      if (userId) {
        rows = rows.filter((review) => String(review.user_id || "") === userId);
      }
      if (destination) {
        rows = rows.filter((review) => String(review.destination || "").toLowerCase() === destination);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reviews: rows }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/reviews") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const bookingId = Number(payload.booking_id || 0);
      const userId = String(payload.user_id || "").trim();
      const bookingRef = String(payload.booking_ref || "").trim();
      const customerName = String(payload.customer_name || "").trim();
      const destination = String(payload.destination || "").trim();
      const rating = Number(payload.rating || 0);
      const reviewText = String(payload.review_text || "").trim();
      const reviewDate = String(payload.review_date || new Date().toISOString()).trim();

      if (!bookingId || !userId || !bookingRef || !customerName || !destination || !rating) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Booking, traveler name, destination, and rating are required." }));
        return;
      }

      const bookingResult = await db.query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
      const booking = bookingResult.rows[0];
      if (!booking || !["confirmed", "completed"].includes(String(booking.status || "").toLowerCase())) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Review can only be submitted for confirmed or completed bookings." }));
        return;
      }

      await db.query(
        `INSERT INTO reviews (booking_id, user_id, trip_id, booking_ref, customer_name, destination, rating, review_text, review_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [bookingId, userId, payload.trip_id || null, bookingRef, customerName, destination, rating, reviewText, reviewDate, "published"]
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Review submitted successfully." }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/bookings")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const adminUserId = String(parsedUrl.searchParams.get("user_id") || "").trim();
      if (!adminUserId) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Admin user_id is required." }));
        return;
      }
      const adminCheck = await db.query(`SELECT * FROM users WHERE user_id = $1`, [adminUserId]);
      if (!adminCheck.rows[0] || adminCheck.rows[0].role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Admin access required." }));
        return;
      }

      const search = String(parsedUrl.searchParams.get("search") || "").trim().toLowerCase();
      const destination = String(parsedUrl.searchParams.get("destination") || "").trim().toLowerCase();
      const bookingStatus = String(parsedUrl.searchParams.get("status") || "").trim().toLowerCase();
      const paymentStatus = String(parsedUrl.searchParams.get("payment_status") || "").trim().toLowerCase();
      const travelDate = String(parsedUrl.searchParams.get("travel_date") || "").trim();
      const sort = String(parsedUrl.searchParams.get("sort") || "desc").toLowerCase();

      const result = await db.query(`SELECT * FROM bookings ORDER BY created_at DESC`);
      let allBookings = result.rows || [];

      if (search) {
        allBookings = allBookings.filter((b) => {
          const value = `${b.full_name || ""} ${b.email || ""} ${b.booking_ref || ""} ${b.destination || ""} ${b.trip_title || ""}`.toLowerCase();
          return value.includes(search);
        });
      }
      if (destination) {
        allBookings = allBookings.filter((b) => String(b.destination || "").toLowerCase() === destination);
      }
      if (bookingStatus) {
        allBookings = allBookings.filter((b) => String(b.status || "").toLowerCase() === bookingStatus);
      }
      if (paymentStatus) {
        allBookings = allBookings.filter((b) => String(b.payment_status || "").toLowerCase() === paymentStatus);
      }
      if (travelDate) {
        allBookings = allBookings.filter((b) => String(b.travel_date || "").startsWith(travelDate));
      }

      if (sort === "asc") {
        allBookings = allBookings.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      } else {
        allBookings = allBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      const summary = {
        total: allBookings.length,
        confirmed: allBookings.filter((b) => String(b.status || "").toLowerCase() === "confirmed").length,
        pending: allBookings.filter((b) => String(b.status || "").toLowerCase() === "pending").length,
        completed: allBookings.filter((b) => String(b.status || "").toLowerCase() === "completed").length,
        cancelled: allBookings.filter((b) => String(b.status || "").toLowerCase() === "cancelled").length
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ bookings: allBookings, summary }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/admin/bookings/status") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const adminUserId = String(payload.user_id || "").trim();
      const bookingId = Number(payload.booking_id || 0);
      const status = String(payload.status || "").trim();
      if (!adminUserId || !bookingId || !status) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Missing admin user_id, booking_id, or status." }));
        return;
      }
      const adminCheck = await db.query(`SELECT * FROM users WHERE user_id = $1`, [adminUserId]);
      if (!adminCheck.rows[0] || adminCheck.rows[0].role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Admin access required." }));
        return;
      }
      await db.query(`UPDATE bookings SET status = $1 WHERE id = $2`, [status, bookingId]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, status }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/api/admin/bookings")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const adminUserId = String(parsedUrl.searchParams.get("user_id") || "").trim();
      const bookingId = Number(parsedUrl.searchParams.get("booking_id") || 0);
      if (!adminUserId || !bookingId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Missing admin user_id or booking_id." }));
        return;
      }
      const adminCheck = await db.query(`SELECT * FROM users WHERE user_id = $1`, [adminUserId]);
      if (!adminCheck.rows[0] || adminCheck.rows[0].role !== "admin") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Admin access required." }));
        return;
      }
      await db.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/signup") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const fullName = String(payload.full_name || payload.fullName || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const phone = String(payload.phone || "").trim();
      const password = String(payload.password || "");
      const travelStyle = String(payload.travel_style || payload.travelStyle || "Budget Traveler").trim();

      if (!fullName || !email || !phone || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Please fill in all required fields." }));
        return;
      }

      const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rowCount > 0) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "An account with this email already exists." }));
        return;
      }

      const userId = `user_${Date.now()}`;
      const hashedPassword = hashPassword(password);
      await db.query(
        `INSERT INTO users (user_id, full_name, email, phone, password, travel_style)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, fullName, email, phone, hashedPassword, travelStyle]
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: "Account created successfully.",
        user: {
          user_id: userId,
          full_name: fullName,
          email,
          phone,
          travel_style: travelStyle
        }
      }));
    } catch (err) {
      console.log("← Signup error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/login") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");

      if (!email || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Please enter both email and password." }));
        return;
      }

      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];
      if (!user || user.password !== hashPassword(password)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Invalid email or password." }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        message: "Login successful.",
        user: {
          user_id: user.user_id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          travel_style: user.travel_style,
          role: user.role || "customer"
        }
      }));
    } catch (err) {
      console.log("← Login error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/bookings") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const userId = String(payload.user_id || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const fullName = String(payload.full_name || "").trim();
      const phone = String(payload.phone || "").trim();
      const travelers = Math.max(1, parseInt(payload.travelers, 10) || 1);
      const trip = payload.trip || {};
      const overview = trip.overview || trip;
      const destination = String(overview.destination || "Bangladesh").trim();
      const origin = String(overview.origin || "Dhaka").trim();
      const tripTitle = String(trip.tripTitle || `${origin} → ${destination} Trip`).trim();
      const budget = Number(overview.budget || trip.summary?.grandTotal || 0);
      const days = Number(overview.days || 1);
      const style = String(overview.style || "Adventure").trim();
      const travelDate = String(payload.travel_date || "").trim() || null;
      const paymentStatus = String(payload.payment_status || "pending").trim() || "pending";

      if (!fullName || !email) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Missing traveler details." }));
        return;
      }

      const bookingRef = `WKD-${Date.now().toString(36).toUpperCase()}`;

      const insertResult = await db.query(
        `INSERT INTO bookings (booking_ref, user_id, full_name, email, phone, destination, origin, trip_title, travelers, budget, days, style, travel_date, payment_status, status, plan_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
        [bookingRef, userId, fullName, email, phone, destination, origin, tripTitle, travelers, budget, days, style, travelDate, paymentStatus, "confirmed", JSON.stringify(trip)]
      );
      const bookingId = insertResult.rows?.[0]?.id || null;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        booking: { id: bookingId, bookingRef, fullName, email, destination, origin, tripTitle, travelers, budget, days, style, travel_date: travelDate, payment_status: paymentStatus }
      }));
    } catch (err) {
      console.log("← Booking error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/bookings")) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const userId = parsedUrl.searchParams.get("user_id") || "";
      const result = await db.query(
        `SELECT id, booking_ref, full_name, email, phone, destination, origin, trip_title, travelers, budget, days, style, travel_date, payment_status, status, created_at
         FROM bookings WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ bookings: result.rows }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/chatbot") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const message = String(payload.message || "").trim();
      const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];

      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, reply: "Could you tell me a bit more about what you'd like to know?" }));
        return;
      }

      if (!GEMINI_API_KEY) {
        const reply = getOfflineChatReply(message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, reply, offline: true }));
        return;
      }

      const contents = [
        ...history.map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.content }] })),
        { role: "user", parts: [{ text: message }] }
      ];

      const apiResData = await callGeminiWithFallback({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CHATBOT_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 400, temperature: 0.6, topP: 0.95 }
        }),
      });

      const data = apiResData.data;
      const candidate = data?.candidates?.[0];
      let text = "";
      if (candidate?.content?.parts) {
        text = candidate.content.parts.map((p) => p.text || "").join("");
      } else if (Array.isArray(candidate?.content)) {
        text = candidate.content.map((item) => (item.parts ? item.parts.map((p) => p.text || "").join("") : "")).join("\n");
      }

      if (!text) {
        const reply = getOfflineChatReply(message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, reply, offline: true }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, reply: text.trim(), offline: false }));
    } catch (err) {
      console.log("← Chatbot error:", err.message);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        reply: "I'm having a little trouble right now, but I'm still here — ask me about destinations, hotels, transport, or budgets in Bangladesh!",
        offline: true
      }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    let travelRequest = null;
    try {
      body = await readRequestBody(req);
      const payload = JSON.parse(body);
      const systemMsg = payload.system || "";
      const messages = payload.messages || [];

      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        parts: [{ text: m.content }]
      }));

      travelRequest = extractTravelRequest(contents, payload.tripRequest || {});

      if (!GEMINI_API_KEY) {
        console.log('→ No GEMINI_API_KEY available, returning offline plan.');
        const fallback = generateOfflinePlan(contents, travelRequest);
        await saveTravelPlan(travelRequest, fallback.structuredPlan || fallback);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fallback));
        return;
      }

      console.log(`→ Calling Gemini API with fallback models: ${GEMINI_MODEL_LIST.join(', ')}`);

      const apiResData = await callGeminiWithFallback({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
          contents,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2,
            topP: 0.95,
          }
        }),
      });

      const apiRes = apiResData.response;
      const data = apiResData.data;

      if (!apiRes?.ok || data?.error) {
        console.log(`→ Gemini failed; returning offline fallback. status=${apiRes?.status}`);
        const fallback = generateOfflinePlan(contents, travelRequest);
        await saveTravelPlan(travelRequest, fallback.structuredPlan || fallback);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fallback));
        return;
      }

      const candidate = data.candidates?.[0];
      let text = "";
      if (candidate) {
        const content = candidate.content;
        if (Array.isArray(content)) {
          text = content.map(item => {
            if (item.parts) return item.parts.map(p => p.text || "").join("");
            return "";
          }).join("\n");
        } else if (content?.parts) {
          text = content.parts.map(p => p.text || "").join("");
        }
      }
      if (!text) {
        console.log('→ Gemini returned no text; using offline fallback.');
        const fallback = generateOfflinePlan(contents, travelRequest);
        await saveTravelPlan(travelRequest, fallback.structuredPlan || fallback);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fallback));
        return;
      }

      const fallback = generateOfflinePlan(contents, travelRequest);
      const structuredPlan = normalizeStructuredPlan(text, fallback.structuredPlan);
      await saveTravelPlan(travelRequest, structuredPlan || { text });

      const converted = {
        text,
        content: [{ type: "text", text }],
        structuredPlan,
        fallback: false
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(converted));
    } catch (err) {
      console.log("← Exception:", err.message);
      const payload = body ? JSON.parse(body) : null;
      const contents = payload?.messages?.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        parts: [{ text: m.content }]
      })) || [];
      const fallback = generateOfflinePlan(contents, travelRequest || {});
      await saveTravelPlan(travelRequest || extractTravelRequest(contents), fallback.structuredPlan || fallback);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fallback));
    }
    return;
  }

  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath.replace(/^\//, ""));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Use PORT=<another port> node server.js to run on a different port.`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`
✅  Weekend AI is running!`);
  console.log(`👉  Open: http://localhost:${PORT}
`);
});
