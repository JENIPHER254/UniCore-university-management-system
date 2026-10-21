import app from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import cors from 'cors'

const db = getDb();
db.pragma("wal_checkpoint(PASSIVE)");

// ===============local config================
// app.listen(config.port, () => {
//   console.log(`UniCore API listening on http://localhost:${config.port}`);
//   console.log(`CORS origin: ${config.corsOrigin}`);
// });

// ========production========
app.use(cors({
  origin: 'https://uni-core-university-management-syst.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))


// Start the API server
app.listen(config.port, () => {
  console.log(`UniCore API listening on port ${config.port}`);
});