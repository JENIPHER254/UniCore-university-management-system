// import app from "./app.js";
// import { config } from "./config.js";
// import { getDb } from "./db/index.js";

// const db = getDb();
// db.pragma("wal_checkpoint(PASSIVE)");

// app.listen(config.port, () => {
//   console.log(`UniCore API listening on http://localhost:${config.port}`);
//   console.log(`CORS origin: ${config.corsOrigin}`);
// });


import app from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { applyMigrations } from "./db/migrate.js";

// Run database migrations before accepting API requests.
const migrationResult = applyMigrations();

console.log("Database migrations completed.");
console.log("Applied:", migrationResult.applied);
console.log("Skipped:", migrationResult.skipped);

// Open the application database.
const db = getDb();
db.pragma("wal_checkpoint(PASSIVE)");

console.log("Database path:", config.databasePath);

// Start the API server once.
app.listen(config.port, () => {
  console.log(`UniCore API listening on port ${config.port}`);
  console.log(`CORS origin: ${config.corsOrigin}`);
});