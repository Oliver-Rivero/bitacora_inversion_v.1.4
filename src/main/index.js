import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupDatabase, getDb } from './database.js'
import { setupFinanceHandlers } from './finance.js'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1680,
    height: 1100,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.micartera.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize SQLite database
  setupDatabase()
  const db = getDb()

  // Set up Finance API IPC
  setupFinanceHandlers()

  // Database IPC Endpoints
  ipcMain.handle('db-get-entities', () => {
    return db.prepare('SELECT * FROM entities ORDER BY name ASC').all()
  })

  ipcMain.handle('db-add-entity', (_, { name, url }) => {
    const stmt = db.prepare('INSERT INTO entities (name, url) VALUES (?, ?)')
    const info = stmt.run(name, url)
    return info.lastInsertRowid
  })

  ipcMain.handle('db-edit-entity', (_, { id, name, url }) => {
    const stmt = db.prepare('UPDATE entities SET name = ?, url = ? WHERE id = ?')
    stmt.run(name, url, id)
    return true
  })

  ipcMain.handle('db-delete-entity', (_, id) => {
    const stmt = db.prepare('DELETE FROM entities WHERE id = ?')
    stmt.run(id)
    return true
  })

  ipcMain.handle('db-get-transactions', () => {
    return db.prepare('SELECT * FROM transactions ORDER BY date DESC').all()
  })

  ipcMain.handle('db-add-transaction', (_, txn) => {
    const { date, entityId, toEntityId, operation, assetType, symbol, name, shares, unitPrice, exchangeRate, commission, tax, total, currency, yield: yld, maturityDate } = txn
    const stmt = db.prepare(`
      INSERT INTO transactions 
      (date, entityId, toEntityId, operation, assetType, symbol, name, shares, unitPrice, exchangeRate, commission, tax, total, currency, yield, maturityDate) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(date, entityId, toEntityId || null, operation, assetType, symbol, name, shares, unitPrice, exchangeRate, commission, tax, total, currency || 'EUR', yld || 0, maturityDate || null)
    return info.lastInsertRowid
  })

  ipcMain.handle('db-delete-transaction', (_, id) => {
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?')
    stmt.run(id)
    return true
  })

  ipcMain.handle('db-edit-transaction', (_, txn) => {
    const { id, date, entityId, toEntityId, operation, assetType, symbol, name, shares, unitPrice, exchangeRate, commission, tax, total, currency, yield: yld, maturityDate } = txn
    const stmt = db.prepare(`
      UPDATE transactions 
      SET date = ?, entityId = ?, toEntityId = ?, operation = ?, assetType = ?, symbol = ?, name = ?, shares = ?, unitPrice = ?, exchangeRate = ?, commission = ?, tax = ?, total = ?, currency = ?, yield = ?, maturityDate = ?
      WHERE id = ?
    `)
    stmt.run(date, entityId, toEntityId || null, operation, assetType, symbol, name, shares, unitPrice, exchangeRate, commission, tax, total, currency || 'EUR', yld || 0, maturityDate || null, id)
    return true
  })

  // Categories Handlers
  ipcMain.handle('db-get-categories', () => {
    return db.prepare('SELECT * FROM categories ORDER BY name ASC').all()
  })

  ipcMain.handle('db-add-category', (_, { name, color }) => {
    const stmt = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
    const info = stmt.run(name, color)
    return info.lastInsertRowid
  })

  ipcMain.handle('db-edit-category', (_, { id, name, color }) => {
    const stmt = db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
    stmt.run(name, color, id)
    return true
  })

  ipcMain.handle('db-delete-category', (_, id) => {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?')
    stmt.run(id)
    return true
  })

  // Asset Types Handlers
  ipcMain.handle('db-get-asset-types', () => {
    return db.prepare('SELECT * FROM asset_types ORDER BY name ASC').all()
  })

  ipcMain.handle('db-add-asset-type', (_, { name, categoryId, color }) => {
    const stmt = db.prepare('INSERT INTO asset_types (name, categoryId, color) VALUES (?, ?, ?)')
    const info = stmt.run(name, categoryId, color)
    return info.lastInsertRowid
  })

  ipcMain.handle('db-edit-asset-type', (_, { id, name, categoryId, color, oldName }) => {
    const stmt = db.prepare('UPDATE asset_types SET name = ?, categoryId = ?, color = ? WHERE id = ?')
    stmt.run(name, categoryId, color, id)
    
    // If name changed, optionally update transactions (will be handled by confirmation in UI, but IPC is here)
    if (oldName && oldName !== name) {
      const updateTxns = db.prepare('UPDATE transactions SET assetType = ? WHERE assetType = ?')
      updateTxns.run(name, oldName)
    }
    return true
  })

  ipcMain.handle('db-delete-asset-type', (_, id) => {
    const stmt = db.prepare('DELETE FROM asset_types WHERE id = ?')
    stmt.run(id)
    return true
  })

  // Config Handlers
  ipcMain.handle('db-get-config', (_, key) => {
    const row = db.prepare('SELECT value FROM configs WHERE key = ?').get(key)
    return row ? row.value : null
  })

  ipcMain.handle('db-set-config', (_, { key, value }) => {
    const dataStr = typeof value === 'string' ? value : JSON.stringify(value);
    const stmt = db.prepare('INSERT OR REPLACE INTO configs (key, value) VALUES (?, ?)')
    stmt.run(key, dataStr)
    return true
  })

  ipcMain.handle('db-get-savings-goals', () => {
    return db.prepare('SELECT * FROM savings_goals').all()
  })

  ipcMain.handle('db-add-savings-goal', (_, goal) => {
    const { name, targetAmount, currentAmount, initialAmount, monthlySaving, annualRate, deadlineMonths, calcMode, createdAt, icon, notes } = goal
    const insertSQL = `
      INSERT INTO savings_goals 
      (name, targetAmount, currentAmount, initialAmount, monthlySaving, annualRate, deadlineMonths, calcMode, createdAt, icon, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    try {
      const stmt = db.prepare(insertSQL)
      const info = stmt.run(name, targetAmount, currentAmount || 0, initialAmount || 0, monthlySaving || 0, annualRate || 0, deadlineMonths || null, calcMode || 'time', createdAt, icon, notes || null)
      return info.lastInsertRowid
    } catch (err) {
      console.warn("Retrying goal creation after potential schema mismatch:", err.message)
      // Try to ensure column exists if it was a missing column error
      try { db.prepare("ALTER TABLE savings_goals ADD COLUMN notes TEXT").run() } catch (e) {}
      try { db.prepare("ALTER TABLE savings_goals ADD COLUMN annualRate REAL DEFAULT 0").run() } catch (e) {}
      
      // Retry once
      const stmt = db.prepare(insertSQL)
      const info = stmt.run(name, targetAmount, currentAmount || 0, initialAmount || 0, monthlySaving || 0, annualRate || 0, deadlineMonths || null, calcMode || 'time', createdAt, icon, notes || null)
      return info.lastInsertRowid
    }
  })

  ipcMain.handle('db-edit-savings-goal', (_, goal) => {
    const { id, name, targetAmount, currentAmount, initialAmount, monthlySaving, annualRate, deadlineMonths, calcMode, icon, notes } = goal
    const stmt = db.prepare(`
      UPDATE savings_goals 
      SET name = ?, targetAmount = ?, currentAmount = ?, initialAmount = ?, monthlySaving = ?, annualRate = ?, deadlineMonths = ?, calcMode = ?, icon = ?, notes = ?
      WHERE id = ?
    `)
    stmt.run(name, targetAmount, currentAmount, initialAmount, monthlySaving, annualRate, deadlineMonths, calcMode, icon, notes, id)
    return true
  })

  ipcMain.handle('db-delete-savings-goal', (_, id) => {
    const deleteContributions = db.prepare('DELETE FROM savings_contributions WHERE goalId = ?')
    const deleteGoal = db.prepare('DELETE FROM savings_goals WHERE id = ?')
    
    const transaction = db.transaction((targetId) => {
      deleteContributions.run(targetId)
      deleteGoal.run(targetId)
    })
    
    transaction(id)
    return true
  })

  ipcMain.handle('db-add-savings-contribution', (_, { goalId, amount }) => {
    const date = new Date().toISOString()
    const updateGoal = db.prepare('UPDATE savings_goals SET currentAmount = currentAmount + ? WHERE id = ?')
    const addHistory = db.prepare('INSERT INTO savings_contributions (goalId, amount, date) VALUES (?, ?, ?)')
    
    const transaction = db.transaction(() => {
      updateGoal.run(amount, goalId)
      addHistory.run(goalId, amount, date)
    })
    
    transaction()
    return true
  })

  ipcMain.handle('db-get-savings-contributions', (_, goalId) => {
    if (goalId) {
      return db.prepare('SELECT * FROM savings_contributions WHERE goalId = ? ORDER BY date ASC').all(goalId)
    } else {
      return db.prepare(`
        SELECT sc.*, sg.name as goalName 
        FROM savings_contributions sc
        JOIN savings_goals sg ON sc.goalId = sg.id
        ORDER BY sc.date DESC
      `).all()
    }
  })

  // Snapshots Handlers
  ipcMain.handle('db-get-snapshots', () => {
    return db.prepare('SELECT * FROM snapshots ORDER BY date ASC').all()
  })

  ipcMain.handle('db-save-snapshot', (_, snapshot) => {
    const { date, netWorth, costBasis, unrealizedGain } = snapshot
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO snapshots (date, netWorth, costBasis, unrealizedGain)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(date, netWorth, costBasis, unrealizedGain)
    return true
  })

  ipcMain.handle('db-reset-all-data', () => {
    const tables = ['transactions', 'entities', 'savings_contributions', 'savings_goals', 'snapshots', 'categories', 'asset_types']
    const transaction = db.transaction(() => {
      tables.forEach(table => {
        db.prepare(`DELETE FROM ${table}`).run()
        db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table)
      })
    })
    transaction()
    // Re-seed defaults
    setupDatabase()
    return true
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
