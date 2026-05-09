const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Electron userData path on Mac: ~/Library/Application Support/mi_cartera
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'mi_cartera', 'mi_cartera.sqlite');
console.log('Checking DB at:', dbPath);

try {
  const db = new Database(dbPath);
  const categories = db.prepare('SELECT * FROM categories').all();
  const assetTypes = db.prepare('SELECT * FROM asset_types').all();
  const transactions = db.prepare('SELECT DISTINCT assetType FROM transactions').all();
  
  console.log('Categories:', categories);
  console.log('Asset Types:', assetTypes);
  console.log('Unique AssetTypes in transactions:', transactions);
} catch (e) {
  console.error('Error:', e.message);
}
