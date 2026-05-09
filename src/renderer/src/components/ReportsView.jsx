import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { Download, TrendingUp, History, FileSpreadsheet, FileJson, ArrowUpDown, PieChart } from 'lucide-react'
import { exportLibroMayorExcel, exportLibroMayorCSV, exportDetailedReportPDF } from '../utils/exportUtils'

export default function ReportsView() {
  const { transactions, entities, formatCurrency, formatPercent, fxRate } = useData()
  
  const currentYear = new Date().getFullYear().toString()
  const [activeTab, setActiveTab] = useState('historial')
  const [isGenerating, setIsGenerating] = useState(false)
  const [detailedReport, setDetailedReport] = useState(null)
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
                costBasisOfSale += lot.shares * lot.costPerShare; sharesToSell -= lot.shares; p.fifoQueue.shift()
              } else {
                costBasisOfSale += sharesToSell * lot.costPerShare; lot.shares -= sharesToSell; sharesToSell = 0
              }
            }
            if (inRange) {
              p.salesInRangeCost += costBasisOfSale; p.salesInRangeTotal += t.total
              p.realizedGainInRange += (t.total - costBasisOfSale)
            }
          } else {
            const costPerShare = t.shares > 0 ? t.total / t.shares : 0
            p.fifoQueue.push({ shares: t.shares, costPerShare })
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
        const currentCostBasis = p.fifoQueue.reduce((acc, lot) => acc + (lot.shares * lot.costPerShare), 0)
        
        let startCostBasis = 0
        const tempQueue = []
        const productTxns = sortedTxns.filter(t => (t.symbol || t.name) === p.key)
        productTxns.filter(t => t.date < filterDateFrom).forEach(t => {
           if (t.operation === 'Compra' || t.operation === 'Saldo Inicial') {
             tempQueue.push({ shares: t.shares, costPerShare: t.shares > 0 ? t.total/t.shares : 0 })
           } else if (t.operation === 'Venta') {
             let toSell = t.shares
             while(toSell > 0 && tempQueue.length > 0) {
               if (tempQueue[0].shares <= toSell) { toSell -= tempQueue[0].shares; tempQueue.shift() }
               else { tempQueue[0].shares -= toSell; toSell = 0 }
             }
           }
        })
        startCostBasis = tempQueue.reduce((acc, lot) => acc + (lot.shares * lot.costPerShare), 0)

        p.startValue = p.symbol && priceStartRaw > 0 ? p.startShares * priceStartEUR : startCostBasis
        p.endValue = p.symbol && priceEndRaw > 0 ? p.endShares * priceEndEUR : currentCostBasis
        p.latentGain = p.endValue - (p.startValue + p.buysInRange - p.salesInRangeCost)
        p.totalGain = p.latentGain + p.realizedGainInRange + p.dividendsInRange + p.interestsInRange
        p.gainPct = (p.startValue + p.buysInRange) > 0.01 ? (p.totalGain / (p.startValue + p.buysInRange)) * 100 : 0

        if (Math.abs(p.startValue) < 0.01 && Math.abs(p.endValue) < 0.01 && Math.abs(p.buysInRange) < 0.01) return
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
