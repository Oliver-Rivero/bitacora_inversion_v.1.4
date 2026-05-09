import React, { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Info 
} from 'lucide-react'
import { ENTITY_COLORS } from '../utils/constants'

const EntityIcon = ({ ent, color, domain }) => {
  const [hasError, setHasError] = useState(false)
  // Utilizando el servicio de Google que es más robusto para logos corporativos
  const favicon = domain && !hasError ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null

  if (favicon) {
    return <img src={favicon} alt="" style={{ width: 24, height: 24, borderRadius: '6px', objectFit: 'contain' }} onError={() => setHasError(true)} />
  }
  
  return (
    <div style={{ width: 24, height: 24, borderRadius: '6px', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
      {ent.name.substring(0, 2).toUpperCase()}
    </div>
  )
}

export default function EntitiesDetailView() {
  const { transactions, quotes, fxRate, formatCurrency, formatNumber, formatPercent, entities, assetTypes } = useData()
  const [activeEntityId, setActiveEntityId] = useState(entities.length > 0 ? entities[0].id : null)

  // --- Data Processing ---
  const entityData = useMemo(() => {
    const map = {}
    
    // Group everything by entity
    entities.forEach(ent => {
      map[ent.id] = {
        name: ent.name,
        totalValue: 0,
        netInvested: 0,
        profit: 0,
        assets: {}
      }
    })

    transactions.forEach(t => {
      if (!t.entityId || !map[t.entityId]) return
      
      const symbol = t.symbol ? t.symbol.toUpperCase() : ''
      const assetKey = symbol || t.name
      const ent = map[t.entityId]

      if (!ent.assets[assetKey]) {
        ent.assets[assetKey] = {
          name: t.name,
          symbol: symbol,
          type: t.assetType,
          shares: 0,
          invested: 0,
          sold: 0,
          history: []
        }
      }

      const a = ent.assets[assetKey]
      const mult = (t.operation === 'Venta') ? -1 : 1
      const val = (t.shares * t.unitPrice) || 0
      
      if (['Compra', 'Saldo Inicial', 'Venta'].includes(t.operation)) {
        a.shares += (t.shares * mult)
        if (mult > 0) a.invested += val
        else a.sold += val
        a.history.push(t)
      }
    })

    // Calculate totals and metrics
    Object.values(map).forEach(ent => {
      Object.values(ent.assets).forEach(a => {
        if (Math.abs(a.shares) < 0.0001) {
          delete ent.assets[a.symbol || a.name]
          return
        }

        const qKey = Object.keys(quotes).find(k => k.toUpperCase() === (a.symbol || '').toUpperCase())
        const q = qKey ? quotes[qKey] : {}
        const isUSD = q.currency === 'USD'
        const priceInEUR = isUSD ? (q.price / (fxRate || 1)) : (q.price || 0)
        
        const netCost = a.invested - a.sold
        const currentValue = (a.symbol && q.price) ? (a.shares * priceInEUR) : netCost

        a.currentValue = currentValue
        a.netCost = netCost
        a.profit = currentValue - netCost
        a.profitPct = netCost > 1 ? (a.profit / netCost) * 100 : 0

        ent.totalValue += currentValue
        ent.netInvested += netCost
      })
      ent.profit = ent.totalValue - ent.netInvested
      ent.profitPct = ent.netInvested > 1 ? (ent.profit / ent.netInvested) * 100 : 0
      
      // Sort assets by value
      ent.sortedAssets = Object.values(ent.assets).sort((a, b) => b.currentValue - a.currentValue)
    })

    return map
  }, [transactions, quotes, fxRate, entities])

  const activeEntity = entityData[activeEntityId]
  const entityColor = activeEntity ? (ENTITY_COLORS[activeEntity.name] || 'var(--accent)') : 'var(--accent)'

  // Domain resolver for icons
  const getDomainFromEntity = (ent) => {
    if (ent.url) return ent.url.replace(/^https?:\/\//, '').split('/')[0] // Basic cleanup to get domain

    const name = ent.name
    const entry = name.toLowerCase().replace(/\s+/g, '') // Remove all spaces
    if (entry.includes('myinvestor')) return 'myinvestor.es'
    if (entry.includes('degiro')) return 'degiro.es'
    if (entry.includes('kraken')) return 'kraken.com'
    if (entry.includes('traderepublic')) return 'traderepublic.com'
    if (entry.includes('urbanitae')) return 'urbanitae.com'
    if (entry.includes('crescenta')) return 'crescenta.com'
    if (entry.includes('criptan')) return 'criptan.com'
    if (entry.includes('binance')) return 'binance.com'
    if (entry.includes('revolut')) return 'revolut.com'
    if (entry.includes('santander')) return 'santander.es'
    if (entry.includes('bbva')) return 'bbva.es'
    return null
  }

  if (!activeEntityId && entities.length > 0) setActiveEntityId(entities[0].id)

  const globalTotalValue = Object.values(entityData).reduce((acc, ent) => acc + ent.totalValue, 0)

  return (
    <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Mis Entidades</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Distribución y rendimiento de tu patrimonio por banco o broker</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Total Cartera</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(globalTotalValue)}</div>
        </div>
      </div>

      {/* Entity Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 32, 
        overflowX: 'auto', 
        paddingBottom: 8,
        WebkitOverflowScrolling: 'touch'
      }}>
        {entities.map(ent => {
          const isActive = activeEntityId === ent.id
          const color = ENTITY_COLORS[ent.name] || 'var(--accent)'
          const domain = getDomainFromEntity(ent)

          return (
            <button 
              key={ent.id} 
              onClick={() => setActiveEntityId(ent.id)}
              style={{
                padding: '12px 20px',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                background: isActive ? 'var(--panel-bg)' : 'transparent',
                color: 'var(--text-main)',
                border: isActive ? `1px solid var(--border)` : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: isActive ? '0 8px 16px rgba(0,0,0,0.05)' : 'none',
                minWidth: 160
              }}
            >
              <EntityIcon ent={ent} color={color} domain={domain} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: isActive ? 1 : 0.7 }}>{ent.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, opacity: isActive ? 1 : 0.6 }}>
                  {formatCurrency(entityData[ent.id]?.totalValue || 0)}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {!activeEntity ? (
        <div className="glass-panel" style={{ padding: 48, textAlign: 'center' }}>
          <Info size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ color: 'var(--text-muted)' }}>Selecciona una entidad para ver sus detalles</div>
        </div>
      ) : (
        <>
          <div className="metrics-grid" style={{ marginBottom: 40 }}>
            <div className="metric-card glass-panel" style={{ borderLeft: `4px solid ${entityColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="metric-title">Valor en {activeEntity.name}</div>
                <Wallet size={16} className="text-muted" style={{ opacity: 0.5 }} />
              </div>
              <div className="metric-value" style={{ marginTop: 8 }}>{formatCurrency(activeEntity.totalValue)}</div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: `4px solid ${activeEntity.profit >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="metric-title">Rentabilidad</div>
                {activeEntity.profit >= 0 ? <TrendingUp size={16} color="var(--success)" /> : <TrendingDown size={16} color="var(--danger)" />}
              </div>
              <div className={`metric-value ${activeEntity.profit >= 0 ? 'metric-positive' : 'metric-negative'}`} style={{ marginTop: 8 }}>
                {activeEntity.profit > 0 ? '+' : ''}{formatCurrency(activeEntity.profit)}
                <span style={{ fontSize: 14, marginLeft: 8, opacity: 0.8 }}>({formatPercent(activeEntity.profitPct)}%)</span>
              </div>
            </div>

            <div className="metric-card glass-panel" style={{ borderLeft: '4px solid #A29BBD' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="metric-title">Capital Invertido</div>
                <Building2 size={16} className="text-muted" style={{ opacity: 0.5 }} />
              </div>
              <div className="metric-value" style={{ marginTop: 8 }}>{formatCurrency(activeEntity.netInvested)}</div>
            </div>
          </div>

          <h2 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Activos en {activeEntity.name}
          </h2>

          <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: 40 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>ACTIVO</th>
                    <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>PARTICIPACIONES</th>
                    <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>INVERSIÓN NETO</th>
                    <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>VALOR ACTUAL</th>
                    <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>RENTABILIDAD</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEntity.sortedAssets.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay activos registrados en esta entidad.
                      </td>
                    </tr>
                  )}
                  {activeEntity.sortedAssets.map(a => (
                    <tr key={a.symbol || a.name} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 4, 
                          height: 24, 
                          borderRadius: 2, 
                          background: assetTypes.find(at => at.name === a.type)?.color || 'var(--accent)' 
                        }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{a.symbol || a.type}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{formatNumber(a.shares)}</div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ fontSize: 13 }}>{formatCurrency(a.netCost)}</div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(a.currentValue)}</div>
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
                          {formatPercent(a.profitPct)}%
                        </div>
                        <div style={{ fontSize: 11, color: a.profit >= 0 ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
                          {formatCurrency(a.profit)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
