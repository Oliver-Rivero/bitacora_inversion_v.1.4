import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getEntities: () => ipcRenderer.invoke('db-get-entities'),
  addEntity: (entity) => ipcRenderer.invoke('db-add-entity', entity),
  editEntity: (entity) => ipcRenderer.invoke('db-edit-entity', entity),
  deleteEntity: (id) => ipcRenderer.invoke('db-delete-entity', id),
  getTransactions: () => ipcRenderer.invoke('db-get-transactions'),
  addTransaction: (txn) => ipcRenderer.invoke('db-add-transaction', txn),
  editTransaction: (txn) => ipcRenderer.invoke('db-edit-transaction', txn),
  deleteTransaction: (id) => ipcRenderer.invoke('db-delete-transaction', id),
  getQuotes: (symbols) => ipcRenderer.invoke('finance-get-quotes', symbols),

  // New Category & Asset Type Methods
  getCategories: () => ipcRenderer.invoke('db-get-categories'),
  addCategory: (cat) => ipcRenderer.invoke('db-add-category', cat),
  editCategory: (cat) => ipcRenderer.invoke('db-edit-category', cat),
  deleteCategory: (id) => ipcRenderer.invoke('db-delete-category', id),
  
  getAssetTypes: () => ipcRenderer.invoke('db-get-asset-types'),
  addAssetType: (type) => ipcRenderer.invoke('db-add-asset-type', type),
  editAssetType: (type) => ipcRenderer.invoke('db-edit-asset-type', type),
  deleteAssetType: (id) => ipcRenderer.invoke('db-delete-asset-type', id),
  getHistoricalPrice: (symbol, date) => ipcRenderer.invoke('finance-get-historical-price', { symbol, date }),
  
  // Configs
  getConfig: (key) => ipcRenderer.invoke('db-get-config', key),
  saveConfig: (key, value) => ipcRenderer.invoke('db-set-config', { key, value }),

  // Savings Goals (Huchas)
  getSavingsGoals: () => ipcRenderer.invoke('db-get-savings-goals'),
  addSavingsGoal: (goal) => ipcRenderer.invoke('db-add-savings-goal', goal),
  editSavingsGoal: (goal) => ipcRenderer.invoke('db-edit-savings-goal', goal),
  deleteSavingsGoal: (id) => ipcRenderer.invoke('db-delete-savings-goal', id),
  addSavingsContribution: (data) => ipcRenderer.invoke('db-add-savings-contribution', data),
  getSavingsContributions: (goalId) => ipcRenderer.invoke('db-get-savings-contributions', goalId),
  getSnapshots: () => ipcRenderer.invoke('db-get-snapshots'),
  saveSnapshot: (snapshot) => ipcRenderer.invoke('db-save-snapshot', snapshot),
  resetAllData: () => ipcRenderer.invoke('db-reset-all-data'),
  
  // Asset Metadata
  getAssetsMetadata: (symbols) => ipcRenderer.invoke('db-get-assets-metadata', symbols),
  getAssetMetadata: (symbol) => ipcRenderer.invoke('db-get-asset-metadata', symbol),
  saveAssetMetadata: (meta) => ipcRenderer.invoke('db-save-asset-metadata', meta),
  fetchOnlineMetadata: (symbol) => ipcRenderer.invoke('finance-get-metadata', symbol),
  
  error: (msg) => ipcRenderer.send('log-error', msg)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
