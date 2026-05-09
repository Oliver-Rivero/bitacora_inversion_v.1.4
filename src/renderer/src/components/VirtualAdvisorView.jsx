import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  BrainCircuit, ChevronRight, Target, Shield, 
  RotateCcw, Zap, Sparkles, TrendingUp, 
  Fuel, Wallet, Info, FileText,
  Plus, Trash2, LineChart as LineChartIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const SCENARIOS = [
  { id: 'low', label: 'Conservador', roi: 0.04, color: '#7E91B1' },
  { id: 'medium', label: 'Equilibrado', roi: 0.065, color: '#A29BBD' },
  { id: 'high', label: 'Agresivo', roi: 0.09, color: '#6CA57B' }
];

export default function VirtualAdvisorView() {
  const { 
    transactions, quotes, fxRate, userProfile, updateProfile, 
    milestones, addMilestone, removeMilestone, resetMilestones,
    formatCurrency 
  } = useData();

  const [activeTab, setActiveTab] = useState('insights'); // insights | milestones | strategy
  
  // Strategy State
  const [editProfile, setEditProfile] = useState(userProfile);
  useEffect(() => { setEditProfile(userProfile); }, [userProfile]);

  // Hitos State
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ label: '', target: '', type: 'capital' });

  // --- Calculations ---
  const stats = useMemo(() => {
    let netWorth = 0;
    let annualDividends = 0;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    const assetSummary = {};
    transactions.forEach(t => {
      const key = t.symbol || t.name;
      if (!key) return;
      if (!assetSummary[key]) assetSummary[key] = { shares: 0, invested: 0, sold: 0 };
      if (t.operation === 'Dividendos' || t.operation === 'Intereses') {
        if (t.date >= oneYearAgoStr) annualDividends += t.total;
        return;
      }
      const mult = (t.operation === 'Venta') ? -1 : 1;
      assetSummary[key].shares += (t.shares || 0) * mult;
      if (mult > 0) assetSummary[key].invested += t.total;
      else assetSummary[key].sold += t.total;
    });

    Object.entries(assetSummary).forEach(([symbol, data]) => {
      const q = quotes[symbol] || {};
      const livePrice = q.currency === 'USD' ? (q.price / fxRate) : (q.price || 0);
      const val = q.price ? (data.shares * livePrice) : (data.invested - data.sold);
      if (val > 0) netWorth += val;
    });

    return { netWorth, annualDividends };
  }, [transactions, quotes, fxRate]);

  // --- Multi-Scenario Projection Logic ---
  const projectionData = useMemo(() => {
    const monthlyInvestment = userProfile.monthlySavings || 0;
    const initial = stats.netWorth || 0;
    const years = [0, 5, 10, 15, 20, 25, 30];
    
    return years.map(year => {
      const months = year * 12;
      const point = { year: `Año ${year}` };
      
      SCENARIOS.forEach(sc => {
        const monthlyR = sc.roi / 12;
        let fv = initial * Math.pow(1 + monthlyR, months);
        if (monthlyR > 0) {
          fv += monthlyInvestment * ( (Math.pow(1 + monthlyR, months) - 1) / monthlyR );
        } else {
          fv += monthlyInvestment * months;
        }
        point[sc.id] = Math.round(fv);
      });
      
      return point;
    });
  }, [stats.netWorth, userProfile.monthlySavings]);

  const handleSaveProfile = () => {
    updateProfile(editProfile);
  };

  if (!userProfile.completed && activeTab !== 'strategy') {
    return (
      <div className="ai-wizard-container">
        <div className="ai-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <BrainCircuit size={64} className="ai-gradient-text" style={{ marginBottom: 24 }} />
          <h1>Configura tu Estrategia</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Basa tus proyecciones en datos reales de tu cartera.</p>
          <button className="btn" onClick={() => setActiveTab('strategy')}>
            <Zap size={18} /> Configurar Ahora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-wizard-container" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1><Sparkles className="ai-gradient-text" size={32} /> Asesor Virtual </h1>
          <p style={{ color: 'var(--text-muted)' }}>Herramienta de Simulación Patrimonial Comparativa</p>
        </div>
        
        <div className="tab-group glass-panel" style={{ display: 'flex', padding: 4, borderRadius: 12 }}>
          <button className={clsx('btn-tab', activeTab === 'insights' && 'active')} onClick={() => setActiveTab('insights')}>Resumen</button>
          <button className={clsx('btn-tab', activeTab === 'milestones' && 'active')} onClick={() => setActiveTab('milestones')}>Mis Hitos</button>
          <button className={clsx('btn-tab', activeTab === 'strategy' && 'active')} onClick={() => setActiveTab('strategy')}>Estrategia y Proyección</button>
        </div>
      </div>

      {activeTab === 'insights' && (
        <div className="wizard-slide-enter">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="ai-card" style={{ padding: 32 }}>
              <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={20} color="var(--accent)" /> Salud Patrimonial</h2>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Patrimonio en Tiempo Real</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(stats.netWorth)}</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
                  Tu cartera hoy tiene un valor analítico ajustado de {formatCurrency(stats.netWorth)}. El algoritmo proyecta tu evolución basándose en una inversión mensual de **{formatCurrency(userProfile.monthlySavings)}**.
                </p>
              </div>
            </div>

            <div className="ai-card" style={{ padding: 32 }}>
              <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Fuel size={20} color="var(--accent)" /> Flujo Pasivo Anual</h2>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Dividendos/Intereses (12m)</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(stats.annualDividends)}</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
                  Has recolectado {formatCurrency(stats.annualDividends)} en rentas pasivas. A un 4% de rentabilidad, este flujo equivale a tener "trabajando" para ti un capital extra de {formatCurrency(stats.annualDividends / 0.04)}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="wizard-slide-enter ai-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h2 style={{ margin: 0 }}>Mis Objetivos Financieros</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-small" onClick={() => setShowAddMilestone(!showAddMilestone)}><Plus size={16} /> Nuevo Hito</button>
              <button className="btn-small btn-danger-soft" onClick={() => { if(confirm('¿Reiniciar hitos?')) resetMilestones() }}><RotateCcw size={14} /></button>
            </div>
          </div>

          {showAddMilestone && (
            <form onSubmit={(e) => { e.preventDefault(); addMilestone({...newMilestone, target: Number(newMilestone.target)}); setShowAddMilestone(false); }} className="glass-panel" style={{ padding: 20, marginBottom: 32, borderRadius: 16, border: '1px solid var(--accent)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: 12, alignItems: 'center' }}>
                <input placeholder="Hito (ej: Vacaciones)" value={newMilestone.label} onChange={e => setNewMilestone({...newMilestone, label: e.target.value})} required />
                <input type="number" placeholder="Objetivo (€)" value={newMilestone.target} onChange={e => setNewMilestone({...newMilestone, target: e.target.value})} required />
                <select value={newMilestone.type} onChange={e => setNewMilestone({...newMilestone, type: e.target.value})}>
                  <option value="capital">Patrimonio</option>
                  <option value="passive">Rentabilidad</option>
                </select>
                <button type="submit" className="btn-icon"><ChevronRight size={20} /></button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {milestones.map(m => {
              const current = m.type === 'capital' ? stats.netWorth : stats.annualDividends;
              const pct = Math.min(100, (current / m.target) * 100);
              const isLocked = current < m.target;
              return (
                <div key={m.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Target size={16} color={isLocked ? 'var(--text-muted)' : 'var(--success)'} />
                      <span style={{ fontWeight: 600 }}>{m.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: isLocked ? 'var(--text-muted)' : 'var(--success)', fontWeight: 700 }}>
                        {isLocked ? `${formatCurrency(current)} / ${formatCurrency(m.target)}` : '¡COMPLETADO!'}
                      </span>
                      <button className="btn-icon-tiny" onClick={() => removeMilestone(m.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="progress-bar-container" style={{ height: 6 }}><div className="progress-bar-fill" style={{ width: `${pct}%`, background: isLocked ? 'var(--accent)' : 'var(--success)' }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'strategy' && (
        <div className="wizard-slide-enter">
          {/* Simulation Header */}
          <div className="ai-card" style={{ padding: 32, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0 }}>Simulador Comparativo</h2>
              <button className="btn-small" onClick={handleSaveProfile}><Shield size={16} /> Guardar Escenario</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Inversión Mensual Recurrente (€)</label>
                <input 
                  type="number" 
                  value={editProfile.monthlySavings} 
                  onChange={e => setEditProfile({...editProfile, monthlySavings: Number(e.target.value)})} 
                  style={{ fontSize: 18, padding: '12px 16px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Perfil Actual para IA</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {SCENARIOS.map(sc => (
                    <button 
                      key={sc.id} 
                      className={clsx('btn-small', editProfile.risk === sc.id && 'active')}
                      onClick={() => setEditProfile({...editProfile, risk: sc.id})}
                      style={{ height: '100%', justifyContent: 'center' }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div style={{ padding: '24px 0' }}>
              <h3 style={{ fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><LineChartIcon size={18} /> Proyección según Perfiles de Riesgo</h3>
              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectionData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={val => `${(val/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    {SCENARIOS.map(sc => (
                      <Line 
                        key={sc.id}
                        type="monotone" 
                        dataKey={sc.id} 
                        name={sc.label}
                        stroke={sc.color} 
                        strokeWidth={editProfile.risk === sc.id ? 4 : 1.5}
                        opacity={editProfile.risk === sc.id ? 1 : 0.25}
                        dot={editProfile.risk === sc.id ? { r: 4 } : false}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table Comparison */}
          <div className="ai-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 24 }}>Comparativa de Hitos Temporales</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)' }}>Horizonte</th>
                    {SCENARIOS.map(sc => (
                      <th key={sc.id} style={{ textAlign: 'right', padding: '12px 8px', color: sc.color }}>
                        {sc.label} ({(sc.roi*100).toFixed(2)}%)
                        {editProfile.risk === sc.id && <span style={{display: 'block', fontSize: 9}}>TU PERFIL</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[10, 20, 30].map(yr => (
                    <tr key={yr} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px 8px', fontWeight: 600 }}>{yr} Años</td>
                      {SCENARIOS.map(sc => {
                        const val = projectionData.find(d => d.year === `Año ${yr}`)?.[sc.id];
                        return (
                          <td key={sc.id} style={{ textAlign: 'right', padding: '16px 8px', fontWeight: editProfile.risk === sc.id ? 700 : 400 }}>
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-tab { padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 8px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
        .btn-tab.active { background: var(--accent); color: white; box-shadow: 0 4px 12px rgba(126, 145, 177, 0.3); }
        .btn-small { padding: 8px 14px; font-size: 12px; font-weight: 600; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer; border: none; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .btn-small:hover { background: rgba(255,255,255,0.1); }
        .btn-small.active { background: var(--accent); color: white; }
        .btn-danger-soft { background: rgba(220, 38, 38, 0.05); color: var(--danger); }
        .btn-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .btn-icon-tiny { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
      `}</style>
    </div>
  );
}
