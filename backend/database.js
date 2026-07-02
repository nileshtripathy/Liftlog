const Database = require("better-sqlite3");

// Create/Open database
const db = new Database("liftlog.db");

// Create workouts table if it doesn't exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise TEXT NOT NULL,
        weight REAL NOT NULL,
        reps INTEGER NOT NULL,
        date TEXT NOT NULL
    )
`).run();

console.log("✅ SQLite database connected.");
console.log("✅ workouts table is ready.");

module.exports = db;