import React, { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Wallet, 
  BarChart3, 
  PieChart as PieIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from 'recharts'
import { clsx } from 'clsx'

export default function AssetsView() {
  const { 
    transactions, quotes, fxRate, formatCurrency, formatNumber, formatPercent,
    categories, assetTypes 
  } = useData()
  const [activeTab, setActiveTab] = useState('Todas')
  const [viewMode, setViewMode] = useState('General')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'))
  const [isYearOpen, setIsYearOpen] = useState(false)
  const [isMonthOpen, setIsMonthOpen] = useState(false)

  const yearOptions = useMemo(() => {
    const years = new Set()
    transactions?.forEach(t => {
      if (t.date) years.add(t.date.substring(0, 4))
    })
    years.add(new Date().getFullYear().toString())
    return Array.from(years).sort().reverse()
  }, [transactions])

  const monthOptions = [
    { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ]


  // --- Data Processing ---
  const assetsMap = {}
  
  // Sort transactions chronologically to ensure history[0] is the start date
  const sortedTxns = [...transactions].sort((a,b) => (a.date || '').localeCompare(b.date || ''))

  const filteredTxns = sortedTxns.filter(t => {
    if (viewMode === 'General') return true
    if (!t.date) return false
    const tYear = t.date.substring(0, 4)
    const tMonth = t.date.substring(5, 7)
    
    if (viewMode === 'Año') return tYear === selectedYear
    if (viewMode === 'Mes') return tYear === selectedYear && tMonth === selectedMonth
    return true
  })

  filteredTxns.forEach(t => {
    const symbol = t.symbol ? t.symbol.toUpperCase() : ''
    const assetKey = symbol || t.name
    if (!assetKey) return

    if (!assetsMap[assetKey]) {
      assetsMap[assetKey] = {
        symbol: symbol,
        name: t.name,
        type: t.assetType,
        yield: t.yield || 0,
        maturityDate: t.maturityDate || null,
        shares: 0,
        invested: 0,
        sold: 0,
        pureInvested: 0,
        pureSold: 0,
        totalPurchasedShares: 0,
        generatedIncome: 0, // Interests + Dividends
        realizedGains: 0,   // Sale profits
        history: [],
        fifoQueue: [] 
      }
    }

    const a = assetsMap[assetKey]
    if (!a.symbol && symbol) a.symbol = symbol
    if (!a.name && t.name) a.name = t.name
    if (!a.type && t.assetType) a.type = t.assetType
    
    // Crucial fix: Update yield and maturityDate if not set or if current transaction has them
    if (t.yield && (!a.yield || a.yield == 0)) a.yield = t.yield
    if (t.maturityDate && !a.maturityDate) a.maturityDate = t.maturityDate

    const mult = (t.operation === 'Venta') ? -1 : 1
    const val = t.total || (t.shares * t.unitPrice) || 0
    const sharesNum = t.shares || 0

    if (t.operation === 'Compra' || t.operation === 'Saldo Inicial' || t.operation === 'Venta') {
      a.shares += (sharesNum * mult)
      if (mult > 0) {
        a.invested += val
        a.pureInvested += (sharesNum * (t.unitPrice || 0))
        a.totalPurchasedShares += sharesNum
        a.fifoQueue.push({ shares: sharesNum, cost: val })
      } else {
        a.sold += val
        a.pureSold += (sharesNum * (t.unitPrice || 0))
        
        // FIFO Gain Calculation
        let sharesToSell = sharesNum
        let costBasisForSale = 0
        while (sharesToSell > 0.000001 && a.fifoQueue.length > 0) {
          let lot = a.fifoQueue[0]
          if (lot.shares <= sharesToSell) {
            costBasisForSale += lot.cost
            sharesToSell -= lot.shares
            a.fifoQueue.shift()
          } else {
            const ratio = sharesToSell / lot.shares
            costBasisForSale += lot.cost * ratio
            lot.cost -= lot.cost * ratio
            lot.shares -= sharesToSell
            sharesToSell = 0
          }
        }
        a.realizedGains += (val - costBasisForSale)
      }
      
      a.history.push({
        date: t.date,
        operation: t.operation,
        value: val * mult,
        shares: a.shares
      })
    } else if (t.operation === 'Intereses' || t.operation === 'Dividendos') {
      a.generatedIncome += val
    }
  })

  const availableTypes = ['Todas', ...assetTypes.map(at => at.name).filter(name => name !== 'Oro')]
  const allAssets = Object.values(assetsMap).filter(a => Math.abs(a.shares) > 0.0001)
  const displayedAssets = activeTab === 'Todas' ? allAssets : allAssets.filter(a => a.type === activeTab)

  // Sort assets: highest value first
  displayedAssets.sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))

  // Metrics Logic
  const totals = displayedAssets.reduce((acc, a) => {
    const qKey = Object.keys(quotes).find(k => k.toUpperCase() === (a.symbol || '').toUpperCase())
    const q = qKey ? quotes[qKey] : {}
    const isUSD = q.currency === 'USD'
    const effectiveFxRate = fxRate || 1.10
    const priceInEUR = isUSD ? (q.price / effectiveFxRate) : (q.price || 0)
    
    const netCost = a.invested - a.sold
    const pureCost = a.pureInvested - a.pureSold
    const currentValue = (a.symbol && q.price) ? (a.shares * priceInEUR) : netCost

    // Enhance asset object with calculated metrics
    a.currentValue = currentValue
    a.marketPrice = (a.symbol && q.price) ? priceInEUR : null
    a.netCost = netCost
    a.avgPrice = a.totalPurchasedShares > 0 ? (a.invested / a.totalPurchasedShares) : 0
    a.totalCashFlow = a.generatedIncome + a.realizedGains
    a.profit = (currentValue - netCost) + a.totalCashFlow
    a.profitPct = netCost > 1 ? (a.profit / netCost) * 100 : 0
    a.ytdProfit = a.profit 
    
    // Fixed asset specific logic
    const assetTypeObj = assetTypes.find(at => at.name === a.type)
    const categoryObj = assetTypeObj ? categories.find(c => c.id === assetTypeObj.categoryId) : null
    
    const isFixed = categoryObj && ['Depósitos', 'Bonos/Letras', 'Inmobiliario', 'Capital Privado', 'Renta Fija'].includes(categoryObj.name)
    
    if (isFixed) {
      const yieldPct = Number(a.yield) || 0
      const principal = Number(a.netCost) || 0
      
      if (['Inmobiliario', 'Capital Privado'].includes(a.type) || !a.maturityDate) {
        a.expectedProfit = principal * (yieldPct / 100)
      } else if (a.maturityDate) {
        const firstTxDate = a.history && a.history.length > 0 ? a.history[0].date : null
        if (firstTxDate) {
          const mDate = new Date(a.maturityDate)
          const sDate = new Date(firstTxDate)
          if (!isNaN(mDate) && !isNaN(sDate)) {
            const days = (mDate - sDate) / (1000 * 60 * 60 * 24)
            const years = Math.max(0, days / 365.25)
            a.expectedProfit = principal * (yieldPct / 100) * years
          }
        }
      }
      a.finalValue = a.netCost + (a.expectedProfit || 0)
    }

    acc.currentValue += a.currentValue
    acc.invested += a.netCost
    acc.profit += a.profit
    acc.totalCashFlow += a.totalCashFlow
    acc.expectedProfitTotal += (a.expectedProfit || 0)
    return acc
  }, { currentValue: 0, invested: 0, profit: 0, expectedProfitTotal: 0, totalCashFlow: 0 })

  const totalProfitPct = totals.invested > 1 ? (totals.profit / totals.invested) * 100 : 0

  return (
    <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Mis Activos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gestión y seguimiento detallado de tu patrimonio</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Total Cartera</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(totals.currentValue)}</div>
        </div>
      </div>

      {/* Organic & Fluid Time Period Selector with Popovers */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0, 
        marginBottom: 40,
        background: 'var(--panel-bg)',
        padding: '6px',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        width: 'fit-content',
        boxShadow: 'var(--glass-shadow)',
        position: 'relative'
      }}>
        {/* Icon / Label */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 14px', 
          color: 'var(--text-muted)',
          opacity: 0.6,
          borderRight: '1px solid var(--border)',
          marginRight: 6
        }}>
          <Calendar size={18} />
        </div>

        {/* Mode Switcher / Dropdown Triggers */}
        <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
          {/* TODO */}
          <button
            onClick={() => {
              setViewMode('General')
              setIsYearOpen(false)
              setIsMonthOpen(false)
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.3s ease',
              background: viewMode === 'General' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'General' ? '#fff' : 'var(--text-muted)',
              boxShadow: viewMode === 'General' ? '0 4px 12px rgba(100, 100, 255, 0.2)' : 'none'
            }}
          >
            Todo
          </button>

          {/* AÑO POPOVER */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsYearOpen(!isYearOpen)
                setIsMonthOpen(false)
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.3s ease',
                background: viewMode === 'Año' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'Año' ? '#fff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: viewMode === 'Año' ? '0 4px 12px rgba(100, 100, 255, 0.2)' : 'none'
              }}
            >
              {viewMode === 'Año' ? selectedYear : 'Año'}
              <ChevronDown size={14} style={{ opacity: 0.6, transform: isYearOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </button>

            {isYearOpen && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                zIndex: 100,
                minWidth: 120,
                padding: 6,
                borderRadius: 14,
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                animation: 'fadeUp 0.2s ease-out'
              }}>
                {yearOptions.map(y => (
                  <div 
                    key={y}
                    onClick={() => {
                      setSelectedYear(y)
                      setViewMode('Año')
                      setIsYearOpen(false)
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: selectedYear === y && viewMode === 'Año' ? 'rgba(100, 100, 255, 0.1)' : 'transparent',
                      color: selectedYear === y && viewMode === 'Año' ? 'var(--accent)' : 'var(--text-main)',
                    }}
                    className="menu-item-hover"
                  >
                    {y}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MES POPOVER */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsMonthOpen(!isMonthOpen)
                setIsYearOpen(false)
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.3s ease',
                background: viewMode === 'Mes' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'Mes' ? '#fff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: viewMode === 'Mes' ? '0 4px 12px rgba(100, 100, 255, 0.2)' : 'none'
              }}
            >
              {viewMode === 'Mes' ? `${monthOptions.find(m => m.value === selectedMonth).label} ${selectedYear}` : 'Mes'}
              <ChevronDown size={14} style={{ opacity: 0.6, transform: isMonthOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </button>

            {isMonthOpen && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                zIndex: 100,
                minWidth: 160,
                maxHeight: 300,
                overflowY: 'auto',
                padding: 6,
                borderRadius: 14,
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                animation: 'fadeUp 0.2s ease-out'
              }}>
                <div style={{ padding: '4px 10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Seleccionar Mes</div>
                {monthOptions.map(m => (
                  <div 
                    key={m.value}
                    onClick={() => {
                      setSelectedMonth(m.value)
                      setViewMode('Mes')
                      setIsMonthOpen(false)
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: selectedMonth === m.value && viewMode === 'Mes' ? 'rgba(100, 100, 255, 0.1)' : 'transparent',
                      color: selectedMonth === m.value && viewMode === 'Mes' ? 'var(--accent)' : 'var(--text-main)',
                    }}
                    className="menu-item-hover"
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 32, 
        overflowX: 'auto', 
        paddingBottom: 4,
        WebkitOverflowScrolling: 'touch'
      }}>
        {availableTypes.map(typ => {
          const isActive = activeTab === typ
          const assetTypeObj = assetTypes.find(at => at.name === typ)
          const color = assetTypeObj ? assetTypeObj.color : (categories.find(c => c.name === typ)?.color || 'var(--accent)')
          return (
            <button 
              key={typ} 
              onClick={() => setActiveTab(typ)}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                background: isActive ? color : 'var(--panel-bg)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                border: isActive ? `1px solid ${color}` : '1px solid var(--border)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: isActive ? `0 4px 12px ${color}40` : 'none'
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#fff' : color }} />
              {typ}
            </button>
          )
        })}
      </div>

      {/* Enhanced Summary Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 40 }}>
        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-title">Valor Actual</div>
            <Wallet size={16} className="text-muted" style={{ opacity: 0.5 }} />
          </div>
          <div className="metric-value" style={{ marginTop: 8 }}>{formatCurrency(totals.currentValue)}</div>
        </div>

        <div className="metric-card glass-panel" style={{ borderLeft: `4px solid ${totals.profit >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-title">Rentabilidad Actual</div>
            {totals.profit >= 0 ? <TrendingUp size={16} color="var(--success)" /> : <TrendingDown size={16} color="var(--danger)" />}
          </div>
          <div className={`metric-value ${totals.profit >= 0 ? 'metric-positive' : 'metric-negative'}`} style={{ marginTop: 8 }}>
            {totals.profit > 0 ? '+' : ''}{formatCurrency(totals.profit)}
            <span style={{ fontSize: 14, marginLeft: 8, opacity: 0.8 }}>({formatPercent(totalProfitPct)}%)</span>
          </div>
          {totals.expectedProfitTotal > 0 && (
             <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                Estimado a vencimiento: <strong style={{ color: 'var(--success)' }}>+{formatCurrency(totals.expectedProfitTotal)}</strong>
             </div>
          )}
        </div>

        <div className="metric-card glass-panel" style={{ borderLeft: '4px solid #A29BBD' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="metric-title">Inversión Neta</div>
            <BarChart3 size={16} className="text-muted" style={{ opacity: 0.5 }} />
          </div>
          <div className="metric-value" style={{ marginTop: 8 }}>{formatCurrency(totals.invested)}</div>
        </div>
      </div>

      {/* Assets Premium List */}
      <h2 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detalle de Posiciones</h2>
      
      <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: 40 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>ACTIVO</th>
                {displayedAssets.some(a => ['Depósitos', 'Bonos/Letras', 'Inmobiliario', 'Capital Privado'].includes(a.type)) && (
                  <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>ESTADO / PROGRESO</th>
                )}
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>PARTICIPACIONES / INF.</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>INVERSIÓN NETA</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>VALOR ACTUAL</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>FLUJO CAJA</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>RENTABILIDAD</th>
              </tr>
            </thead>
            <tbody>
              {displayedAssets.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                      <Info size={24} style={{ marginBottom: 8 }} />
                      <span>No hay activos en esta categoría</span>
                    </div>
                  </td>
                </tr>
              )}
              {displayedAssets.map((a, idx) => {
                const assetTypeObj = assetTypes.find(at => at.name === a.type)
                const categoryObj = assetTypeObj ? categories.find(c => c.id === assetTypeObj.categoryId) : null
                const color = assetTypeObj ? assetTypeObj.color : 'var(--accent)'
                const isFixed = categoryObj && ['Depósitos', 'Bonos/Letras', 'Inmobiliario', 'Capital Privado', 'Renta Fija'].includes(categoryObj.name)
                
                // Progress calculation
                let progress = 0
                let daysLeft = null
                if (a.maturityDate) {
                  // Use local date parsing (YYYY-MM-DD + T00:00:00) to avoid timezone shifts
                  const start = new Date(a.history[0]?.date + 'T00:00:00')
                  const end = new Date(a.maturityDate + 'T00:00:00')
                  const now = new Date()
                  now.setHours(0, 0, 0, 0)
                  
                  const totalDiff = end.getTime() - start.getTime()
                  const elapsedDiff = now.getTime() - start.getTime()
                  
                  if (totalDiff > 0) {
                    progress = Math.min(100, Math.max(0, (elapsedDiff / totalDiff) * 100))
                  } else if (now >= end) {
                    progress = 100
                  }
                  
                  daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24))
                }

                return (
                  <tr key={a.symbol || a.name} className="list-row-hover" style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 4, height: 24, borderRadius: 2, background: color }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{a.symbol || a.type}</div>
                        </div>
                      </div>
                    </td>
                    {displayedAssets.some(a => ['Depósitos', 'Bonos/Letras', 'Inmobiliario', 'Capital Privado'].includes(a.type)) && (
                      <td style={{ padding: '16px 20px' }}>
                        {isFixed && a.maturityDate ? (
                          <div style={{ width: 140 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>{daysLeft > 0 ? `${daysLeft}d restantes` : 'Vencido'}</span>
                              <span style={{ fontWeight: 600 }}>
                                {progress > 0 && progress < 100 ? progress.toFixed(2) : Math.round(progress)}%
                              </span>
                            </div>
                            <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: color }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.3 }}>-</span>
                          </div>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{isFixed ? `${a.yield}% ${a.type === 'Inmobiliario' ? 'Total' : 'Anual'}` : formatNumber(a.shares)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {isFixed ? 'Rentabilidad pactada' : (
                          <>
                            {a.marketPrice > 0 && (
                              <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: 4 }}>
                                Cotización: {formatCurrency(a.marketPrice)}
                              </div>
                            )}
                            {!isFixed && a.avgPrice > 0 && (
                              <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                                Precio Medio: {formatCurrency(a.avgPrice)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{formatCurrency(a.netCost)}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(a.currentValue)}</div>
                      {isFixed && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Vence: {new Date(a.maturityDate).toLocaleDateString('es-ES')}</div>}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: a.totalCashFlow > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatCurrency(a.totalCashFlow)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {a.generatedIncome > 0 && <span>{a.type === 'Bonos/Letras' || a.type === 'Depósitos' ? 'Intereses' : 'Dividendos'}: {formatCurrency(a.generatedIncome)}</span>}
                        {a.realizedGains !== 0 && <span>P. Venta: {formatCurrency(a.realizedGains)}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 700, 
                        color: a.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 4
                      }}>
                        {a.profit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {formatCurrency(Math.abs(a.profit))}
                      </div>
                      <div style={{ fontSize: 11, color: a.profit >= 0 ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
                        {formatPercent(a.profitPct)}%
                      </div>
                      {isFixed && a.expectedProfit > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                          Esperado: +{formatCurrency(a.expectedProfit)}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .list-row-hover {
          transition: background 0.2s ease;
        }
        .list-row-hover:hover {
          background: rgba(0, 0, 0, 0.02);
        }
        [data-theme='dark'] .list-row-hover:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .menu-item-hover:hover {
          background: rgba(126, 145, 177, 0.1) !important;
        }
        .glass-panel {
           backdrop-filter: blur(12px);
           -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  )
}
