const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

const localDbPath = path.join(__dirname, "localdb.json");

function ensureLocalDb() {
  if (!fs.existsSync(localDbPath)) {
    fs.writeFileSync(localDbPath, JSON.stringify({ users: [], travel_plans: [], bookings: [], reviews: [] }, null, 2), "utf-8");
  }
}

function readLocalDb() {
  ensureLocalDb();
  const raw = fs.readFileSync(localDbPath, "utf-8");
  const parsed = JSON.parse(raw || "{\"users\":[],\"travel_plans\":[],\"bookings\":[],\"reviews\":[]}");
  if (!parsed.users) parsed.users = [];
  if (!parsed.travel_plans) parsed.travel_plans = [];
  if (!parsed.bookings) parsed.bookings = [];
  if (!parsed.reviews) parsed.reviews = [];
  return parsed;
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeQuery(sql) {
  return sql.trim().replace(/\s+/g, " ").toLowerCase();
}

async function query(sql, params = []) {
  if (pool) {
    return pool.query(sql, params);
  }

  const normalized = normalizeQuery(sql);
  const db = readLocalDb();

  if (normalized.startsWith("create table")) {
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith("select id from users where email")) {
    const email = params[0];
    const rows = db.users.filter((user) => user.email === email).map((user) => ({ id: user.user_id }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes("from users where email")) {
    const email = params[0];
    const rows = db.users.filter((user) => user.email === email);
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes("from users where user_id")) {
    const userId = params[0];
    const rows = db.users.filter((user) => user.user_id === userId);
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("insert into users")) {
    const record = {
      user_id: params[0],
      full_name: params[1],
      email: params[2],
      phone: params[3],
      password: params[4],
      travel_style: params[5],
      role: params[6] || "customer",
      created_at: new Date().toISOString()
    };
    db.users.push(record);
    writeLocalDb(db);
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.startsWith("insert into travel_plans")) {
    const record = {
      origin: params[0],
      destination: params[1],
      budget: params[2],
      days: params[3],
      style: params[4],
      plan_json: JSON.parse(params[5]),
      created_at: new Date().toISOString()
    };
    db.travel_plans.push(record);
    writeLocalDb(db);
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.startsWith("select id, origin, destination")) {
    const rows = [...db.travel_plans].slice(-10).reverse();
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("insert into bookings")) {
    const record = {
      id: (db.bookings || []).length + 1,
      booking_ref: params[0],
      user_id: params[1],
      full_name: params[2],
      email: params[3],
      phone: params[4],
      destination: params[5],
      origin: params[6],
      trip_title: params[7],
      travelers: params[8],
      budget: params[9],
      days: params[10],
      style: params[11],
      travel_date: params[12] || null,
      payment_status: params[13] || "pending",
      status: params[14] || "confirmed",
      plan_json: JSON.parse(params[15]),
      created_at: new Date().toISOString()
    };
    db.bookings = db.bookings || [];
    db.bookings.push(record);
    writeLocalDb(db);
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.includes("from bookings where user_id")) {
    const userId = params[0];
    const rows = (db.bookings || [])
      .filter((b) => b.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes("from bookings where destination")) {
    const destination = String(params[0] || "").toLowerCase();
    const rows = (db.bookings || []).filter((b) => String(b.destination || "").toLowerCase() === destination);
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select * from bookings order by created_at")) {
    const rows = [...(db.bookings || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select count(*) from bookings where destination")) {
    const destination = String(params[0] || "").toLowerCase();
    const count = (db.bookings || []).filter((b) => String(b.destination || "").toLowerCase() === destination && ["confirmed","completed","pending","cancelled"].includes(String(b.status || "").toLowerCase())).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  if (normalized.startsWith("select count(*) from bookings where id")) {
    const id = Number(params[0]);
    const count = (db.bookings || []).filter((b) => Number(b.id) === id).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  if (normalized.startsWith("select * from bookings where id")) {
    const id = Number(params[0]);
    const rows = (db.bookings || []).filter((b) => Number(b.id) === id);
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("update bookings set status")) {
    const status = params[0];
    const id = Number(params[1]);
    const booking = (db.bookings || []).find((b) => Number(b.id) === id);
    if (booking) {
      booking.status = status;
      writeLocalDb(db);
      return { rows: [booking], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith("delete from bookings where id")) {
    const id = Number(params[0]);
    const index = (db.bookings || []).findIndex((b) => Number(b.id) === id);
    if (index >= 0) {
      const [deleted] = db.bookings.splice(index, 1);
      writeLocalDb(db);
      return { rows: [deleted], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith("insert into reviews")) {
    const record = {
      id: (db.reviews || []).length + 1,
      booking_id: Number(params[0]),
      user_id: params[1],
      trip_id: params[2] || null,
      booking_ref: params[3],
      customer_name: params[4],
      destination: params[5],
      rating: Number(params[6]),
      review_text: params[7],
      review_date: params[8] || new Date().toISOString(),
      status: params[9] || "published"
    };
    db.reviews = db.reviews || [];
    db.reviews.push(record);
    writeLocalDb(db);
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.startsWith("select * from reviews where booking_id")) {
    const bookingId = Number(params[0]);
    const rows = (db.reviews || []).filter((review) => Number(review.booking_id) === bookingId);
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select * from reviews order by")) {
    const rows = [...(db.reviews || [])].sort((a, b) => new Date(b.review_date) - new Date(a.review_date));
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select * from reviews where destination")) {
    const destination = String(params[0] || "").toLowerCase();
    const rows = (db.reviews || []).filter((review) => String(review.destination || "").toLowerCase() === destination).sort((a, b) => new Date(b.review_date) - new Date(a.review_date));
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select * from reviews where user_id")) {
    const userId = params[0];
    const rows = (db.reviews || []).filter((review) => review.user_id === userId).sort((a, b) => new Date(b.review_date) - new Date(a.review_date));
    return { rows, rowCount: rows.length };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = { query, isLocal: !pool, localDbPath };