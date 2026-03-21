const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Use /data volume on Railway (persistent), fall back to local for dev
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'funeral_transport.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available',
      current_location TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available',
      driver_id TEXT
    );

    CREATE TABLE IF NOT EXISTS transports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      pickup_location TEXT,
      pickup_location_type TEXT,
      destination TEXT,
      destination_location_type TEXT,
      decedent_name TEXT,
      date_of_birth TEXT,
      date_of_death TEXT,
      weight INTEGER DEFAULT 0,
      funeral_home_name TEXT,
      funeral_home_phone TEXT,
      pickup_contact TEXT,
      pickup_phone TEXT,
      destination_contact TEXT,
      destination_phone TEXT,
      case_number TEXT,
      estimated_miles INTEGER DEFAULT 0,
      actual_miles INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending',
      assigned_driver_id TEXT,
      assigned_vehicle_id TEXT,
      current_location TEXT,
      return_to TEXT,
      pickup_fee REAL DEFAULT 0,
      mileage_fee REAL DEFAULT 0,
      ob_fee REAL DEFAULT 0,
      admin_fee REAL DEFAULT 10,
      total_cost REAL DEFAULT 0,
      notes TEXT,
      eta TEXT,
      accepted_at TEXT,
      en_route_at TEXT,
      arrived_at TEXT,
      loaded_at TEXT,
      completed_at TEXT,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport_id TEXT NOT NULL,
      for_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS funeral_homes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      default_destination TEXT,
      intake_format TEXT,
      notes TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS funeral_home_callers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funeral_home_id INTEGER NOT NULL REFERENCES funeral_homes(id),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  migrateDb(db);
  seedData(db);
}

function migrateDb(db) {
  // Add new columns to existing transports table if they don't exist
  const transportColumns = [
    ['notes', 'TEXT'],
    ['eta', 'TEXT'],
    ['accepted_at', 'TEXT'],
    ['en_route_at', 'TEXT'],
    ['arrived_at', 'TEXT'],
    ['loaded_at', 'TEXT'],
    ['completed_at', 'TEXT'],
    ['funeral_home_id', 'INTEGER'],
  ];
  for (const [col, type] of transportColumns) {
    try { db.exec(`ALTER TABLE transports ADD COLUMN ${col} ${type}`); } catch (_) {}
  }

  // Create notifications table if missing (older DBs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport_id TEXT NOT NULL,
      for_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS funeral_homes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      default_destination TEXT,
      intake_format TEXT,
      notes TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS funeral_home_callers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funeral_home_id INTEGER NOT NULL REFERENCES funeral_homes(id),
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add deleted_at column to funeral_homes if missing
  try { db.exec('ALTER TABLE funeral_homes ADD COLUMN deleted_at TEXT'); } catch (_) {}

  // Add email column to users if missing
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (_) {}

  // Add funeral_home_name column to users if missing
  try { db.exec('ALTER TABLE users ADD COLUMN funeral_home_name TEXT'); } catch (_) {}

  // Add email verification columns to users if missing
  try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN verification_token TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN verification_sent_at TEXT'); } catch (_) {}

  // Add phone to users if missing
  try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch (_) {}

  // Add phone/notes to drivers if missing
  try { db.exec('ALTER TABLE drivers ADD COLUMN phone TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE drivers ADD COLUMN notes TEXT'); } catch (_) {}

  // Add type/notes to vehicles if missing
  try { db.exec('ALTER TABLE vehicles ADD COLUMN type TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE vehicles ADD COLUMN notes TEXT'); } catch (_) {}

  // Add scheduled_pickup_at to transports if missing
  try { db.exec('ALTER TABLE transports ADD COLUMN scheduled_pickup_at TEXT'); } catch (_) {}

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport_id TEXT NOT NULL,
      funeral_home_name TEXT,
      funeral_home_email TEXT,
      decedent_name TEXT,
      pickup_fee REAL DEFAULT 0,
      mileage_fee REAL DEFAULT 0,
      ob_fee REAL DEFAULT 0,
      admin_fee REAL DEFAULT 10,
      total_cost REAL DEFAULT 0,
      actual_miles INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      approved_at TEXT,
      sent_at TEXT,
      approved_by TEXT
    );
  `);

  // Transport messages table (per-transport chat)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Transport documents table (saved filled forms)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      field_data TEXT NOT NULL,
      signature_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT
    );
  `);

  // Settings table (for invoice sequence, etc.)
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_seq', '1000')`).run();

  // Invite codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'employee',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      used_by TEXT,
      used_at TEXT,
      expires_at TEXT
    );
  `);

  // Invoice table: add new columns if missing
  const invoiceNewCols = [
    ['invoice_number', 'TEXT'],
    ['service_date', 'TEXT'],
    ['issue_date', 'TEXT'],
    ['due_date', 'TEXT'],
    ['case_number', 'TEXT'],
    ['decedent_dob', 'TEXT'],
    ['pickup_location', 'TEXT'],
    ['delivery_location', 'TEXT'],
    ['bill_to_location', 'TEXT'],
    ['customer_name_full', 'TEXT'],
    ['customer_street', 'TEXT'],
    ['customer_city', 'TEXT'],
    ['customer_state', 'TEXT'],
    ['customer_zip', 'TEXT'],
    ['line_items', 'TEXT'],
    ['payment_status', "TEXT DEFAULT 'due'"],
    ['paid_at', 'TEXT'],
    ['voided_at', 'TEXT'],
  ];
  for (const [col, type] of invoiceNewCols) {
    try { db.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${type}`); } catch (_) {}
  }

  seedFuneralHomes(db);
}

function seedFuneralHomes(db) {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM funeral_homes').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO funeral_homes (name, address, city, state, zip, phone, default_destination, intake_format)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    'Houston Service Center', '1220 W 34th Street', 'Houston', 'TX', '77018',
    '(713) 863-0700', '1220 W 34th Street, Houston, TX 77018', 'structured'
  );
  insert.run(
    'Callaway Jones Funeral Home', '3001 S College Ave', 'Bryan', 'TX', '77801',
    null, '3001 S College Ave, Bryan, TX 77801', 'casual'
  );
}

function seedData(db) {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count > 0) return;

  const insertUser = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
  insertUser.run('admin', bcrypt.hashSync('admin123', 10), 'admin');
  insertUser.run('employee', bcrypt.hashSync('employee123', 10), 'employee');
  insertUser.run('funeralhome', bcrypt.hashSync('funeral123', 10), 'funeral_home');

  const insertDriver = db.prepare('INSERT INTO drivers (id, name, status, current_location) VALUES (?, ?, ?, ?)');
  insertDriver.run('D001', 'Mike Johnson', 'Active', 'Huntsville, TX');
  insertDriver.run('D002', 'Sarah Williams', 'Available', 'Austin, TX');
  insertDriver.run('D003', 'Robert Davis', 'Available', 'Dallas, TX');

  const insertVehicle = db.prepare('INSERT INTO vehicles (id, name, status, driver_id) VALUES (?, ?, ?, ?)');
  insertVehicle.run('V001', 'Unit 1 - Ford Transit', 'In Use', 'D001');
  insertVehicle.run('V002', 'Unit 2 - Mercedes Sprinter', 'Available', null);
  insertVehicle.run('V003', 'Unit 3 - Ford Transit', 'Available', null);

  // Seed active transport: pickup(Hospital)=195, mileage=(60-30)*3.5=105, ob=0, admin=10 => 310
  db.prepare(`
    INSERT INTO transports (
      id, date, pickup_location, pickup_location_type, destination, destination_location_type,
      decedent_name, weight, funeral_home_name, case_number, estimated_miles, actual_miles,
      status, assigned_driver_id, assigned_vehicle_id, current_location, return_to,
      pickup_fee, mileage_fee, ob_fee, admin_fee, total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'TR001', '2025-06-27',
    'Dallas, TX', 'Hospital',
    'Houston, TX', 'Funeral Home/Care Center',
    'John Smith', 180, 'Peaceful Rest Funeral Home', 'CASE-001',
    60, 240,
    'Accepted', 'D001', 'V001',
    'Huntsville, TX', 'Dallas, TX',
    195, 105, 0, 10, 310
  );
}

function rowToTransport(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    pickupLocation: row.pickup_location,
    pickupLocationType: row.pickup_location_type,
    destination: row.destination,
    destinationLocationType: row.destination_location_type,
    decedentName: row.decedent_name,
    dateOfBirth: row.date_of_birth,
    dateOfDeath: row.date_of_death,
    weight: row.weight,
    funeralHomeName: row.funeral_home_name,
    funeralHome: row.funeral_home_name,
    funeralHomePhone: row.funeral_home_phone,
    pickupContact: row.pickup_contact,
    pickupPhone: row.pickup_phone,
    destinationContact: row.destination_contact,
    destinationPhone: row.destination_phone,
    caseNumber: row.case_number,
    estimatedMiles: row.estimated_miles,
    actualMiles: row.actual_miles,
    status: row.status,
    assignedDriverId: row.assigned_driver_id,
    assignedVehicleId: row.assigned_vehicle_id,
    assignedDriver: row.driver_name || null,
    assignedVehicle: row.vehicle_name || null,
    currentLocation: row.current_location,
    returnTo: row.return_to,
    notes: row.notes || null,
    eta: row.eta || null,
    acceptedAt: row.accepted_at || null,
    enRouteAt: row.en_route_at || null,
    arrivedAt: row.arrived_at || null,
    loadedAt: row.loaded_at || null,
    completedAt: row.completed_at || null,
    totalCost: row.total_cost,
    costBreakdown: {
      pickupFee: row.pickup_fee,
      mileageFee: row.mileage_fee,
      obFee: row.ob_fee,
      adminFee: row.admin_fee,
      totalCost: row.total_cost
    },
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    funeralHomeId: row.funeral_home_id || null,
    scheduledPickupAt: row.scheduled_pickup_at || null,
  };
}

module.exports = { getDb, initDb, rowToTransport };
