import React, { useState, useMemo, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { RefreshCw, Calendar, Info, Eye, EyeOff } from 'lucide-react'
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList, Line, ReferenceLine,
  ComposedChart
} from 'recharts'
import { clsx } from 'clsx'
import { ENTITY_COLORS } from '../utils/constants'

const CustomTooltip = ({ active, payload, formatCurrency, formatNumber, formatPercent }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '12px', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--glass-shadow)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
          {data.date === 'Hoy' ? 'Estado Actual' : new Date(data.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>{entry.name}:</span>
            <span style={{ fontWeight: 700, color: entry.color || 'var(--text-main)' }}>{formatCurrency(entry.value)}</span>
          </div>
        ))}
        {data.totalValue && data.costBasis && (
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Rendimiento:</span>
            <span style={{ fontWeight: 700, color: (data.totalValue - data.costBasis) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(data.totalValue - data.costBasis)} ({formatPercent(((data.totalValue / data.costBasis) - 1) * 100)}%)
            </span>
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function DashboardView() {
  const { 
    transactions, quotes, entities, loading, refreshPrices, fxRate, formatCurrency, formatNumber, formatPercent,
    categories, assetTypes, userProfile, snapshots, takeSnapshot, isPrivate, setIsPrivate
  } = useData()
  
  // Estado Global de Filtrado para Gráficas
  const [globalPeriod, setGlobalPeriod] = useState('ALL') // ALL, 1Y, 1M
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [hoveredMacro, setHoveredMacro] = useState(null)

  // --- Metrics Calculation ---
  let netWorth = 0
  let totalInterestDividends = 0
  let totalRealizedGains = 0
  let ytdRealizedGains = 0
  let ytdAportacionesTotal = 0
  let ytdIncomeTotal = 0

  const currentYear = new Date().getFullYear().toString()
  const jan1DateStr = `${currentYear}-01-01`

  const assetAllocationMap = {}
  const entityAllocationMap = {}
  const intDivHistoryMap = {}
  const macroAllocationMap = {}
  const entityAssetMap = {}
  const fifoQueues = {}

  const sortedTxns = [...transactions].sort((a,b) => a.date.localeCompare(b.date))

  sortedTxns.forEach(t => {
    const isIncome = t.operation === 'Intereses' || t.operation === 'Dividendos';
    const isCurrentYear = t.date && t.date >= jan1DateStr;

    if (isIncome) {
      totalInterestDividends += t.total
      if (isCurrentYear) {
        ytdIncomeTotal += t.total
        if (!intDivHistoryMap[t.date]) intDivHistoryMap[t.date] = { date: t.date, dividends: 0, interests: 0, gain: 0 }
        if (t.operation === 'Dividendos') intDivHistoryMap[t.date].dividends += t.total
        else intDivHistoryMap[t.date].interests += t.total
      }
      return
    }

    const symbol = (t.symbol || t.name || '').toUpperCase();
    const sharesNum = t.shares || 0;
    const val = t.total || (t.shares * t.unitPrice) || 0;
    const mult = (t.operation === 'Venta' || t.operation === 'Retirada') ? -1 : 1;

    const key = `${t.entityId}_${symbol}`;
    if (!entityAssetMap[key]) entityAssetMap[key] = { entityId: t.entityId, symbol: symbol, shares: 0, invested: 0, sold: 0 };
    entityAssetMap[key].shares += (sharesNum * mult);
    if (mult > 0) entityAssetMap[key].invested += val;
    else entityAssetMap[key].sold += val;

    if (t.symbol && (t.operation === 'Compra' || t.operation === 'Venta' || t.operation === 'Saldo Inicial')) {
      if (!fifoQueues[symbol]) fifoQueues[symbol] = []
      if (t.operation === 'Compra' || t.operation === 'Saldo Inicial') {
        fifoQueues[symbol].push({ shares: t.shares, costBasisEUR: t.total / (t.shares || 1) })
      } else if (t.operation === 'Venta') {
        let sharesToSell = t.shares; let costBasisTotal = 0;
        while (sharesToSell > 0.000001 && fifoQueues[symbol].length > 0) {
          let lot = fifoQueues[symbol][0]
          if (lot.shares <= sharesToSell) {
            costBasisTotal += lot.shares * lot.costBasisEUR; sharesToSell -= lot.shares; fifoQueues[symbol].shift();
          } else {
            costBasisTotal += sharesToSell * lot.costBasisEUR; lot.shares -= sharesToSell; sharesToSell = 0;
          }
        }
        const saleGain = t.total - costBasisTotal
        if (!intDivHistoryMap[t.date]) intDivHistoryMap[t.date] = { date: t.date, dividends: 0, interests: 0, gain: 0 }
        intDivHistoryMap[t.date].gain += saleGain
        totalRealizedGains += saleGain
        if (isCurrentYear) ytdRealizedGains += saleGain
      }
    }

    if (isCurrentYear && t.operation !== 'Saldo Inicial') {
      ytdAportacionesTotal += (val * mult);
    }
  })

  let totalContributions = 0
  let currentPortfolioCostBasis = 0

  Object.values(entityAssetMap).forEach(data => {
    const qKey = Object.keys(quotes).find(k => k.toUpperCase() === data.symbol)
    const q = qKey ? quotes[qKey] : {}
    const livePrice = (q.currency === 'USD' ? (q.price / (fxRate || 1.1)) : (q.price || 0))
    const currentAssetValue = (data.symbol && q.price) ? (data.shares * livePrice) : (data.invested - data.sold)
    
    if (currentAssetValue > 0.01) {
      netWorth += currentAssetValue
      currentPortfolioCostBasis += (data.invested - data.sold)
      
      if (!entityAllocationMap[data.entityId]) entityAllocationMap[data.entityId] = { id: data.entityId, value: 0 }
      entityAllocationMap[data.entityId].value += currentAssetValue
      
      const sample = transactions.find(t => (t.symbol || t.name || '').toUpperCase() === data.symbol) || { assetType: 'Otros' }
      const assetTypeObj = assetTypes.find(at => at.name === sample.assetType)
      const categoryObj = assetTypeObj ? categories.find(c => c.id === assetTypeObj.categoryId) : null
      const macroName = categoryObj ? categoryObj.name : 'Otros'
      
      if (!assetAllocationMap[sample.assetType]) {
        assetAllocationMap[sample.assetType] = { 
          name: sample.assetType, macro: macroName, macroColor: categoryObj?.color || '#B0B0B0',
          color: assetTypeObj ? assetTypeObj.color : '#B0B0B0', value: 0 
        }
      }
      assetAllocationMap[sample.assetType].value += currentAssetValue

      if (!macroAllocationMap[macroName]) {
        macroAllocationMap[macroName] = { name: macroName, color: categoryObj?.color || '#B0B0B0', value: 0 }
      }
      macroAllocationMap[macroName].value += currentAssetValue
    }
    totalContributions += (data.invested - data.sold)
  })

  const unrealizedGain = netWorth - currentPortfolioCostBasis
  const totalProfit = unrealizedGain + totalInterestDividends + totalRealizedGains
  const totalProfitPct = currentPortfolioCostBasis > 1 ? (totalProfit / currentPortfolioCostBasis) * 100 : 0

  const lastYearSnapshot = [...snapshots].reverse().find(s => s.date < jan1DateStr)
  let ytdProfit = 0
  if (lastYearSnapshot) {
    ytdProfit = netWorth - lastYearSnapshot.netWorth - ytdAportacionesTotal + ytdIncomeTotal
  } else {
    ytdProfit = totalProfit
  }
  const ytdProfitPct = lastYearSnapshot ? ((ytdProfit / (totalContributions - ytdAportacionesTotal)) * 100) : totalProfitPct



  // --- Snapshot Logic ---
  useEffect(() => {
    const runSnapshots = async () => {
      if (loading || netWorth <= 0 || transactions.length === 0) return
      const todayStr = new Date().toISOString().split('T')[0]
      const firstDate = new Date(sortedTxns[0].date)
      const missing = []
      let curr = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0)
      while (curr < new Date()) {
        const d = curr.toISOString().split('T')[0]
        if (!snapshots.find(s => s.date === d)) missing.push(d)
        curr = new Date(curr.getFullYear(), curr.getMonth() + 2, 0)
      }
      if (missing.length > 0) {
        for (const date of missing) {
          const pastTxns = transactions.filter(t => t.date <= date)
          let histNW = 0, histCB = 0
          const assetsAtDate = {}
          pastTxns.forEach(t => {
            if (!t.symbol) return
            const sym = t.symbol.toUpperCase()
            if (!assetsAtDate[sym]) assetsAtDate[sym] = { shares: 0, cost: 0 }
            const m = (t.operation === 'Venta' || t.operation === 'Retirada') ? -1 : 1
            assetsAtDate[sym].shares += (t.shares || 0) * m
            if (m > 0) assetsAtDate[sym].cost += (t.total || (t.shares * t.unitPrice))
            else {
              const prev = assetsAtDate[sym].shares - (t.shares * m)
              if (prev > 0) assetsAtDate[sym].cost -= (assetsAtDate[sym].cost * (Math.abs(t.shares)/prev))
            }
          })
          for (const [sym, d] of Object.entries(assetsAtDate)) {
            if (d.shares > 0.001) {
              const p = await window.api.getHistoricalPrice(sym, date)
              histNW += (d.shares * (p || 0))
              histCB += d.cost
            }
          }
          if (histNW > 0) await takeSnapshot({ date, netWorth: histNW, costBasis: histCB, unrealizedGain: histNW - histCB })
        }
      }
      const todaySnap = snapshots.find(s => s.date === todayStr)
      if (!todaySnap || Math.abs(todaySnap.netWorth - netWorth) > 1) {
        await takeSnapshot({ date: todayStr, netWorth, costBasis: currentPortfolioCostBasis, unrealizedGain: netWorth - currentPortfolioCostBasis })
      }
    }
    runSnapshots()
  }, [loading, netWorth, snapshots.length, transactions.length])

  // --- Chart Data ---
  const chartData = useMemo(() => {
    let pts = snapshots.map(s => ({
      date: s.date, costBasis: s.costBasis, totalValue: s.costBasis + s.unrealizedGain
    })).sort((a, b) => a.date.localeCompare(b.date))
    
    if (transactions.length > 0) {
      const firstDate = sortedTxns[0].date
      if (pts.length === 0 || pts[0].date > firstDate) {
        pts = [{ date: firstDate, costBasis: 0, totalValue: 0 }, ...pts]
      }
      const todayStr = new Date().toISOString().split('T')[0]
      if (pts.length > 0 && pts[pts.length-1].date !== todayStr && pts[pts.length-1].date !== 'Hoy') {
        pts.push({ date: 'Hoy', costBasis: currentPortfolioCostBasis, totalValue: netWorth })
      }
    }

    const now = new Date()
    if (globalPeriod === '1Y') {
      pts = pts.filter(p => {
        if (p.date === 'Hoy') return new Date().getFullYear() === selectedYear
        return new Date(p.date).getFullYear() === selectedYear
      })
    } else if (globalPeriod === '1M') {
      pts = pts.filter(p => {
        const date = p.date === 'Hoy' ? new Date() : new Date(p.date)
        return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth
      })
    }
    
    return pts
  }, [snapshots, transactions, netWorth, currentPortfolioCostBasis, globalPeriod, selectedYear, selectedMonth])

  const nestedMacroData = Object.values(macroAllocationMap).map(m => ({
    ...m,
    percentRef: (m.value / netWorth) * 100,
    assets: Object.values(assetAllocationMap).filter(a => a.macro === m.name)
  })).sort((a,b) => b.value - a.value)

  const entityPieData = Object.values(entityAllocationMap).map(v => ({
    name: entities.find(e => e.id == v.id)?.name || '?', value: v.value, percentRef: (v.value / netWorth) * 100
  })).sort((a,b) => b.value - a.value)

  // Filtrado de historial de intereses/dividendos según periodo seleccionado
  const filteredIntDivData = useMemo(() => {
    let data = Object.values(intDivHistoryMap)
    
    if (globalPeriod === '1Y') {
      data = data.filter(d => new Date(d.date).getFullYear() === selectedYear)
    } else if (globalPeriod === '1M') {
      data = data.filter(d => {
        const date = new Date(d.date)
        return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth
      })
    }
    
    return data.sort((a, b) => a.date.localeCompare(b.date))
  }, [intDivHistoryMap, globalPeriod, selectedYear, selectedMonth])

  const totalRealizedPeriod = useMemo(() => {
    return filteredIntDivData.reduce((acc, curr) => acc + curr.dividends + curr.interests, 0)
  }, [filteredIntDivData])

  const intDivHistoryData = filteredIntDivData // Mantener compatibilidad de nombre si se usa abajo

  const ENTITY_DEFAULT_COLORS = ['#A7C7E7', '#C1E1C1', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C5CBE3', '#E0BBE4']

  return (
    <div style={{ animation: 'fadeUp 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Panel de Control</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setIsPrivate(!isPrivate)} title={isPrivate ? "Mostrar valores" : "Ocultar valores"}>
            {isPrivate ? <Eye size={16} /> : <EyeOff size={16} />}
            {isPrivate ? 'Mostrar' : 'Ocultar'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              refreshPrices()
              if (window.addToast) window.addToast('Actualizando precios de mercado...', 'info')
            }} 
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Actualizando...' : 'Actualizar Precios'}
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card glass-panel v5-hover-effect">
          <div className="metric-title">Valor de la Cartera</div>
          {loading ? <div className="skeleton" style={{ height: 34, width: '80%', marginTop: 8 }} /> : (
            <div className="metric-value metric-hero" style={{ filter: isPrivate ? 'blur(8px)' : 'none', transition: 'filter 0.3s' }}>{formatCurrency(netWorth)}</div>
          )}
        </div>
        <div className="metric-card glass-panel v5-hover-effect">
          <div className="metric-title">Inversión Histórica</div>
          {loading ? <div className="skeleton" style={{ height: 34, width: '70%', marginTop: 8 }} /> : (
            <div className="metric-value" style={{ filter: isPrivate ? 'blur(8px)' : 'none', transition: 'filter 0.3s' }}>{formatCurrency(totalContributions)}</div>
          )}
        </div>
        <div className="metric-card glass-panel v5-hover-effect">
          <div className="metric-title">Rendimiento Total</div>
          {loading ? <div className="skeleton" style={{ height: 34, width: '90%', marginTop: 8 }} /> : (
            <div className={`metric-value ${totalProfit >= 0 ? 'metric-positive' : 'metric-negative'}`} style={{ filter: isPrivate ? 'blur(8px)' : 'none', transition: 'filter 0.3s' }}>
              {formatCurrency(totalProfit)} <span className="metric-percentage">({formatPercent(totalProfitPct)}%)</span>
            </div>
          )}
        </div>
        <div className="metric-card glass-panel v5-hover-effect">
          <div className="metric-title">Rendimiento (Año)</div>
          {loading ? <div className="skeleton" style={{ height: 34, width: '60%', marginTop: 8 }} /> : (
            <div className={`metric-value ${ytdProfit >= 0 ? 'metric-positive' : 'metric-negative'}`} style={{ filter: isPrivate ? 'blur(8px)' : 'none', transition: 'filter 0.3s' }}>
              {formatCurrency(ytdProfit)} <span className="metric-percentage">({formatPercent(ytdProfitPct)}%)</span>
            </div>
          )}
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="glass-panel" style={{ padding: '20px 24px', minHeight: 340 }}>
          <h3 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, opacity: 0.8 }}>DISTRIBUCIÓN DE PATRIMONIO</h3>
          <div style={{ display: 'flex', height: 24, width: '100%', background: 'var(--bg-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 24, cursor: 'pointer' }}>
            {nestedMacroData.map(m => (
              <div 
                key={m.name} 
                onMouseEnter={() => setHoveredMacro(m.name)}
                onMouseLeave={() => setHoveredMacro(null)}
                style={{ 
                  width: `${m.percentRef}%`, background: m.color,
                  opacity: (hoveredMacro && hoveredMacro !== m.name) ? 0.3 : 1, transition: 'all 0.3s ease'
                }} 
              />
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignItems: 'flex-start' }}>
            {nestedMacroData.map(m => (
              <div 
                key={m.name} 
                onMouseEnter={() => setHoveredMacro(m.name)}
                onMouseLeave={() => setHoveredMacro(null)}
                style={{ 
                  display: 'flex', flexDirection: 'column',
                  padding: hoveredMacro === m.name ? '14px' : '6px',
                  background: hoveredMacro === m.name ? 'var(--bg-subtle)' : 'transparent',
                  borderRadius: 16,
                  border: hoveredMacro === m.name ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  opacity: (hoveredMacro && hoveredMacro !== m.name) ? 0.4 : 1,
                  transition: 'all 0.3s ease',
                  zIndex: hoveredMacro === m.name ? 10 : 1,
                  minWidth: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, marginTop: 4, flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>{m.name}</span>
                    <span style={{ color: '#7E91B1', fontWeight: 700, fontSize: 13, marginTop: 2 }}>{formatCurrency(m.value)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 1 }}>{formatPercent(m.percentRef)}% del total</span>
                  </div>
                </div>
                
                {hoveredMacro === m.name && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 5, animation: 'fadeIn 0.2s ease' }}>
                    {m.assets.sort((a,b) => b.value - a.value).map(asset => (
                      <div key={asset.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{asset.name}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatPercent((asset.value / m.value) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20, minHeight: 340 }}>
          <h3 style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, opacity: 0.8 }}>DISTRIBUCIÓN POR ENTIDAD</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={entityPieData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} fontSize={11} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--glass-shadow)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                {entityPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ENTITY_COLORS[entry.name] || ENTITY_DEFAULT_COLORS[index % ENTITY_DEFAULT_COLORS.length]} />
                ))}
                <LabelList dataKey="percentRef" position="right" formatter={v => `${formatPercent(v)}%`} style={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bloque Unificado de Análisis de Rendimiento */}
      <div className="glass-panel" style={{ marginTop: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Análisis de Rendimiento</h3>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Control global de periodo para evolución y flujos de caja</p>
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="glass-panel" style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--bg-subtle)' }}>
              {[
                { id: 'ALL', label: 'Total' },
                { id: '1Y', label: 'Anual' },
                { id: '1M', label: 'Mensual' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setGlobalPeriod(p.id)}
                  className={clsx('btn-toggle', globalPeriod === p.id && 'active')}
                  style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none',
                    background: globalPeriod === p.id ? '#7E91B1' : 'transparent',
                    color: globalPeriod === p.id ? '#fff' : 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {globalPeriod !== 'ALL' && (
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, padding: '6px 12px', width: 90, color: 'var(--text-main)', outline: 'none' }}
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {globalPeriod === '1M' && (
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(Number(e.target.value))}
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, padding: '6px 12px', width: 110, color: 'var(--text-main)', outline: 'none' }}
              >
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20 }}>
          {/* Gráfica de Evolución */}
          <div className="glass-panel" style={{ padding: 16, height: 320, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.8px' }}>Evolución del Patrimonio</h4>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7E91B1' }} />
                <span style={{ color: 'var(--text-muted)' }}>Capital Invertido</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#65A30D' }} />
                <span style={{ color: 'var(--text-muted)' }}>Valor de Mercado</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="75%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7E91B1" stopOpacity={0.15}/><stop offset="95%" stopColor="#7E91B1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="date" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={d => {
                    if (d === 'Hoy') return d;
                    const dateObj = new Date(d);
                    if (globalPeriod === '1M') return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                    return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit' });
                  }} 
                />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${formatNumber(v/1000)}k€`} />
                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} formatNumber={formatNumber} formatPercent={formatPercent} />} />
                <Area type="monotone" dataKey="costBasis" name="Inversión" stroke="#7E91B1" fill="url(#colorCost)" strokeWidth={1.5} />
                <Line type="monotone" dataKey="totalValue" name="Valor" stroke="#65A30D" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfica de Resultados */}
          <div className="glass-panel" style={{ padding: 16, height: 320, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h4 style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.8px' }}>Resultados Realizados</h4>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Beneficio Periodo</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>+{formatCurrency(totalRealizedPeriod)}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="70%">
              <BarChart data={intDivHistoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickFormatter={d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ fontSize: 11, paddingBottom: 24 }} />
                <RechartsTooltip 
                  formatter={(v, name) => [formatCurrency(v), name === 'gain' ? 'Plusvalías Ventas' : name === 'dividends' ? 'Dividendos' : 'Intereses']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--glass-shadow)' }} 
                />
                <Bar dataKey="dividends" name="Dividendos" fill="#9CAF9C" stackId="a" />
                <Bar dataKey="interests" name="Intereses" fill="#D9CD96" stackId="a" />
                <Bar dataKey="gain" name="Plusvalías Ventas" fill="#A29BBD" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
