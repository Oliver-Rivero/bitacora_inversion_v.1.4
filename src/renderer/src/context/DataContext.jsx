import React, { createContext, useContext, useState, useEffect } from 'react'
import { ASSET_TYPES, MACRO_CATS, MACRO_COLORS, TYPE_COLORS } from '../utils/constants'

const DataContext = createContext()

export function DataProvider({ children }) {
  const [entities, setEntities] = useState([])
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [assetTypes, setAssetTypes] = useState([])
  const [quotes, setQuotes] = useState({})
  const [fxRate, setFxRate] = useState(1) // 1 EUR = ? USD
  const [savingsGoals, setSavingsGoals] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [ledgerFormRequested, setLedgerFormRequested] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [milestones, setMilestones] = useState([
    { id: '10k', label: 'Primeros 10K €', target: 10000, type: 'capital' },
    { id: '50k', label: 'Ecuador de los 100K', target: 50000, type: 'capital' },
    { id: '100k', label: 'Hito de los 100K €', target: 100000, type: 'capital' },
    { id: 'gas', label: 'Gasolina Anual Pagada', target: 1440, type: 'passive' },
    { id: 'rent', label: 'Alquiler Anual Pagado', target: 12000, type: 'passive' }
  ])
  
  const formatCurrency = (value, currency = 'EUR') => {
    const num = Number(value)
    if (isNaN(num)) return '0,00 ' + (currency === 'EUR' ? '€' : (currency === 'BTC' ? 'BTC' : '$'))
    
    if (currency === 'BTC') {
      return num.toLocaleString('es-ES', { 
        minimumFractionDigits: 8, 
        maximumFractionDigits: 8 
      }) + ' BTC'
    }

    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(num)
  }

  const formatNumber = (value) => {
    const num = Number(value)
    if (isNaN(num)) return '0,00'
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
      useGrouping: true
    }).format(num)
  }

  const formatPercent = (value) => {
    const num = Number(value)
    if (isNaN(num)) return '0,00'
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(num)
  }

  // Load profile and milestones IMMEDIATELY and independently on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedProfile = await window.api.getConfig('user_profile');
        const defaultProfile = {
          risk: null, horizon: null, initialCapital: 10000, monthlySavings: 500,
          targetMonthlyExpenses: 2000, projectionExpectedYield: 7, projectionMonthlySavings: 500,
          projectionInitialCapital: 0, q1Target: 1000, q2Target: 1000, q3Target: 1000, q4Target: 1000,
          annualYieldTarget: 8, annualInitialCapital: 57000, baselineValue: 57000, completed: false
        };

        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setUserProfile({ ...defaultProfile, ...parsed });
        } else {
          setUserProfile(defaultProfile);
        }
        
        const savedMilestones = await window.api.getConfig('user_milestones');
        if (savedMilestones) {
          setMilestones(JSON.parse(savedMilestones));
        }
      } catch (e) {
        console.warn('Config load failed:', e);
      }
    };
    loadConfig();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      let ents = [], txns = [], cats = [], types = [], goals = [];
      
      try {
        ents = await window.api.getEntities();
        txns = await window.api.getTransactions();
        cats = await window.api.getCategories();
        types = await window.api.getAssetTypes();
        goals = await window.api.getSavingsGoals();
      } catch (e) {
        console.error('Data fetch failed:', e);
      }
      
      // If DB is empty or call failed, use fallbacks from constants
      const finalCats = cats && cats.length > 0 ? cats : Object.entries(MACRO_COLORS).map(([name, color], id) => ({ id: id + 1, name, color }))
      
      const finalTypes = types && types.length > 0 ? types : ASSET_TYPES.map((name, id) => {
        const catName = MACRO_CATS[name] || 'Otros'
        const cat = finalCats.find(c => c.name === catName)
        return {
          id: id + 1,
          name,
          categoryId: cat ? cat.id : null,
          color: TYPE_COLORS[name] || '#B0B0B0'
        }
      })

      setEntities(ents || [])
      setTransactions(txns || [])
      setCategories(finalCats)
      setAssetTypes(finalTypes)
      setSavingsGoals(goals || [])

      const symbols = txns ? [...new Set(txns.map(t => t.symbol).filter(Boolean))] : []
      const symbolsToFetch = [...symbols, 'EURUSD=X']
      
      if (symbolsToFetch.length > 0) {
        const results = await window.api.getQuotes(symbolsToFetch)
        const newQuotes = {}
        let newFxRate = 1

        results.forEach(res => {
          if (!res) return
          if (res.symbol === 'EURUSD=X') {
            newFxRate = res.regularMarketPrice || 1
          } else {
            newQuotes[res.symbol] = {
              price: res.regularMarketPrice,
              currency: res.currency || 'EUR',
              shortName: res.shortName
            }
          }
        })
        setQuotes(newQuotes)
        setFxRate(newFxRate)
      }

      // Fetch Snapshots
      const snps = await window.api.getSnapshots()
      setSnapshots(snps || [])
    } catch (e) {
      console.error('Failed to fetch data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const refreshPrices = async () => {
    setLoading(true)
    await fetchData()
  }

  const updateProfile = async (newProfile) => {
    console.log('DataContext: Actualizando perfil...', newProfile);
    const updated = { ...userProfile, ...newProfile, completed: true };
    setUserProfile(updated);
    try {
      await window.api.saveConfig('user_profile', JSON.stringify(updated));
      console.log('DataContext: Perfil guardado con éxito');
    } catch (e) {
      console.error('DataContext: Error al guardar perfil', e);
    }
  };

  const takeSnapshot = async (data) => {
    try {
      await window.api.saveSnapshot(data)
      const snps = await window.api.getSnapshots()
      setSnapshots(snps || [])
    } catch (e) {
      console.error('Failed to take snapshot:', e)
    }
  }

  const value = {
    entities,
    transactions,
    categories,
    assetTypes,
    quotes,
    fxRate,
    loading,
    formatCurrency,
    formatNumber,
    formatPercent,
    refreshPrices,
    userProfile,
    updateProfile,
    ledgerFormRequested,
    setLedgerFormRequested,
    
    // Savings Goals
    savingsGoals,
    addSavingsGoal: async (g) => { await window.api.addSavingsGoal(g); await fetchData(); },
    editSavingsGoal: async (g) => { await window.api.editSavingsGoal(g); await fetchData(); },
    deleteSavingsGoal: async (id) => { await window.api.deleteSavingsGoal(id); await fetchData(); },
    recordSavingsContribution: async (goalId, amount) => { await window.api.addSavingsContribution({ goalId, amount }); await fetchData(); },
    getGoalContributions: (goalId = null) => window.api.getSavingsContributions(goalId),
    
    // Entities CRUD
    addEntity: async (e) => { await window.api.addEntity(e); await fetchData(); },
    editEntity: async (e) => { await window.api.editEntity(e); await fetchData(); },
    deleteEntity: async (id) => { await window.api.deleteEntity(id); await fetchData(); },
    
    // Transactions CRUD
    addTransaction: async (t) => { await window.api.addTransaction(t); await fetchData(); },
    editTransaction: async (t) => { await window.api.editTransaction(t); await fetchData(); },
    deleteTransaction: async (id) => { await window.api.deleteTransaction(id); await fetchData(); },

    // Categories CRUD
    addCategory: async (c) => { await window.api.addCategory(c); await fetchData(); },
    editCategory: async (c) => { await window.api.editCategory(c); await fetchData(); },
    deleteCategory: async (id) => { await window.api.deleteCategory(id); await fetchData(); },

    // Asset Types CRUD
    addAssetType: async (at) => { await window.api.addAssetType(at); await fetchData(); },
    editAssetType: async (at) => { await window.api.editAssetType(at); await fetchData(); },
    deleteAssetType: async (id) => { await window.api.deleteAssetType(id); await fetchData(); },

    // Milestones Management
    milestones,
    addMilestone: async (m) => {
      const updated = [...milestones, { ...m, id: Date.now().toString() }]
      setMilestones(updated)
      await window.api.saveConfig('user_milestones', JSON.stringify(updated))
    },
    removeMilestone: async (id) => {
      const updated = milestones.filter(m => m.id !== id)
      setMilestones(updated)
      await window.api.saveConfig('user_milestones', JSON.stringify(updated))
    },
    resetMilestones: async () => {
      const defaults = [
        { id: '10k', label: 'Primeros 10K €', target: 10000, type: 'capital' },
        { id: '50k', label: 'Ecuador de los 100K', target: 50000, type: 'capital' },
        { id: '100k', label: 'Hito de los 100K €', target: 100000, type: 'capital' },
        { id: 'gas', label: 'Gasolina Anual Pagada', target: 1440, type: 'passive' },
        { id: 'rent', label: 'Alquiler Anual Pagado', target: 12000, type: 'passive' }
      ]
      setMilestones(defaults)
      await window.api.saveConfig('user_milestones', JSON.stringify(defaults))
    },

    // Snapshots
    snapshots,
    takeSnapshot,

    // Advanced / Maintenance
    resetAllData: async () => {
      await window.api.resetAllData()
      await fetchData()
    },
    bulkAddTransactions: async (txns) => {
      // We process them one by one for now but we could optimize in main process if needed
      for (const t of txns) {
        await window.api.addTransaction(t)
      }
      await fetchData()
    }
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
