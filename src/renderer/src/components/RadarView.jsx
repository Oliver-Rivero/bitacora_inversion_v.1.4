import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { 
  Radar as RadarIcon, Plus, Trash2, ShoppingCart, TrendingUp, 
  Search, AlertCircle, Info, Sparkles, Clock, ExternalLink, Loader2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

export default function RadarView() {
  const { 
    radarAssets, addRadarAsset, deleteRadarAsset, 
    quotes, formatCurrency, formatPercent, loading,
    setLedgerFormRequested, fetchData
  } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ symbol: '', name: '', notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [chartData, setChartData] = useState({});

  // Fetch chart data for all assets
  const fetchCharts = useCallback(async () => {
    const newData = { ...chartData };
    let changed = false;
    for (const asset of radarAssets) {
      if (!newData[asset.symbol]) {
        try {
          const data = await window.api.getChartData(asset.symbol, '1mo');
          if (data && data.length > 0) {
            newData[asset.symbol] = data;
            changed = true;
          }
        } catch (err) {
          console.error(`Error fetching chart for ${asset.symbol}:`, err);
        }
      }
    }
    if (changed) setChartData(newData);
  }, [radarAssets, chartData]);

  useEffect(() => {
    if (radarAssets.length > 0) {
      fetchCharts();
    }
  }, [radarAssets]);

  const handleTickerBlur = async () => {
    if (!formData.symbol) return;
    setIsFetchingInfo(true);
    try {
      let symbolToSearch = formData.symbol.trim();
      
      // ISIN Detection: 12 chars, starts with 2 letters
      const isISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(symbolToSearch);
      
      if (isISIN) {
        // Search Yahoo for the ISIN to get the Ticker via main process
        const resolvedTicker = await window.api.resolveISIN(symbolToSearch);
        
        if (resolvedTicker) {
          symbolToSearch = resolvedTicker;
          // Update the form with the found ticker
          setFormData(prev => ({ ...prev, symbol: resolvedTicker }));
        }
      }

      const results = await window.api.getQuotes([symbolToSearch]);
      if (results && results[0]) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || results[0].shortName || results[0].longName || ''
        }));
      }
    } catch (err) {
      console.warn('Could not auto-fetch asset info:', err);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol) return;
    setIsSaving(true);
    try {
      // Try to get current price to store as initialPrice
      let initialPrice = 0;
      try {
        const quoteResult = await window.api.getQuotes([formData.symbol]);
        if (quoteResult && quoteResult[0]) {
          initialPrice = quoteResult[0].regularMarketPrice || 0;
        }
      } catch (qErr) {
        console.warn('Could not fetch initial price for radar asset:', qErr);
      }

      await addRadarAsset({ ...formData, initialPrice });
      setFormData({ symbol: '', name: '', notes: '' });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      alert('Error al añadir activo al radar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBuy = (asset) => {
    // We signal to App.jsx/LedgerView that we want a new operation
    setLedgerFormRequested(true);
  };

  return (
    <div className="radar-container wizard-slide-enter" style={{ padding: '0 0 60px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, fontWeight: 900 }}>
            <RadarIcon size={36} className="text-accent" /> Radar de Activos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}>Vigila activos potenciales antes de incorporarlos a tu cartera.</p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setIsAdding(!isAdding)}
          style={{ padding: '12px 24px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          {isAdding ? 'Cancelar' : <><Plus size={20} /> Añadir al Radar</>}
        </button>
      </div>

      {isAdding && (
        <div className="glass-panel" style={{ padding: 32, marginBottom: 40, borderRadius: 24, border: '2px solid var(--accent)', animation: 'slideDown 0.3s ease' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 2fr auto', gap: 20, alignItems: 'end' }}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Símbolo (Ticker)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="AAPL, BTC-USD..."
                value={formData.symbol}
                onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                onBlur={handleTickerBlur}
                required
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', width: '100%' }}
              />
              {isFetchingInfo && (
                <div style={{ position: 'absolute', right: 12, bottom: 12 }}>
                  <Loader2 size={16} className="spinning" style={{ color: 'var(--accent)' }} />
                </div>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Nombre del Activo</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ej: Apple Inc."
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Notas / Estrategia</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="¿Por qué lo vigilas? Ej: Comprar si baja de 150$"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-main)', width: '100%' }}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSaving}
              style={{ padding: '12px 32px', borderRadius: 12, height: 48 }}
            >
              {isSaving ? 'Añadiendo...' : 'Confirmar'}
            </button>
          </form>
        </div>
      )}

      {radarAssets.length === 0 ? (
        <div className="glass-panel" style={{ padding: 80, textAlign: 'center', borderRadius: 32 }}>
          <RadarIcon size={64} style={{ margin: '0 auto 24px', opacity: 0.1 }} />
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Tu radar está vacío</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 32px', fontSize: 16, lineHeight: 1.6 }}>
            Añade activos que te resulten interesantes para seguir su precio en tiempo real y decidir el mejor momento para invertir.
          </p>
          <button className="btn btn-secondary" onClick={() => setIsAdding(true)}>
            Empezar a vigilar activos
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
          {radarAssets.map(asset => {
            const quote = quotes[asset.symbol] || {};
            const price = quote.price || 0;
            const currency = quote.currency || 'EUR';
            const evolution = asset.initialPrice > 0 ? ((price - asset.initialPrice) / asset.initialPrice) * 100 : 0;
            const isPositive = evolution >= 0;
            
            return (
              <div key={asset.id} className="glass-panel asset-card" style={{ padding: 32, borderRadius: 28, position: 'relative', overflow: 'hidden', transition: 'transform 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>{asset.symbol}</span>
                      <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 800 }}>VIGILANDO</div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{asset.name || quote.shortName || 'Activo en Radar'}</div>
                  </div>
                  <button 
                    onClick={() => deleteRadarAsset(asset.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.4 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>Precio Actual</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 32, fontWeight: 900 }}>{formatCurrency(price, currency)}</div>
                    {asset.initialPrice > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 4, 
                        padding: '4px 10px', 
                        borderRadius: 10, 
                        background: isPositive ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                        color: isPositive ? 'var(--success)' : 'var(--danger)',
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingUp size={14} style={{ transform: 'rotate(180deg)' }} />}
                        {isPositive ? '+' : ''}{formatPercent(evolution)}%
                      </div>
                    )}
                  </div>
                  {asset.initialPrice > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>
                      Desde incorporación: {formatCurrency(asset.initialPrice, currency)}
                    </div>
                  )}
                </div>

                {/* Sparkline Chart */}
                <div style={{ height: 60, margin: '16px -32px', marginBottom: 24, position: 'relative' }}>
                  {chartData[asset.symbol] ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData[asset.symbol]}>
                        <defs>
                          <linearGradient id={`grad-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke={isPositive ? '#34C759' : '#FF3B30'} 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill={`url(#grad-${asset.symbol})`} 
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(126, 145, 177, 0.03)', opacity: 0.3 }}>
                       <Loader2 size={16} className="spinning" />
                    </div>
                  )}
                </div>

                {asset.notes && (
                  <div style={{ padding: '16px 20px', background: 'rgba(126, 145, 177, 0.05)', borderRadius: 16, marginBottom: 32, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5, fontWeight: 500, borderLeft: '4px solid var(--accent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Notas</div>
                    {asset.notes}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <button 
                    onClick={() => handleBuy(asset)}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #34C759 0%, #2e7d32 100%)', border: 'none', boxShadow: '0 4px 12px rgba(52, 199, 89, 0.2)' }}
                  >
                    <ShoppingCart size={16} /> Comprar
                  </button>
                  <a 
                    href={`https://finance.yahoo.com/quote/${asset.symbol}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <ExternalLink size={16} /> Analizar
                  </a>
                </div>
                
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'var(--accent)', opacity: 0.03, borderRadius: '50%', pointerEvents: 'none' }} />
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .asset-card:hover { transform: translateY(-4px); }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinning {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spinning 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
