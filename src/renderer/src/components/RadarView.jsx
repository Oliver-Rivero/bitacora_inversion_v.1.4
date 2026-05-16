import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { 
  Radar as RadarIcon, Plus, Trash2, TrendingUp, 
  Search, AlertCircle, Sparkles, Clock, ExternalLink, Loader2,
  Bell, BellRing, Edit3, X, Check
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

export default function RadarView() {
  const { 
    radarAssets, addRadarAsset, editRadarAsset, deleteRadarAsset, 
    quotes, formatCurrency, formatPercent, loading, fetchData
  } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ symbol: '', name: '', notes: '', targetPrice: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', targetPrice: '', notes: '' });
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
      const isISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(symbolToSearch);
      
      if (isISIN) {
        const resolvedTicker = await window.api.resolveISIN(symbolToSearch);
        if (resolvedTicker) {
          symbolToSearch = resolvedTicker;
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
      let initialPrice = 0;
      try {
        const quoteResult = await window.api.getQuotes([formData.symbol]);
        if (quoteResult && quoteResult[0]) {
          initialPrice = quoteResult[0].regularMarketPrice || 0;
        }
      } catch (qErr) {
        console.warn('Could not fetch initial price:', qErr);
      }

      await addRadarAsset({ 
        ...formData, 
        initialPrice,
        targetPrice: formData.targetPrice ? Number(formData.targetPrice) : null 
      });
      setFormData({ symbol: '', name: '', notes: '', targetPrice: '' });
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      alert('Error al añadir activo');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (asset) => {
    setEditingId(asset.id);
    setEditData({ 
      name: asset.name || '', 
      targetPrice: asset.targetPrice || '', 
      notes: asset.notes || '' 
    });
  };

  const handleUpdate = async (id) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Clean price: accept both dots and commas for Spanish users
      const cleanPrice = editData.targetPrice ? editData.targetPrice.toString().replace(',', '.') : '';
      const targetPriceNum = cleanPrice && !isNaN(parseFloat(cleanPrice)) ? parseFloat(cleanPrice) : null;

      await editRadarAsset({
        id,
        name: editData.name,
        targetPrice: targetPriceNum,
        notes: editData.notes
      });
      
      setEditingId(null);
      await fetchData(); // Force refresh
    } catch (err) {
      console.error('Error updating radar asset:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="radar-container wizard-slide-enter" style={{ padding: '0 0 60px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, fontWeight: 900 }}>
            <RadarIcon size={36} className="text-accent" /> Radar de Inversión
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}>Vigila oportunidades y establece alertas de precio.</p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setIsAdding(!isAdding)}
          style={{ padding: '12px 24px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 20px rgba(0, 113, 227, 0.2)' }}
        >
          {isAdding ? 'Cancelar' : <><Plus size={20} /> Nuevo Activo</>}
        </button>
      </div>

      {isAdding && (
        <div className="glass-panel" style={{ padding: 40, marginBottom: 40, borderRadius: 28, border: '1px solid var(--accent)', animation: 'slideDown 0.3s ease', background: 'rgba(255,255,255,0.02)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr auto', gap: 24, alignItems: 'end' }}>
            <div className="form-group">
              <label className="radar-label">Ticker</label>
              <input 
                type="text" 
                className="radar-input" 
                placeholder="AAPL..."
                value={formData.symbol}
                onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                onBlur={handleTickerBlur}
                required
              />
            </div>
            <div className="form-group">
              <label className="radar-label">Nombre del Activo</label>
              <input 
                type="text" 
                className="radar-input" 
                placeholder="Ej: Apple Inc."
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="radar-label">Alerta Precio (€)</label>
              <input 
                type="number" 
                step="any"
                className="radar-input" 
                placeholder="Ej: 150"
                value={formData.targetPrice}
                onChange={e => setFormData({ ...formData, targetPrice: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="radar-label">Notas / Estrategia</label>
              <input 
                type="text" 
                className="radar-input" 
                placeholder="Ej: Comprar si baja un 10%"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSaving || isFetchingInfo} style={{ height: 48, padding: '0 32px', borderRadius: 14 }}>
              {isSaving ? <Loader2 className="spinning" /> : 'Añadir'}
            </button>
          </form>
        </div>
      )}

      {radarAssets.length === 0 ? (
        <div className="glass-panel" style={{ padding: 80, textAlign: 'center', borderRadius: 32 }}>
          <RadarIcon size={64} style={{ margin: '0 auto 24px', opacity: 0.05 }} />
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Tu radar está despejado</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 32px', fontSize: 16 }}>
            Empieza a seguir los activos que te interesan para no perderte ninguna oportunidad de mercado.
          </p>
          <button className="btn btn-secondary" onClick={() => setIsAdding(true)}>Configurar primer activo</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 28 }}>
          {radarAssets.map(asset => {
            const quote = quotes[asset.symbol] || {};
            const price = quote.price || 0;
            const currency = quote.currency || 'EUR';
            const evolution = asset.initialPrice > 0 ? ((price - asset.initialPrice) / asset.initialPrice) * 100 : 0;
            const isPositive = evolution >= 0;
            const isEditing = editingId === asset.id;
            
            // Alert logic
            const hasTarget = asset.targetPrice > 0;
            const isAlertHit = hasTarget && (
              // If price is below target and we wanted it to fall, or price is above target and we wanted it to rise
              // For simplicity, we trigger if price is VERY CLOSE or CROSSES target.
              // Let's assume the user wants an alert when it DROPS to target if current > target, or RISES to target if current < target.
              Math.abs(price - asset.targetPrice) / asset.targetPrice < 0.01 || 
              (asset.initialPrice > asset.targetPrice && price <= asset.targetPrice) ||
              (asset.initialPrice < asset.targetPrice && price >= asset.targetPrice)
            );

            return (
              <div 
                key={asset.id} 
                className={`glass-panel radar-card ${isAlertHit ? 'alert-hit' : ''}`}
                style={{ 
                  padding: 32, borderRadius: 32, position: 'relative', overflow: 'hidden', transition: 'all 0.3s ease',
                  border: isAlertHit ? '2px solid var(--success)' : '1px solid var(--border-subtle)',
                  background: isAlertHit ? 'rgba(52, 199, 89, 0.03)' : 'rgba(255,255,255,0.01)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <input 
                        className="radar-edit-input" 
                        value={editData.name} 
                        onChange={e => setEditData({...editData, name: e.target.value})}
                        style={{ fontSize: 20, fontWeight: 800, width: '100%', marginBottom: 4 }}
                      />
                    ) : (
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4, letterSpacing: -0.5 }}>
                        {asset.name || quote.shortName || 'Activo Sin Nombre'}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>{asset.symbol}</span>
                      {isAlertHit && (
                        <div className="alert-badge">
                          <BellRing size={12} /> OBJETIVO ALCANZADO
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn" onClick={() => isEditing ? handleUpdate(asset.id) : startEditing(asset)}>
                      {isEditing ? <Check size={18} className="text-success" /> : <Edit3 size={18} />}
                    </button>
                    <button className="icon-btn text-danger" onClick={() => deleteRadarAsset(asset.id)} style={{ opacity: 0.5 }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div className="label-tiny">PRECIO ACTUAL</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <div style={{ fontSize: 36, fontWeight: 950, color: 'var(--text-main)' }}>{formatCurrency(price, currency)}</div>
                      {asset.initialPrice > 0 && (
                        <div style={{ color: isPositive ? 'var(--success)' : 'var(--danger)', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isPositive ? '+' : ''}{formatPercent(evolution)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label-tiny">ALERTA</div>
                    {isEditing ? (
                      <input 
                        type="number"
                        className="radar-edit-input" 
                        value={editData.targetPrice} 
                        onChange={e => setEditData({...editData, targetPrice: e.target.value})}
                        style={{ width: 80, textAlign: 'right', fontWeight: 800 }}
                      />
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 800, color: hasTarget ? 'var(--text-main)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        {hasTarget ? <Bell size={16} className={isAlertHit ? 'text-success' : ''} /> : <Bell size={16} opacity={0.2} />}
                        {hasTarget ? formatCurrency(asset.targetPrice, currency) : '--'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sparkline */}
                <div style={{ height: 50, margin: '0 -32px 24px -32px', opacity: 0.6 }}>
                  {chartData[asset.symbol] ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData[asset.symbol]}>
                        <defs>
                          <linearGradient id={`grad-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Area 
                          type="monotone" dataKey="value" 
                          stroke={isPositive ? '#34C759' : '#FF3B30'} strokeWidth={2}
                          fillOpacity={1} fill={`url(#grad-${asset.symbol})`} 
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: '100%', background: 'rgba(126,145,177,0.05)' }} />}
                </div>

                <div style={{ position: 'relative' }}>
                  {isEditing ? (
                    <textarea 
                      className="radar-edit-input" 
                      value={editData.notes} 
                      onChange={e => setEditData({...editData, notes: e.target.value})}
                      placeholder="Notas..."
                      style={{ width: '100%', height: 60, fontSize: 13 }}
                    />
                  ) : asset.notes ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, background: 'rgba(126,145,177,0.05)', padding: '12px 16px', borderRadius: 16, borderLeft: '3px solid var(--accent)' }}>
                      {asset.notes}
                    </div>
                  ) : null}
                </div>

                {!isEditing && (
                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <a 
                      href={`https://finance.yahoo.com/quote/${asset.symbol}`} target="_blank" rel="noreferrer" 
                      className="radar-analyze-link"
                    >
                      <ExternalLink size={14} /> Yahoo Finance
                    </a>
                  </div>
                )}
                
                {isEditing && (
                  <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)} style={{ flex: 1 }}><X size={14} /> Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(asset.id)} style={{ flex: 1 }}><Check size={14} /> Guardar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .radar-label { display: block; fontSize: 10px; font-weight: 800; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .radar-input { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text-main); width: 100%; font-weight: 600; outline: none; transition: border-color 0.2s; }
        .radar-input:focus { border-color: var(--accent); }
        .radar-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .icon-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; border-radius: 10px; transition: all 0.2s; }
        .icon-btn:hover { background: rgba(126,145,177,0.1); color: var(--text-main); }
        .label-tiny { font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .alert-badge { padding: 4px 8px; border-radius: 6px; background: var(--success); color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; gap: 4px; animation: pulse 2s infinite; }
        .radar-analyze-link { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--accent); text-decoration: none; opacity: 0.7; transition: opacity 0.2s; }
        .radar-analyze-link:hover { opacity: 1; }
        .radar-edit-input { background: rgba(0,113,227,0.05); border: 1px dashed var(--accent); border-radius: 8px; padding: 4px 8px; color: var(--text-main); outline: none; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
