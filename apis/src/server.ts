import app from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";

const db = getDb();
db.pragma("wal_checkpoint(PASSIVE)");

app.listen(config.port, () => {
  console.log(`UniCore API listening on http://localhost:${config.port}`);
  console.log(`CORS origin: ${config.corsOrigin}`);
});
