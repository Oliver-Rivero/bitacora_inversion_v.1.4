const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), 'Library/Application Support/mi-cartera/database.sqlite');

try {
  const db = new Database(dbPath);
  const columns = db.prepare("PRAGMA table_info(savings_goals)").all();
  console.log("Columns in savings_goals:", JSON.stringify(columns, null, 2));
} catch (err) {
  console.error("Error checking DB:", err.message);
}
