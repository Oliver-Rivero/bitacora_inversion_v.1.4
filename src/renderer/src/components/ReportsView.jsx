import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { Download, TrendingUp, History, FileSpreadsheet, FileJson, ArrowUpDown, PieChart } from 'lucide-react'
import { exportLibroMayorExcel, exportLibroMayorCSV, exportDetailedReportPDF } from '../utils/exportUtils'

export default function ReportsView() {
  const { transactions, entities, formatCurrency, formatNumber, formatPercent, fxRate, quotes } = useData()
  
  const currentYear = new Date().getFullYear().toString()
  const [activeTab, setActiveTab] = useState('anual')
  const [isGenerating, setIsGenerating] = useState(false)
  const [detailedReport, setDetailedReport] = useState(null)
  const [annualReport, setAnnualReport] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [baselineDate, setBaselineDate] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(`${currentYear}-01-01`)
  const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0])

  const handleExportExcel = () => {
    const filtered = transactions.filter(t => {
      const fromMatch = filterDateFrom ? t.date >= filterDateFrom : true
      const toMatch = filterDateTo ? t.date <= filterDateTo : true
      return fromMatch && toMatch
    })
    exportLibroMayorExcel(filtered, entities)
  }

  const handleExportCSV = () => {
    const filtered = transactions.filter(t => {
      const fromMatch = filterDateFrom ? t.date >= filterDateFrom : true
      const toMatch = filterDateTo ? t.date <= filterDateTo : true
      return fromMatch && toMatch
    })
    exportLibroMayorCSV(filtered, entities)
  }

  const handleExportPDF = () => {
    if (detailedReport) {
      const period = `${filterDateFrom} a ${filterDateTo}`
      exportDetailedReportPDF(detailedReport, period)
    }
  }

  const generateDetailedReport = async () => {
    setIsGenerating(true)
    setDetailedReport(null)

    try {
      const sortedTxns = [...transactions].sort((a,b) => a.date.localeCompare(b.date))
      const productsMap = {}
      
      sortedTxns.forEach(t => {
        const key = t.symbol || t.name
        if (!key) return
        if (!productsMap[key]) {
          productsMap[key] = {
            key, symbol: t.symbol, name: t.name, assetType: t.assetType,
            currency: t.currency || 'EUR', shares: 0, investedCost: 0,
            startShares: 0, startValue: 0, endShares: 0, endValue: 0,
            buysInRange: 0, salesInRangeCost: 0, salesInRangeTotal: 0,
            dividendsInRange: 0, interestsInRange: 0, realizedGainInRange: 0,
            fifoQueue: []
          }
        }
      })

      const allSymbols = Array.from(new Set(transactions.map(t => t.symbol).filter(Boolean)))
      const symbolsToFetch = [...allSymbols, 'EURUSD=X']
      
      const fetchPricesForDate = async (symbols, date) => {
        const map = {}
        const promises = symbols.map(async (sym) => {
          const price = await window.api.getHistoricalPrice(sym, date)
          map[sym] = price
        })
        await Promise.all(promises)
        return map
      }

      const [startPricesMap, endPricesMap] = await Promise.all([
        fetchPricesForDate(symbolsToFetch, filterDateFrom),
        fetchPricesForDate(symbolsToFetch, filterDateTo)
      ])

      const eurUsdStart = startPricesMap['EURUSD=X'] || 1.10
      const eurUsdEnd = endPricesMap['EURUSD=X'] || fxRate || 1.10

      sortedTxns.forEach(t => {
        const key = t.symbol || t.name
        if (!key) return
        const p = productsMap[key]
        const isBeforeRange = t.date < filterDateFrom
        const inRange = t.date >= filterDateFrom && t.date <= filterDateTo

        if (t.operation === 'Compra' || t.operation === 'Saldo Inicial' || t.operation === 'Venta') {
          const mult = t.operation === 'Venta' ? -1 : 1
          if (t.operation === 'Venta') {
            let sharesToSell = t.shares || 0
            let costBasisOfSale = 0
            while (sharesToSell > 0.000001 && p.fifoQueue.length > 0) {
              let lot = p.fifoQueue[0]
              if (lot.shares <= sharesToSell) {
                costBasisOfSale += lot.shares * lot.costBasisEUR; sharesToSell -= lot.shares; p.fifoQueue.shift()
              } else {
                costBasisOfSale += sharesToSell * lot.costBasisEUR; lot.shares -= sharesToSell; sharesToSell = 0
              }
            }
            if (inRange) {
              p.salesInRangeCost += costBasisOfSale; p.salesInRangeTotal += t.total
              p.realizedGainInRange += (t.total - costBasisOfSale)
            }
          } else {
            const costPerShare = t.shares > 0 ? t.total / t.shares : 0
            p.fifoQueue.push({ shares: t.shares, costBasisEUR: costPerShare })
            if (inRange && t.operation === 'Compra') p.buysInRange += t.total
          }
          p.shares += (t.shares || 0) * mult
          if (isBeforeRange) p.startShares = p.shares
          if (t.date <= filterDateTo) p.endShares = p.shares
        }
        if (inRange) {
          if (t.operation === 'Dividendos') p.dividendsInRange += t.total
          if (t.operation === 'Intereses') p.interestsInRange += t.total
        }
      })

      const categoriesMap = {}
      let globalTotals = { start: 0, end: 0, buys: 0, salesProceeds: 0, realizedGain: 0, dividends: 0, interests: 0, latentGain: 0 }

      Object.values(productsMap).forEach(p => {
        const priceStartRaw = startPricesMap[p.symbol] || 0
        const priceEndRaw = endPricesMap[p.symbol] || 0
        const isUSD = p.currency === 'USD'
        const priceStartEUR = isUSD ? priceStartRaw / eurUsdStart : priceStartRaw
        const priceEndEUR = isUSD ? priceEndRaw / eurUsdEnd : priceEndRaw
        const currentCostBasis = p.fifoQueue.reduce((acc, lot) => acc + (lot.shares * lot.costBasisEUR), 0)
        
        let startCostBasis = 0
        const tempQueue = []
        const productTxns = sortedTxns.filter(t => (t.symbol || t.name) === p.key)
        productTxns.filter(t => t.date < filterDateFrom).forEach(t => {
           if (t.operation === 'Compra' || t.operation === 'Saldo Inicial') {
             tempQueue.push({ shares: t.shares, costBasisEUR: t.shares > 0 ? t.total/t.shares : 0 })
           } else if (t.operation === 'Venta') {
             let toSell = t.shares
             while(toSell > 0 && tempQueue.length > 0) {
               if (tempQueue[0].shares <= toSell) { toSell -= tempQueue[0].shares; tempQueue.shift() }
               else { tempQueue[0].shares -= toSell; toSell = 0 }
             }
           }
        })
        startCostBasis = tempQueue.reduce((acc, lot) => acc + (lot.shares * lot.costBasisEUR), 0)

        p.startValue = p.symbol && priceStartRaw > 0 ? p.startShares * priceStartEUR : startCostBasis
        p.endValue = p.symbol && priceEndRaw > 0 ? p.endShares * priceEndEUR : currentCostBasis
        p.latentGain = p.endValue - (p.startValue + p.buysInRange - p.salesInRangeCost)
        p.totalGain = p.latentGain + p.realizedGainInRange + p.dividendsInRange + p.interestsInRange
        p.gainPct = (p.startValue + p.buysInRange) > 0.01 ? (p.totalGain / (p.startValue + p.buysInRange)) * 100 : 0

        if (Math.abs(p.startValue) < 0.01 && Math.abs(p.endValue) < 0.01 && Math.abs(p.buysInRange) < 0.01 && Math.abs(p.dividendsInRange) < 0.01 && Math.abs(p.interestsInRange) < 0.01 && Math.abs(p.realizedGainInRange) < 0.01) return
        const cat = p.assetType || 'Otros'
        if (!categoriesMap[cat]) categoriesMap[cat] = { name: cat, products: [], startValue: 0, endValue: 0, latentGain: 0, realizedGain: 0, dividends: 0, interests: 0 }
        categoriesMap[cat].products.push(p); categoriesMap[cat].startValue += p.startValue; categoriesMap[cat].endValue += p.endValue; categoriesMap[cat].latentGain += p.latentGain
        categoriesMap[cat].realizedGain += p.realizedGainInRange; categoriesMap[cat].dividends += p.dividendsInRange; categoriesMap[cat].interests += p.interestsInRange
        globalTotals.start += p.startValue; globalTotals.end += p.endValue; globalTotals.buys += p.buysInRange; globalTotals.salesProceeds += p.salesInRangeTotal
        globalTotals.realizedGain += p.realizedGainInRange; globalTotals.dividends += p.dividendsInRange; globalTotals.interests += p.interestsInRange; globalTotals.latentGain += p.latentGain
      })

      setDetailedReport({
        categories: Object.values(categoriesMap).sort((a,b) => b.endValue - a.endValue),
        totals: { 
          ...globalTotals, 
          netFlow: globalTotals.buys - globalTotals.salesProceeds, 
          totalGain: globalTotals.latentGain + globalTotals.realizedGain + globalTotals.dividends + globalTotals.interests, 
          yieldCash: globalTotals.realizedGain + globalTotals.dividends + globalTotals.interests 
        }
      })
    } catch (err) {
      console.error("Report generation failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateAnnualSummary = async () => {
    setIsGenerating(true)
    setAnnualReport(null)
    
    try {
      const isCurrentYear = selectedYear === new Date().getFullYear().toString()
      const from = baselineDate || `${selectedYear}-01-01`
      const to = isCurrentYear ? new Date().toISOString().split('T')[0] : `${selectedYear}-12-31`
      
      const sortedTxns = [...transactions].sort((a,b) => a.date.localeCompare(b.date))
      
      const allSymbols = Array.from(new Set(transactions.map(t => t.symbol).filter(Boolean)))
      const symbolsToFetch = [...allSymbols, 'EURUSD=X']
      
      const fetchPricesForDate = async (symbols, date) => {
        const map = {}
        const promises = symbols.map(async (sym) => {
          const price = await window.api.getHistoricalPrice(sym, date)
          map[sym] = price
        })
        await Promise.all(promises)
        return map
      }

      const [startPricesMap, endPricesMap] = await Promise.all([
        fetchPricesForDate(symbolsToFetch, from),
        isCurrentYear ? Promise.resolve({}) : fetchPricesForDate(symbolsToFetch, to)
      ])

      const eurUsdStart = startPricesMap['EURUSD=X'] || 1.10
      const eurUsdEnd = isCurrentYear ? (fxRate || 1.10) : (endPricesMap['EURUSD=X'] || 1.10)

      // Bridge Totals
      let totalInflows = 0
      let totalOutflows = 0
      let totalIncome = 0
      
      const getPortfolioValueAt = (date, pricesMap, eurUsd, useLiveQuotes = false, inclusive = false) => {
        const holdings = {}
        // If inclusive, we take transactions <= date. If not, < date.
        sortedTxns.filter(t => inclusive ? t.date <= date : t.date < date).forEach(t => {
          const symbol = (t.symbol || t.name || 'Unknown').toUpperCase()
          const key = `${t.entityId}_${symbol}`
          if (!holdings[key]) holdings[key] = { symbol, shares: 0, cost: 0, assetType: t.assetType, currency: t.currency || 'EUR' }
          
          const mult = (t.operation === 'Venta' || t.operation === 'Retirada' || t.operation === 'Retiro') ? -1 : 1
          holdings[key].shares += (t.shares || 0) * mult
          const amt = Math.abs(Number(t.total) || 0)
          if (mult > 0) holdings[key].cost += amt
          else holdings[key].cost -= amt
        })

        let total = 0
        Object.values(holdings).forEach(data => {
          if (data.shares > 0.000001 || Math.abs(data.cost) > 0.01) {
            let priceEUR = 0
            if (useLiveQuotes && data.symbol) {
              const q = quotes[data.symbol]
              if (q && q.price) priceEUR = q.currency === 'USD' ? (q.price / eurUsd) : q.price
            } else if (data.symbol) {
              const priceRaw = pricesMap[data.symbol] || 0
              priceEUR = data.currency === 'USD' ? (priceRaw / eurUsd) : priceRaw
            }
            const val = priceEUR > 0 ? (data.shares * priceEUR) : data.cost
            total += val
          }
        })
        return total
      }

      // If we have a baseline date, startValue is everything UP TO THAT DATE (inclusive)
      const startValue = getPortfolioValueAt(from, startPricesMap, eurUsdStart, false, !!baselineDate)
      const nextDayStr = isCurrentYear ? '9999-99-99' : (new Date(new Date(to).getTime() + 86400000).toISOString().split('T')[0])
      const endValue = getPortfolioValueAt(nextDayStr, endPricesMap, eurUsdEnd, isCurrentYear)

      // Cash Flows and Income: Only count AFTER baseline date (exclusive)
      sortedTxns.filter(t => t.date > from && t.date <= to).forEach(t => {
        const op = t.operation
        const amt = Math.abs(Number(t.total) || 0)
        
        if (['Aportación', 'Depósito', 'Saldo Inicial'].includes(op)) totalInflows += amt
        if (['Retirada', 'Retiro'].includes(op)) totalOutflows += amt
        if (['Dividendos', 'Intereses'].includes(op)) totalIncome += amt
      })

      const totalMarketPerformance = endValue - startValue - totalInflows + totalOutflows - totalIncome
      
      const getAssetTypeValues = (date, pricesMap, eurUsd, useLiveQuotes = false, inclusive = false) => {
        const typeHoldings = {}
        const holdings = {}
        sortedTxns.filter(t => inclusive ? t.date <= date : t.date < date).forEach(t => {
          const symbol = (t.symbol || t.name || 'Unknown').toUpperCase()
          const key = `${t.entityId}_${symbol}`
          if (!holdings[key]) holdings[key] = { symbol, shares: 0, cost: 0, assetType: t.assetType, currency: t.currency || 'EUR' }
          const mult = (t.operation === 'Venta' || t.operation === 'Retirada' || t.operation === 'Retiro') ? -1 : 1
          holdings[key].shares += (t.shares || 0) * mult
          const amt = Math.abs(Number(t.total) || 0)
          if (mult > 0) holdings[key].cost += amt
          else holdings[key].cost -= amt
        })

        Object.values(holdings).forEach(data => {
          let priceEUR = 0
          if (useLiveQuotes && data.symbol) {
            const q = quotes[data.symbol]
            if (q && q.price) priceEUR = q.currency === 'USD' ? (q.price / eurUsd) : q.price
          } else if (data.symbol) {
            const priceRaw = pricesMap[data.symbol] || 0
            priceEUR = data.currency === 'USD' ? (priceRaw / eurUsd) : priceRaw
          }
          const val = priceEUR > 0 ? (data.shares * priceEUR) : data.cost
          const type = data.assetType || 'Otros'
          typeHoldings[type] = (typeHoldings[type] || 0) + val
        })
        return typeHoldings
      }

      const startTypeVals = getAssetTypeValues(from, startPricesMap, eurUsdStart, false, !!baselineDate)
      const endTypeVals = getAssetTypeValues(nextDayStr, endPricesMap, eurUsdEnd, isCurrentYear)

      const assetStatsMap = {}
      const allTypes = new Set([...Object.keys(startTypeVals), ...Object.keys(endTypeVals)])
      
      sortedTxns.filter(t => t.date > from && t.date <= to).forEach(t => {
        if (t.assetType) allTypes.add(t.assetType)
      })

      allTypes.forEach(type => {
        let flows = 0
        let gains = 0
        sortedTxns.filter(t => t.date > from && t.date <= to && t.assetType === type).forEach(t => {
          const amt = Math.abs(Number(t.total) || 0)
          if (['Compra', 'Aportación', 'Depósito', 'Saldo Inicial'].includes(t.operation)) flows += amt
          if (['Venta', 'Retirada', 'Retiro'].includes(t.operation)) flows -= amt
          if (['Dividendos', 'Intereses'].includes(t.operation)) gains += amt
        })

        assetStatsMap[type] = {
          name: type,
          start: startTypeVals[type] || 0,
          end: endTypeVals[type] || 0,
          flows,
          gains,
          marketMove: (endTypeVals[type] || 0) - (startTypeVals[type] || 0) - flows - gains
        }
      })

      setAnnualReport({
        year: selectedYear,
        isCurrent: isCurrentYear,
        baselineDate,
        startValue,
        endValue,
        inflows: totalInflows,
        outflows: totalOutflows,
        income: totalIncome,
        marketPerf: totalMarketPerformance,
        assetStats: Object.values(assetStatsMap).filter(s => Math.abs(s.start) > 0.01 || Math.abs(s.end) > 0.01 || Math.abs(s.flows) > 0.01).sort((a,b) => b.end - a.end)
      })

    } catch (err) {
      console.error("Annual report failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Informes y Exportación</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Análisis de rendimiento detallado y volcado de datos fiscal</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[
          { id: 'anual', label: 'Resumen Anual', icon: TrendingUp },
          { id: 'historial', label: 'Análisis de Periodo', icon: History },
          { id: 'exportar', label: 'Exportación de Datos', icon: Download }
        ].map(tab => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.3s ease',
              background: isActive ? 'var(--accent)' : 'var(--panel-bg)',
              color: isActive ? '#fff' : 'var(--text-muted)',
              border: isActive ? `1px solid var(--accent)` : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'anual' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>AÑO</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ width: 100, height: 42 }}>
                {[...new Set(transactions.map(t => t.date.substring(0,4)))].sort().reverse().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>FECHA DE AJUSTE (DÍA 0)</label>
              <input type="date" value={baselineDate} onChange={e => setBaselineDate(e.target.value)} style={{ height: 42, width: 160 }} />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, maxWidth: 160 }}>Opcional: Si importaste tu cartera mid-year.</p>
            </div>
            <button className="btn" onClick={generateAnnualSummary} disabled={isGenerating} style={{ height: 42, padding: '0 24px' }}>
              {isGenerating ? <TrendingUp size={18} className="spinning" /> : <TrendingUp size={18} />} Generar Resumen
            </button>
          </div>

          {annualReport && (
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <div className="glass-panel" style={{ padding: 40, marginBottom: 24 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <h2 style={{ fontSize: 24, marginBottom: 8 }}>Estado de Variación Patrimonial {annualReport.year}</h2>
                  <p style={{ color: 'var(--text-muted)' }}>
                    {annualReport.baselineDate ? `Análisis desde fecha de ajuste (${annualReport.baselineDate})` : (annualReport.isCurrent ? 'Análisis parcial hasta hoy' : 'Análisis consolidado del periodo')}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600, margin: '0 auto 40px auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(126, 145, 177, 0.05)', borderRadius: 12 }}>
                    <span style={{ fontWeight: 600 }}>
                      {annualReport.baselineDate ? `Capital de Partida (${annualReport.baselineDate})` : 'Patrimonio al Inicio (1 Ene)'}
                    </span>
                    <span style={{ fontWeight: 800 }}>{formatCurrency(annualReport.startValue)}</span>
                  </div>
                  
                  <div style={{ padding: '8px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>[+] Aportaciones de Capital</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{formatCurrency(annualReport.inflows)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>[-] Retiradas de Capital</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(annualReport.outflows)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>[+] Dividendos e Intereses</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{formatCurrency(annualReport.income)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>[+/-] Revalorización de Mercado</span>
                      <span style={{ color: annualReport.marketPerf >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {annualReport.marketPerf >= 0 ? '+' : ''}{formatCurrency(annualReport.marketPerf)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 12, marginTop: 8, boxShadow: '0 8px 20px rgba(0, 113, 227, 0.2)' }}>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>
                      {annualReport.isCurrent ? 'Patrimonio Actual' : 'Patrimonio al Final (31 Dic)'}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 22 }}>{formatCurrency(annualReport.endValue)}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                  <div className="metric-box" style={{ textAlign: 'center', padding: 24 }}>
                    <div className="metric-label">Rentabilidad Total {annualReport.year}</div>
                    <div className={`metric-value ${ (annualReport.income + annualReport.marketPerf) >= 0 ? 'metric-positive' : 'metric-negative'}`} style={{ fontSize: 28 }}>
                      {formatCurrency(annualReport.income + annualReport.marketPerf)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      ({formatPercent(((annualReport.income + annualReport.marketPerf) / (annualReport.startValue || 1)) * 100)}% s/ inicio)
                    </div>
                  </div>
                  <div className="metric-box" style={{ textAlign: 'center', padding: 24 }}>
                    <div className="metric-label">Tasa de Ahorro/Inversión</div>
                    <div className="metric-value" style={{ color: 'var(--accent)', fontSize: 28 }}>
                      {formatCurrency(annualReport.inflows - annualReport.outflows)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Flujo Neto de Capital</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 32 }}>
                <h3 style={{ marginBottom: 24, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Rendimiento por Clase de Activo</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo de Activo</th>
                      <th style={{ textAlign: 'right' }}>V. Inicial</th>
                      <th style={{ textAlign: 'right' }}>Flujos Netos</th>
                      <th style={{ textAlign: 'right' }}>Rendimiento</th>
                      <th style={{ textAlign: 'right' }}>V. Final</th>
                      <th style={{ textAlign: 'right' }}>Rent. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualReport.assetStats.map(stat => {
                      const totalGain = stat.gains + stat.marketMove
                      const pct = (stat.start + Math.abs(stat.flows)) > 0 ? (totalGain / (stat.start + Math.abs(stat.flows))) * 100 : 0
                      return (
                        <tr key={stat.name}>
                          <td style={{ fontWeight: 700 }}>{stat.name}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(stat.start)}</td>
                          <td style={{ textAlign: 'right' }}>{stat.flows >= 0 ? '+' : ''}{formatCurrency(stat.flows)}</td>
                          <td style={{ textAlign: 'right' }} className={totalGain >= 0 ? 'metric-positive' : 'metric-negative'}>
                            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(stat.end)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className={pct >= 0 ? 'metric-positive' : 'metric-negative'}>
                            {formatPercent(pct)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'historial' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div><label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Desde</label><input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} /></div>
              <div><label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Hasta</label><input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} /></div>
            </div>
            <button className="btn" onClick={generateDetailedReport} disabled={isGenerating} style={{ height: 42, padding: '0 24px', background: 'var(--accent)' }}>
              {isGenerating ? <TrendingUp size={18} className="spinning" /> : <TrendingUp size={18} />} Generar Informe
            </button>
          </div>

          {detailedReport && (
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <div className="glass-panel" style={{ padding: 32, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>Informe de Rendimiento</h2>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Periodo: {filterDateFrom} al {filterDateTo}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Patrimonio Final</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(detailedReport.totals.end)}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
                  <div className="metric-box"><div className="metric-label">Valor Inicio</div><div className="metric-value">{formatCurrency(detailedReport.totals.start)}</div></div>
                  <div className="metric-box"><div className="metric-label">Ganancia Neta</div><div className={`metric-value ${detailedReport.totals.totalGain >= 0 ? 'metric-positive' : 'metric-negative'}`}>{formatCurrency(detailedReport.totals.totalGain)}</div></div>
                  <div className="metric-box"><div className="metric-label">Aportación Neta</div><div className="metric-value" style={{ color: 'var(--accent)' }}>{formatCurrency(detailedReport.totals.netFlow)}</div></div>
                  <div className="metric-box"><div className="metric-label">Variación Mercado</div><div className={`metric-value ${detailedReport.totals.latentGain >= 0 ? 'metric-positive' : 'metric-negative'}`}>{formatCurrency(detailedReport.totals.latentGain)}</div></div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                  <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 }}>Detalle de Ingresos Reales (Caja)</h4>
                  <div style={{ display: 'flex', gap: 40 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dividendos</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>+{formatCurrency(detailedReport.totals.dividends)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Intereses</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>+{formatCurrency(detailedReport.totals.interests)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plusvalías (Ventas)</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: detailedReport.totals.realizedGain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {detailedReport.totals.realizedGain >= 0 ? '+' : ''}{formatCurrency(detailedReport.totals.realizedGain)}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Generado</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>{formatCurrency(detailedReport.totals.yieldCash)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nueva sección: Actividad por Producto */}
              <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <ArrowUpDown size={18} /> Actividad y Aportaciones por Producto
                </h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>Compras (+)</th>
                      <th style={{ textAlign: 'right' }}>Ventas (-)</th>
                      <th style={{ textAlign: 'right' }}>Aportación Neta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedReport.categories.flatMap(cat => cat.products).map(p => (
                      <tr key={p.key}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>+{formatCurrency(p.buysInRange)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{formatCurrency(p.salesInRangeTotal)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(p.buysInRange - p.salesInRangeTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detailedReport.categories.map(cat => (
                <div key={cat.name} className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    <PieChart size={18} /> Rendimiento {cat.name}
                  </h3>
                  <table className="data-table">
                    <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>V. Inicial</th><th style={{ textAlign: 'right' }}>V. Final</th><th style={{ textAlign: 'right' }}>Var. Precio</th><th style={{ textAlign: 'right' }}>Ingr. Caja</th><th style={{ textAlign: 'right' }}>Rend %</th></tr></thead>
                    <tbody>{cat.products.map(p => (
                      <tr key={p.key}>
                        <td style={{ fontWeight: 600 }}>{p.name} {p.symbol && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({p.symbol})</span>}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.startValue)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.endValue)}</td>
                        <td style={{ textAlign: 'right' }} className={p.latentGain >= 0 ? 'metric-positive' : 'metric-negative'}>{formatCurrency(p.latentGain)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>+{formatCurrency(p.realizedGainInRange + p.dividendsInRange + p.interestsInRange)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className={p.gainPct >= 0 ? 'metric-positive' : 'metric-negative'}>{formatPercent(p.gainPct)}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}><button className="btn" onClick={handleExportPDF}><Download size={18} /> Exportar PDF</button></div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'exportar' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '20%', background: 'rgba(152, 216, 170, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
              <FileSpreadsheet size={32} color="#98D8AA" />
            </div>
            <h2 style={{ marginBottom: 12 }}>Exportar Libro Mayor</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto 32px auto', fontSize: 14 }}>
              Descarga un volcado completo de tus movimientos en formatos compatibles con hojas de cálculo para tu contabilidad o declaración fiscal.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 40, background: 'var(--panel-bg)', padding: 24, borderRadius: 16, border: '1px solid var(--border)', maxWidth: 600, margin: '0 auto 40px auto' }}>
              <div><label style={{ display: 'block', fontSize: 11, textAlign: 'left', marginBottom: 4 }}>Desde</label><input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} /></div>
              <div><label style={{ display: 'block', fontSize: 11, textAlign: 'left', marginBottom: 4 }}>Hasta</label><input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} /></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button 
                className="btn" 
                onClick={handleExportExcel} 
                style={{ 
                  padding: '16px 32px', 
                  background: '#98D8AA', 
                  border: 'none', 
                  color: '#1a1a1a',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(152, 216, 170, 0.3)'
                }}
              >
                <FileSpreadsheet size={20} /> Descargar Excel (.xlsx)
              </button>
              <button 
                className="btn" 
                onClick={handleExportCSV} 
                style={{ 
                  padding: '16px 32px', 
                  background: 'rgba(152, 216, 170, 0.1)', 
                  border: '1px solid #98D8AA',
                  color: 'var(--text-main)',
                  fontWeight: 600
                }}
              >
                <FileJson size={20} /> Descargar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
