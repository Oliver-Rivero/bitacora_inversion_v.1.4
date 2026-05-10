import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  Calendar, TrendingUp, TrendingDown, Wallet, 
  Search, PieChart as PieChartIcon, ArrowUpDown,
  Activity, Target, Trophy, Edit3, Save, Info, ArrowRight,
  ShieldCheck, Globe, Sparkles, AlertTriangle, Zap, Briefcase
} from 'lucide-react';
import { 
  ResponsiveContainer, Tooltip as RechartsTooltip, Cell,
  PieChart, Pie
} from 'recharts';

const styles = `
  .tool-tab {
    padding: 10px 20px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
  }
  .tool-tab:hover {
    color: var(--text-main);
    background: rgba(126, 145, 177, 0.08);
  }
  .tool-tab.active {
    background: var(--panel-bg);
    color: var(--accent);
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
  }
  .period-select {
    padding: 10px 14px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-main);
    font-size: 14px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
  }
  .metric-card {
    padding: 32px;
    border-radius: 24px;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;
  }
  .metric-card:hover { transform: translateY(-4px); }
  .tag {
    font-size: 9px;
    font-weight: 800;
    padding: 4px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .tag-in { background: rgba(52, 199, 89, 0.15); color: #2e7d32; }
  .tag-out { background: rgba(255, 59, 48, 0.15); color: #d32f2f; }
  .tag-yield { background: rgba(0, 113, 227, 0.15); color: var(--accent); }
  .tag-neutral { background: rgba(126, 145, 177, 0.15); color: var(--text-muted); }
  .table-row-hover:hover { background: rgba(126, 145, 177, 0.08) !important; }
  
  @keyframes spinning {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinning {
    animation: spinning 1s linear infinite;
  }

  .goal-input {
    width: 100px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--text-main);
    font-weight: 800;
    text-align: right;
    outline: none;
  }
`;

export default function AnalyticsView() {
  const { 
    transactions, formatCurrency, formatNumber, formatPercent, loading, 
    userProfile, updateProfile, quotes, fxRate, categories, assetTypes 
  } = useData();

  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'goals' | 'health'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [viewMode, setViewMode] = useState('monthly');

  const yearOptions = useMemo(() => {
    const years = new Set();
    transactions?.forEach(t => {
      if (t.date) years.add(t.date.substring(0, 4));
    });
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [transactions]);

  const periodData = useMemo(() => {
    if (!transactions) return { totalIn: 0, totalOut: 0, yieldsOut: 0, totalReturns: 0, netFlow: 0, items: [], distribution: [] };

    const filtered = transactions.filter(t => {
      if (!t.date) return false;
      const tYear = t.date.substring(0, 4);
      const tMonth = t.date.substring(5, 7);
      if (viewMode === 'annual') return tYear === selectedYear;
      return tYear === selectedYear && tMonth === selectedMonth;
    });

    let totalIn = 0;
    let totalOut = 0;
    let yieldsOut = 0;
    const distMap = {};

    filtered.forEach(t => {
      const amt = Math.abs(Number(t.total) || 0);
      const op = t.operation;
      
      if (['Compra', 'Depósito', 'Aportación', 'Saldo Inicial'].includes(op)) {
        totalIn += amt;
        
        // Grouping by ASSET TYPE (e.g. Acciones, Fondos, ETF)
        let typeName = t.assetType || 'Otros';
        let typeColor = '#B0B0B0';
        
        const assetTypeObj = assetTypes?.find(at => at.name === t.assetType);
        if (assetTypeObj) {
          typeColor = assetTypeObj.color || '#B0B0B0';
        }

        if (!distMap[typeName]) distMap[typeName] = { value: 0, color: typeColor };
        distMap[typeName].value += amt;
      } else if (['Venta', 'Retiro', 'Retirada'].includes(op)) {
        totalOut += amt;
      } else if (['Dividendos', 'Intereses'].includes(op)) {
        yieldsOut += amt;
      }
    });

    const distribution = Object.entries(distMap)
      .map(([name, data]) => ({ name, value: data.value, color: data.color }))
      .sort((a, b) => b.value - a.value);

    const totalReturns = totalOut + yieldsOut;

    return {
      totalIn,
      totalOut,
      yieldsOut,
      totalReturns,
      netFlow: totalIn - totalReturns,
      items: filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      distribution
    };
  }, [transactions, selectedYear, selectedMonth, viewMode, categories, assetTypes]);

  if (!userProfile) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos estratégicos...</div>;

  return (
    <div className="analytics-container wizard-slide-enter" style={{ paddingBottom: 60 }}>
      <style>{styles}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, fontWeight: 900 }}>
            <TrendingUp size={36} className="text-accent" /> Análisis Estratégico
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}>Control de flujos, rentabilidad y objetivos de inversión.</p>
        </div>

        <div className="glass-panel" style={{ display: 'flex', padding: 6, borderRadius: 14, background: 'rgba(126, 145, 177, 0.05)' }}>
          <button 
            className={`tool-tab ${activeTab === 'flow' ? 'active' : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            <ArrowUpDown size={16} /> Flujo de Caja
          </button>
          <button 
            className={`tool-tab ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            <Target size={16} /> Objetivos
          </button>
          <button 
            className={`tool-tab ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
          >
            <ShieldCheck size={16} /> Salud
          </button>
        </div>
      </div>

      {activeTab === 'flow' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <div className="glass-panel" style={{ display: 'flex', padding: 8, gap: 8, borderRadius: 16, boxShadow: 'var(--glass-shadow)' }}>
               <select className="period-select" value={viewMode} onChange={e => setViewMode(e.target.value)}>
                 <option value="monthly">Mes</option>
                 <option value="annual">Año</option>
               </select>

               <select className="period-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                 {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
               </select>

               {viewMode === 'monthly' && (
                 <select className="period-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                   {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                     <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('es', { month: 'long' }).charAt(0).toUpperCase() + new Date(2000, parseInt(m)-1).toLocaleString('es', { month: 'long' }).slice(1)}</option>
                   ))}
                 </select>
               )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
            <div className="glass-panel metric-card">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, fontWeight: 800, letterSpacing: 1.5 }}>Capital Inyectado</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--success)' }}>{formatCurrency(periodData.totalIn)}</div>
              <TrendingUp size={48} style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.1, color: 'var(--success)' }} />
            </div>

            <div className="glass-panel metric-card">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, fontWeight: 800, letterSpacing: 1.5 }}>Retornos Líquidos</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--danger)' }}>{formatCurrency(periodData.totalReturns)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
                 {formatCurrency(periodData.totalOut)} Realizaciones + {formatCurrency(periodData.yieldsOut)} Beneficios
              </div>
              <TrendingDown size={48} style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.1, color: 'var(--danger)' }} />
            </div>

            <div className="glass-panel metric-card" style={{ background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08), transparent)', border: '2px solid rgba(0, 113, 227, 0.3)' }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 12, fontWeight: 900, letterSpacing: 1.5 }}>Flujo Neto</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-main)' }}>
                {periodData.netFlow > 0 ? '+' : ''}{formatCurrency(periodData.netFlow)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {periodData.netFlow >= 0 ? 'Fase de Acumulación' : 'Fase de Cosecha'}
              </div>
              <Wallet size={48} style={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.15, color: 'var(--accent)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 32 }}>
            <div className="glass-panel" style={{ padding: 32 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, fontSize: 18, fontWeight: 800 }}>
                <Activity size={22} className="text-accent" /> Destino del Capital
              </h3>
              <div style={{ height: 280 }}>
                {periodData.distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={periodData.distribution}
                        innerRadius={75}
                        outerRadius={105}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        {periodData.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--glass-shadow)', padding: '12px 16px' }}
                        itemStyle={{ color: 'var(--text-main)', fontSize: 13, fontWeight: 600 }}
                        formatter={(v) => formatCurrency(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
                    <Activity size={40} style={{ opacity: 0.2 }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Sin actividad en este periodo</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                {periodData.distribution.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(126, 145, 177, 0.03)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}66` }} />
                      <span style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 32 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, fontSize: 18, fontWeight: 800 }}>
                <ArrowUpDown size={22} className="text-accent" /> Historial del Periodo
              </h3>
              <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 12 }}>
                {periodData.items.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Search size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
                    <p style={{ fontWeight: 500 }}>No se han encontrado registros.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0 12px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Fecha</th>
                        <th style={{ textAlign: 'left', padding: '0 12px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Producto</th>
                        <th style={{ textAlign: 'left', padding: '0 12px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Operación</th>
                        <th style={{ textAlign: 'right', padding: '0 12px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodData.items.map((t, i) => {
                        const isIn = ['Compra', 'Depósito', 'Aportación', 'Saldo Inicial'].includes(t.operation);
                        const isOut = ['Venta', 'Retiro', 'Retirada'].includes(t.operation);
                        const isYield = ['Dividendos', 'Intereses'].includes(t.operation);
                        
                        const formattedDate = t.date ? t.date.split('-').reverse().join('-') : '-';
                        
                        return (
                          <tr key={i} style={{ background: 'rgba(126, 145, 177, 0.04)', transition: 'background 0.2s' }} className="table-row-hover">
                            <td style={{ padding: '16px 12px', fontSize: 13, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, color: 'var(--text-main)', fontWeight: 500 }}>{formattedDate}</td>
                            <td style={{ padding: '16px 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{t.name || t.symbol}</td>
                            <td style={{ padding: '16px 12px' }}>
                              <span className={`tag ${isIn ? 'tag-in' : isOut ? 'tag-out' : isYield ? 'tag-yield' : 'tag-neutral'}`}>
                                {t.operation}
                              </span>
                            </td>
                            <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: 15, fontWeight: 900, borderTopRightRadius: 12, borderBottomRightRadius: 12, color: (isOut || isYield) ? 'var(--danger)' : 'var(--text-main)' }}>
                              {formatCurrency(t.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'goals' ? (
        <GoalsAnalysis 
          transactions={transactions} 
          userProfile={userProfile} 
          updateProfile={updateProfile}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
          formatPercent={formatPercent}
          quotes={quotes}
          fxRate={fxRate}
        />
      ) : activeTab === 'health' ? (
        <HealthAnalysis />
      ) : (
        <AIIntelligence />
      )}
    </div>
  );
}

function GoalsAnalysis({ transactions, userProfile, updateProfile, formatCurrency, formatNumber, formatPercent, quotes, fxRate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localEdit, setLocalEdit] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const START_DATE = `${currentYear}-04-23`; 
  const getVal = (key, def) => {
    // Priority 1: Local edit state if we are editing
    if (isEditing && localEdit && localEdit[key] !== undefined) return localEdit[key];
    // Priority 2: User profile from context
    if (userProfile && userProfile[key] !== undefined && userProfile[key] !== null) return userProfile[key];
    // Priority 3: Default fallback
    return def;
  };

  const displayValues = useMemo(() => ({
    q1Target: getVal('q1Target', 1000),
    q2Target: getVal('q2Target', 1000),
    q3Target: getVal('q3Target', 1000),
    q4Target: getVal('q4Target', 1000),
    annualYieldTarget: getVal('annualYieldTarget', 8),
    baselineValue: getVal('baselineValue', 57000)
  }), [userProfile, localEdit, isEditing]);

  const handleStartEdit = () => {
    setLocalEdit({ ...displayValues });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!localEdit || Object.keys(localEdit).length === 0) return;
    setIsSaving(true);
    console.log('PLATINUM: Guardando objetivos...', localEdit);
    updateProfile(localEdit);
    
    // Use a small delay to let the context update before switching view
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
    }, 300);
  };

  // Calculate Actuals per Quarter (since START_DATE)
  const qActuals = useMemo(() => {
    const res = { q1: 0, q2: 0, q3: 0, q4: 0 };
    if (!transactions) return res;

    transactions.forEach(t => {
      if (!t.date || t.date < START_DATE) return;
      const month = parseInt(t.date.substring(5, 7));
      const amt = Math.abs(Number(t.total) || 0);
      const isAportacion = ['Compra', 'Depósito', 'Aportación'].includes(t.operation);
      if (!isAportacion) return;

      if (month <= 3) res.q1 += amt;
      else if (month <= 6) res.q2 += amt;
      else if (month <= 9) res.q3 += amt;
      else res.q4 += amt;
    });
    return res;
  }, [transactions, START_DATE]);

  // Calculate YTD Yield
  const ytdMetrics = useMemo(() => {
    let currentNetWorth = 0;
    let newInvestedInPeriod = 0; 
    let ytdIncomeTotal = 0;
    const entityAssetMap = {};

    if (!transactions) return { ytdProfitPct: 0, ytdProfit: 0 };

    [...transactions].sort((a,b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
      const amt = Number(t.total) || 0;
      const mult = (t.operation === 'Venta' || t.operation === 'Retirada') ? -1 : 1;
      const isBeforeStart = t.date && t.date < START_DATE;
      const isIncome = t.operation === 'Intereses' || t.operation === 'Dividendos';

      if (!isBeforeStart) {
        if (isIncome) {
          ytdIncomeTotal += amt;
          return;
        }
        if (t.operation !== 'Saldo Inicial') {
          newInvestedInPeriod += (amt * mult);
        }
      }

      const symbol = (t.symbol || t.name || '').toUpperCase();
      const key = `${t.entityId}_${symbol}`;
      if (!entityAssetMap[key]) entityAssetMap[key] = { symbol, shares: 0, invested: 0, sold: 0 };
      entityAssetMap[key].shares += (t.shares || 0) * mult;
      entityAssetMap[key].invested += (mult > 0 ? amt : 0);
      entityAssetMap[key].sold += (mult < 0 ? amt : 0);
    });

    Object.values(entityAssetMap).forEach(data => {
      const qKey = Object.keys(quotes || {}).find(k => k.toUpperCase() === data.symbol);
      const q = qKey ? quotes[qKey] : {};
      const effectiveFxRate = fxRate || 1.10;
      const livePrice = q.currency === 'USD' ? (q.price / effectiveFxRate) : (q.price || 0);
      const val = (data.symbol && q.price) ? (data.shares * livePrice) : (data.invested - data.sold);
      if (val > 0) currentNetWorth += val;
    });

    const baseline = Number(displayValues.baselineValue) || 57000;
    const ytdProfit = (currentNetWorth - baseline - newInvestedInPeriod) + ytdIncomeTotal;
    const ytdProfitPct = (baseline + newInvestedInPeriod) > 1 ? (ytdProfit / (baseline + newInvestedInPeriod)) * 100 : 0;
    
    return { ytdProfitPct, ytdProfit };
  }, [transactions, quotes, fxRate, START_DATE, displayValues.baselineValue]);

  const quarters = [
    { id: 'q1', label: '1º Trimestre (Ene-Mar)', target: displayValues.q1Target, actual: qActuals.q1 },
    { id: 'q2', label: '2º Trimestre (Abr-Jun)', target: displayValues.q2Target, actual: qActuals.q2 },
    { id: 'q3', label: '3º Trimestre (Jul-Sep)', target: displayValues.q3Target, actual: qActuals.q3 },
    { id: 'q4', label: '4º Trimestre (Oct-Dic)', target: displayValues.q4Target, actual: qActuals.q4 },
  ];

  return (
    <div className="wizard-slide-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Trophy size={24} style={{ color: '#FFD700' }} /> Plan Estratégico {currentYear}
        </h2>
        <button 
          className="btn btn-secondary" 
          onClick={isEditing ? handleSave : handleStartEdit}
          style={{ background: isEditing ? 'var(--success)' : '', color: isEditing ? '#fff' : '' }}
        >
          {isEditing ? <><Save size={16} /> Guardar Cambios</> : <><Edit3 size={16} /> Ajustar Objetivos</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>
        {/* Quarter Tracker */}
        <div className="glass-panel" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, margin: 0 }}>Seguimiento de Aportaciones</h3>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total {currentYear}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>{formatCurrency(qActuals.q1 + qActuals.q2 + qActuals.q3 + qActuals.q4)}</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gap: 20 }}>
            {quarters.map((q) => {
              const progress = Math.min(100, (q.actual / (q.target || 1)) * 100);
              const isDone = q.actual >= q.target;
              return (
                <div key={q.id} className="goal-card" style={{ padding: '20px 24px', background: 'rgba(126, 145, 177, 0.03)', borderRadius: 20, border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{q.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{formatCurrency(q.actual)} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>/ {isEditing ? '' : formatCurrency(q.target)}</span></div>
                    </div>
                    {isDone ? <Trophy size={28} style={{ color: '#FFD700', opacity: 0.8 }} /> : <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatPercent(progress)}%</div>}
                  </div>
                  
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                       <span style={{ fontSize: 11, fontWeight: 700 }}>META:</span>
                       <input 
                         type="number" 
                         className="goal-input"
                         value={localEdit[`${q.id}Target`]} 
                         onChange={e => setLocalEdit({...localEdit, [`${q.id}Target`]: Number(e.target.value)})} 
                       />
                    </div>
                  ) : (
                    <div style={{ height: 6, background: 'rgba(126, 145, 177, 0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: isDone ? 'var(--success)' : 'var(--accent)', transition: 'width 0.6s ease' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div style={{ marginTop: 24, padding: 20, background: 'rgba(0, 113, 227, 0.05)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0, 113, 227, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Activity size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Aportación Media</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{formatCurrency((qActuals.q1 + qActuals.q2 + qActuals.q3 + qActuals.q4) / (new Date().getMonth() + 1))}/mes</div>
              </div>
            </div>
            <ArrowRight size={20} style={{ opacity: 0.3 }} />
          </div>
        </div>

        {/* Yield Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div className="glass-panel" style={{ padding: 40, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 24, letterSpacing: 1, fontWeight: 700 }}>Meta de Rentabilidad Anual</h3>
            
            <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="200" height="200" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(126, 145, 177, 0.1)" strokeWidth="8" />
                 <circle 
                   cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="8" 
                   strokeDasharray={283}
                   strokeDashoffset={283 - (283 * Math.min(1, ytdMetrics.ytdProfitPct / (displayValues.annualYieldTarget || 1)))}
                   strokeLinecap="round"
                   transform="rotate(-90 50 50)"
                   style={{ transition: 'stroke-dashoffset 1s ease' }}
                 />
               </svg>
               <div style={{ position: 'absolute' }}>
                 <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-main)' }}>{formatPercent(ytdMetrics.ytdProfitPct)}%</div>
                 <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Real YTD</div>
               </div>
            </div>

            <div style={{ marginTop: 32 }}>
              {isEditing ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, width: 100 }}>META (%):</span>
                    <input 
                      type="number" 
                      className="goal-input"
                      value={localEdit.annualYieldTarget} 
                      onChange={e => setLocalEdit({...localEdit, annualYieldTarget: Number(e.target.value)})} 
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, width: 100 }}>BASE (€):</span>
                    <input 
                      type="number" 
                      className="goal-input"
                      value={localEdit.baselineValue} 
                      onChange={e => setLocalEdit({...localEdit, baselineValue: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Objetivo: {displayValues.annualYieldTarget}%</div>
                  <div style={{ fontSize: 13, color: ytdMetrics.ytdProfitPct >= displayValues.annualYieldTarget ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {ytdMetrics.ytdProfitPct >= displayValues.annualYieldTarget ? '¡Objetivo superado!' : `Te falta un ${formatPercent(displayValues.annualYieldTarget - ytdMetrics.ytdProfitPct)}%`}
                  </div>
                </>
              )}
            </div>
            
            <div style={{ marginTop: 24, padding: '12px 20px', background: 'rgba(126, 145, 177, 0.05)', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
              Beneficio YTD: <span style={{ color: ytdMetrics.ytdProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(ytdMetrics.ytdProfit)}</span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 32, background: 'linear-gradient(135deg, var(--accent) 0%, #4a4ae6 100%)', color: '#fff' }}>
            <h3 style={{ fontSize: 13, opacity: 0.8, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1, fontWeight: 700 }}>Consejo de Estrategia</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
              {ytdMetrics.ytdProfitPct >= displayValues.annualYieldTarget 
                ? "Vas por delante de tu plan. Podrías considerar reducir el riesgo o simplemente disfrutar del exceso de rentabilidad para tus metas futuras."
                : "Para alcanzar tu meta del " + displayValues.annualYieldTarget + "%, asegúrate de mantener tus aportaciones constantes. El interés compuesto hará el resto si mantienes el rumbo."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


function HealthAnalysis() {
  const { transactions, quotes, fxRate, assetsMetadata, syncProgress, formatCurrency, formatPercent, fetchData } = useData();
  const [isSyncing, setIsSyncing] = useState(false);

  const [showClassification, setShowClassification] = useState(false);
  const [editingMeta, setEditingMeta] = useState({});

  const handleOpenClassification = () => {
    setEditingMeta({ ...assetsMetadata });
    setShowClassification(true);
  };

  const handleSaveClassification = async () => {
    try {
      // Save all to db and context
      const symbolsToSave = Object.keys(editingMeta);
      
      for (const sym of symbolsToSave) {
        const meta = editingMeta[sym];
        if (!meta) continue;
        
        // Only save if there is actually something to save
        if (meta.sector || meta.country) {
          const payload = { 
            symbol: sym, 
            sector: meta.sector || 'Otros', 
            industry: 'Otros', 
            country: meta.country || 'Global', 
            description: '' 
          };
          await window.api.saveAssetMetadata(payload);
        }
      }
      
      await fetchData();
      setShowClassification(false);
      alert('Clasificación guardada con éxito');
    } catch (err) {
      console.error('Error saving classification:', err);
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    }
  };

  const assetNames = useMemo(() => {
    const names = {};
    if (!transactions) return names;
    transactions.forEach(t => {
      const sym = (t.symbol || t.name || '').toUpperCase();
      if (sym && t.name && (!names[sym] || names[sym] === sym)) {
        names[sym] = t.name;
      }
    });
    Object.entries(quotes).forEach(([sym, q]) => {
      if (q.shortName) names[sym.toUpperCase()] = q.shortName;
    });
    return names;
  }, [transactions, quotes]);

  const uniqueSymbols = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map(t => (t.symbol || t.name || '').toUpperCase()))].filter(Boolean);
  }, [transactions]);

  const healthData = useMemo(() => {
    if (!transactions) return { totalVal: 0, sectorData: [], countryData: [], assetRisk: [] };

    const holdings = {};
    const sortedTxns = [...transactions].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    
    sortedTxns.forEach(t => {
      const symbol = (t.symbol || t.name || 'Unknown').toUpperCase();
      const key = `${t.entityId}_${symbol}`;
      if (!holdings[key]) holdings[key] = { symbol, shares: 0, invested: 0 };
      
      const mult = ['Venta', 'Retirada', 'Retiro'].includes(t.operation) ? -1 : 1;
      holdings[key].shares += (Number(t.shares) || 0) * mult;
      if (mult > 0) holdings[key].invested += Math.abs(Number(t.total) || 0);
      else holdings[key].invested -= Math.abs(Number(t.total) || 0);
    });

    let totalVal = 0;
    const items = [];
    Object.values(holdings).forEach(h => {
      if (h.shares > 0.0001) {
        const q = quotes[h.symbol] || {};
        const price = q.price || 0;
        const effectivePrice = q.currency === 'USD' ? (price / (fxRate || 1.10)) : price;
        const val = effectivePrice > 0 ? (h.shares * effectivePrice) : h.invested;
        totalVal += val;
        items.push({ ...h, currentVal: val });
      }
    });

    const sectorMap = {};
    const countryMap = {};
    const assetRisk = [];
    let unclassifiedVal = 0;

    items.forEach(h => {
      const meta = assetsMetadata[h.symbol] || { sector: 'Pendiente de identificar', country: 'Pendiente de identificar' };
      const weight = totalVal > 0 ? (h.currentVal / totalVal) * 100 : 0;

      sectorMap[meta.sector] = (sectorMap[meta.sector] || 0) + h.currentVal;
      countryMap[meta.country] = (countryMap[meta.country] || 0) + h.currentVal;

      if (meta.sector === 'Pendiente de identificar' || meta.country === 'Pendiente de identificar') {
        unclassifiedVal += h.currentVal;
      }

      if (weight > 15) {
        assetRisk.push({ 
          name: assetNames[h.symbol] || h.symbol, 
          symbol: h.symbol, 
          weight, 
          type: 'concentration' 
        });
      }
    });

    if (unclassifiedVal > 0) {
      const unclassifiedPct = totalVal > 0 ? (unclassifiedVal / totalVal) * 100 : 0;
      assetRisk.push({
        name: 'Activos sin clasificar',
        weight: unclassifiedPct,
        type: 'missing_metadata'
      });
    }

    const COLORS = ['#7E91B1', '#899A81', '#BFA89A', '#D9CD96', '#BDE0FE', '#A29BBD', '#FFD700', '#D18B8B'];

    const sectorData = Object.entries(sectorMap).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] })).sort((a,b) => b.value - a.value);
    const countryData = Object.entries(countryMap).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] })).sort((a,b) => b.value - a.value);

    // Calculate score: Base 10. Subtract for concentration and for missing metadata.
    let score = 10;
    assetRisk.forEach(r => {
      if (r.type === 'concentration') score -= 1.5;
      if (r.type === 'missing_metadata') score -= (r.weight / 10); // Penalty proportional to weight
    });
    score = Math.max(1, Math.min(10, score));

    return { totalVal, sectorData, countryData, assetRisk, score };
  }, [transactions, quotes, fxRate, assetsMetadata]);

  return (
    <div className="wizard-slide-enter">
      {showClassification && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 15, 30, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: 700, padding: 32, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Clasificación Manual de Activos</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Asigna el sector y país a tus activos para que las gráficas de diversificación funcionen correctamente.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16, marginBottom: 12, fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <div>Activo / Símbolo</div>
              <div>Sector Principal</div>
              <div>Región / País</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {uniqueSymbols.map(sym => (
                <div key={sym} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{assetNames[sym] || sym}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{sym}</div>
                  </div>
                  <input 
                    placeholder="Ej: Tecnología"
                    value={editingMeta[sym]?.sector === 'Pendiente de identificar' ? '' : (editingMeta[sym]?.sector || '')}
                    onChange={e => setEditingMeta(prev => ({ ...prev, [sym]: { ...prev[sym], sector: e.target.value } }))}
                    style={{ padding: '8px 12px' }}
                  />
                  <input 
                    placeholder="Ej: Estados Unidos"
                    value={editingMeta[sym]?.country === 'Pendiente de identificar' ? '' : (editingMeta[sym]?.country || '')}
                    onChange={e => setEditingMeta(prev => ({ ...prev, [sym]: { ...prev[sym], country: e.target.value } }))}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowClassification(false)}>Cancelar</button>
              <button className="btn" onClick={handleSaveClassification} style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}>Guardar Clasificación</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 20 }}>
        {/* Column 1: Sectors */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Briefcase size={18} className="text-accent" /> Sectores
          </h3>
          <div style={{ height: 180, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthData.sectorData} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                  {healthData.sectorData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 250, paddingRight: 4 }}>
             {healthData.sectorData.map(d => (
               <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(126, 145, 177, 0.03)', borderRadius: 8 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                   <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                   <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                 </div>
                 <span style={{ fontSize: 11, fontWeight: 800, marginLeft: 8 }}>{formatPercent((d.value / (healthData.totalVal || 1)) * 100)}%</span>
               </div>
             ))}
          </div>
        </div>

        {/* Column 2: Geography */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={18} className="text-accent" /> Geografía
          </h3>
          <div style={{ height: 180, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthData.countryData} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                  {healthData.countryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 250, paddingRight: 4 }}>
             {healthData.countryData.map(d => (
               <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(126, 145, 177, 0.03)', borderRadius: 8 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                   <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                   <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                 </div>
                 <span style={{ fontSize: 11, fontWeight: 800, marginLeft: 8 }}>{formatPercent((d.value / (healthData.totalVal || 1)) * 100)}%</span>
               </div>
             ))}
          </div>
        </div>

        {/* Column 3: Alerts & Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button 
            onClick={handleOpenClassification} 
            className="btn" 
            style={{ 
              background: 'var(--accent)', 
              color: 'white',
              border: 'none', 
              padding: '12px 20px', 
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              fontSize: 14,
              fontWeight: 800,
              boxShadow: '0 8px 20px rgba(0, 113, 227, 0.2)',
              width: '100%'
            }}
          >
            <Edit3 size={18} /> Clasificar Activos
          </button>

          <div className="glass-panel" style={{ padding: 24, border: '1px solid var(--border)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} className="text-accent" /> Alertas
            </h3>
            {healthData.assetRisk.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <ShieldCheck size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ fontSize: 12, fontWeight: 600 }}>Sin riesgos críticos.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, overflowY: 'auto', paddingRight: 4 }}>
                {healthData.assetRisk.map((r, i) => (
                  <div key={i} style={{ 
                    padding: 14, 
                    background: r.type === 'concentration' ? 'rgba(255, 59, 48, 0.05)' : 'rgba(255, 159, 10, 0.05)', 
                    borderRadius: 12, 
                    border: `1px solid ${r.type === 'concentration' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 159, 10, 0.1)'}` 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {r.type === 'concentration' ? <Zap size={14} style={{ color: 'var(--danger)' }} /> : <Info size={14} style={{ color: 'var(--warning)' }} />}
                      <span style={{ fontWeight: 800, color: r.type === 'concentration' ? 'var(--danger)' : 'var(--warning)', fontSize: 10, textTransform: 'uppercase' }}>
                        {r.type === 'concentration' ? 'Concentración' : 'Pendiente'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                      {r.type === 'concentration' ? (
                        <><strong>{r.name}</strong> al <strong>{formatPercent(r.weight)}%</strong>.</>
                      ) : (
                        <>Un <strong>{formatPercent(r.weight)}%</strong> sin clasificar.</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.1), transparent)' }}>
             <h3 style={{ fontSize: 10, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 8 }}>Puntuación</h3>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
               <span style={{ fontSize: 32, fontWeight: 900 }}>{healthData.score.toFixed(1)}</span>
               <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>/10</span>
             </div>
             <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>Diversificación y límites de riesgo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

