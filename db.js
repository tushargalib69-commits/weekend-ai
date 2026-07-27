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
    fs.writeFileSync(localDbPath, JSON.stringify({ users: [], travel_plans: [], bookings: [] }, null, 2), "utf-8");
  }
}

function readLocalDb() {
  ensureLocalDb();
  const raw = fs.readFileSync(localDbPath, "utf-8");
  const parsed = JSON.parse(raw || "{\"users\":[],\"travel_plans\":[],\"bookings\":[]}");
  if (!parsed.bookings) parsed.bookings = [];
  return parsed;
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2), "utf-8");
}

async function query(sql, params = []) {
  if (pool) {
    return pool.query(sql, params);
  }

  const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
  const db = readLocalDb();

  if (normalized.startsWith("create table")) {
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith("select id from users where email")) {
    const email = params[0];
    const rows = db.users.filter((user) => user.email === email).map((user) => ({ id: user.user_id }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.startsWith("select * from users where email")) {
    const email = params[0];
    const rows = db.users.filter((user) => user.email === email);
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
      plan_json: JSON.parse(params[12]),
      status: "confirmed",
      created_at: new Date().toISOString()
    };
    db.bookings = db.bookings || [];
    db.bookings.push(record);
    writeLocalDb(db);
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.startsWith("select id, booking_ref")) {
    const userId = params[0];
    const rows = (db.bookings || [])
      .filter((b) => b.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows, rowCount: rows.length };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = { query, isLocal: !pool, localDbPath };