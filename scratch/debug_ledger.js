const Database = require('better-sqlite3');
const path = require('path');

const dbPath = '/Users/oliver/Library/Application Support/mi-cartera/db.sqlite';
const db = new Database(dbPath);

console.log("--- ENTIDADES ---");
const entities = db.prepare('SELECT id, name FROM entities').all();
console.log(entities);

const reental = entities.find(e => e.name === 'Reental');
const reentalId = reental ? reental.id : null;

console.log("\n--- TRANSACCIONES PARA REENTAL (ID: " + reentalId + ") ---");
const txs = db.prepare('SELECT * FROM transactions WHERE entityId = ?').all(reentalId);
txs.forEach(t => {
    console.log(`Date: ${t.date}, Op: ${t.operation}, AssetType: [${t.assetType}], Name: ${t.name}, Shares: ${t.shares}`);
});

console.log("\n--- TYPES IN DB ---");
const types = db.prepare('SELECT DISTINCT assetType FROM transactions').all();
console.log(types);
