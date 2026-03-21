const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://firstcallremovals.com',
    'https://www.firstcallremovals.com',
    /\.up\.railway\.app$/,
  ],
  credentials: true
}));
app.use(express.json());

// Initialize database
initDb();

// Seed funeral home clients from CSV on startup (idempotent — skips existing)
try {
  const { seedClients } = require('./scripts/seed-clients.js');
  const { getDb } = require('./database');
  seedClients(getDb());
} catch (err) {
  console.warn('[seed] Client seed skipped:', err.message);
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transports', require('./routes/transports'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/funeral-homes', require('./routes/funeral-homes'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend build
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Funeral Transport API running on http://localhost:${PORT}`);
});
