import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db

export function setupDatabase() {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'mi_cartera.sqlite')
  
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      categoryId INTEGER,
      color TEXT NOT NULL,
      FOREIGN KEY(categoryId) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      entityId INTEGER,
      toEntityId INTEGER,
      operation TEXT NOT NULL,
      assetType TEXT NOT NULL,
      symbol TEXT,
      name TEXT,
      shares REAL,
      unitPrice REAL,
      exchangeRate REAL,
      commission REAL,
      tax REAL,
      total REAL,
      originalUnitPrice REAL,
      originalTotal REAL,
      currency TEXT DEFAULT 'EUR',
      yield REAL,
      maturityDate TEXT,
      FOREIGN KEY(entityId) REFERENCES entities(id),
      FOREIGN KEY(toEntityId) REFERENCES entities(id)
    );

    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS asset_metadata (
      symbol TEXT PRIMARY KEY,
      sector TEXT,
      industry TEXT,
      country TEXT,
      description TEXT,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL DEFAULT 0,
      initialAmount REAL DEFAULT 0,
      monthlySaving REAL DEFAULT 0,
      annualRate REAL DEFAULT 0,
      deadlineMonths INTEGER,
      calcMode TEXT DEFAULT 'time',
      createdAt TEXT,
      icon TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS savings_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goalId INTEGER,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY(goalId) REFERENCES savings_goals(id)
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      netWorth REAL NOT NULL,
      costBasis REAL NOT NULL,
      unrealizedGain REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_metadata (
      symbol TEXT PRIMARY KEY,
      sector TEXT,
      industry TEXT,
      country TEXT,
      description TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS radar_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT,
      initialPrice REAL,
      targetPrice REAL,
      notes TEXT,
      addedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  try {
    db.prepare("ALTER TABLE entities ADD COLUMN url TEXT").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE asset_metadata ADD COLUMN last_updated TEXT").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN notes TEXT").run()
    console.log('Database migration: Added notes column to savings_goals table.')
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN annualRate REAL DEFAULT 0").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN monthlySaving REAL DEFAULT 0").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN initialAmount REAL DEFAULT 0").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN deadlineMonths INTEGER").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE savings_goals ADD COLUMN calcMode TEXT DEFAULT 'time'").run()
  } catch (e) {}
  
  try {
    db.prepare("ALTER TABLE transactions ADD COLUMN toEntityId INTEGER").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE transactions ADD COLUMN originalUnitPrice REAL").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE transactions ADD COLUMN originalTotal REAL").run()
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE asset_types ADD COLUMN sortOrder INTEGER DEFAULT 0").run()
  } catch (e) {}
  
  try {
    db.prepare("ALTER TABLE radar_assets ADD COLUMN targetPrice REAL").run()
  } catch (e) {}

  // Seed basic categories if empty
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get()
    if (catCount && catCount.count === 0) {
      console.log('Seeding default categories...')
      const cats = [
        ['Renta Variable', '#7E91B1'],
        ['Cripto', '#A29BBD'],
        ['Renta Fija', '#899A81'],
        ['Inmobiliario', '#BFA89A'],
        ['Capital Privado', '#D9CD96'],
        ['Liquidez', '#BDE0FE'],
        ['Oro', '#FFD700'],
        ['Otros', '#B0B0B0']
      ]
      
      db.transaction(() => {
        const insertCat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
        cats.forEach(c => insertCat.run(c[0], c[1]))

        const findCat = db.prepare('SELECT id FROM categories WHERE name = ?')
        const insertType = db.prepare('INSERT INTO asset_types (name, categoryId, color) VALUES (?, ?, ?)')
        
        const types = [
          ['Fondos Indexados', 'Renta Variable', '#7E91B1'],
          ["ETF's", 'Renta Variable', '#9CAF9C'],
          ['Acciones', 'Renta Variable', '#D18B8B'],
          ['Cripto', 'Cripto', '#A29BBD'],
          ['Depósitos', 'Renta Fija', '#899A81'],
          ['Bonos/Letras', 'Renta Fija', '#7388A1'],
          ['Inmobiliario', 'Inmobiliario', '#BFA89A'],
          ['Capital Privado', 'Capital Privado', '#D9CD96'],
          ['Cuenta', 'Liquidez', '#BDE0FE'],
          ['Oro', 'Oro', '#FFD700']
        ]

        types.forEach(t => {
          const cat = findCat.get(t[1])
          if (cat) {
            insertType.run(t[0], cat.id, t[2])
          }
        })
      })()
      console.log('Seeding completed successfully.')
    }
  } catch (err) {
    console.error('Error seeding database:', err)
  }
}

export function getAssetMetadata(symbol) {
  return db.prepare('SELECT * FROM asset_metadata WHERE symbol = ?').get(symbol)
}

export function saveAssetMetadata(meta) {
  return db.prepare(`
    INSERT OR REPLACE INTO asset_metadata (symbol, sector, industry, country, description, last_updated)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(meta.symbol, meta.sector, meta.industry, meta.country, meta.description)
}

// Radar Functions
export function getRadarAssets() {
  return db.prepare('SELECT * FROM radar_assets ORDER BY addedAt DESC').all()
}

export function addRadarAsset(asset) {
  return db.prepare('INSERT INTO radar_assets (symbol, name, initialPrice, notes) VALUES (?, ?, ?, ?)').run(asset.symbol.toUpperCase(), asset.name, asset.initialPrice, asset.notes)
}

export function deleteRadarAsset(id) {
  return db.prepare('DELETE FROM radar_assets WHERE id = ?').run(id)
}

export function editRadarAsset(asset) {
  const { id, name, targetPrice, notes } = asset
  return db.prepare('UPDATE radar_assets SET name = ?, targetPrice = ?, notes = ? WHERE id = ?').run(name, targetPrice, notes, id)
}

export function getDb() {
  return db
}
