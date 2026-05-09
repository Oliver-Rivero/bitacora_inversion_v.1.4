import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Calculator, Wrench, RotateCcw, TrendingUp, TrendingDown, 
  Sparkles, Trophy, Info
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

export default function ToolsView() {
  const { formatCurrency, formatNumber, formatPercent, transactions, quotes, entities, fxRate } = useData();
  const [activeTool, setActiveTool] = useState('compound'); // 'compound' | 'fire'

  // Helper to calculate Net Worth (replicated from Dashboard logic)
  const currentNetWorth = useMemo(() => {
    if (!transactions || !entities) return 0;
    
    const entityAssetMap = {};
    transactions.forEach(t => {
      const symbol = (t.symbol || t.name || '').toUpperCase();
      const sharesNum = t.shares || 0;
      const val = t.total || (t.shares * t.unitPrice) || 0;
      const mult = (t.operation === 'Venta' || t.operation === 'Retirada') ? -1 : 1;
      
      const key = `${t.entityId}_${symbol}`;
      if (!entityAssetMap[key]) {
        entityAssetMap[key] = { shares: 0, invested: 0, sold: 0 };
      }
      entityAssetMap[key].shares += sharesNum * mult;
      if (mult > 0) entityAssetMap[key].invested += val;
      else entityAssetMap[key].sold += val;
    });

    let nw = 0;
    Object.entries(entityAssetMap).forEach(([key, data]) => {
      const symbol = key.split('_')[1];
      const qKey = Object.keys(quotes).find(k => k.toUpperCase() === symbol);
      const q = qKey ? quotes[qKey] : {};
      const isUSD = q.currency === 'USD';
      const effectiveFxRate = fxRate || 1.10;
      const livePrice = isUSD ? (q.price / effectiveFxRate) : (q.price || 0);

      const currentVal = (symbol && q.price) ? (data.shares * livePrice) : (data.invested - data.sold);
      if (currentVal > 0) nw += currentVal;
    });

    return nw;
  }, [transactions, entities, quotes, fxRate]);
  
  return (
    <div className="wizard-slide-enter">
      <style>{styles}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 14, fontWeight: 900, margin: 0 }}>
          <Wrench size={36} className="text-accent" /> Herramientas Financieras
        </h1>
        
        <div className="glass-panel" style={{ display: 'flex', padding: 6, borderRadius: 14, background: 'rgba(126, 145, 177, 0.05)' }}>
          <button 
            className={`tool-tab ${activeTool === 'compound' ? 'active' : ''}`}
            onClick={() => setActiveTool('compound')}
          >
            <TrendingUp size={16} /> Interés Compuesto
          </button>
          <button 
            className={`tool-tab ${activeTool === 'fire' ? 'active' : ''}`}
            onClick={() => setActiveTool('fire')}
          >
            <Sparkles size={16} /> Libertad Financiera
          </button>
        </div>
      </div>

      {activeTool === 'compound' ? (
        <div className="glass-panel" style={{ padding: 40, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
               <Calculator size={28} className="text-accent" />
               <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Calculadora de Interés Compuesto</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 800 }}>
            Simula el crecimiento de tu capital a largo plazo gracias al poder del interés compuesto. Ajusta los parámetros para ver cómo influye el tiempo y la rentabilidad en tu patrimonio.
          </p>

          <CompoundCalculator />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 40, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
               <Trophy size={28} style={{ color: '#FFD700' }} />
               <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Calculadora de Libertad Financiera (FIRE)</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 800 }}>
            Descubre cuánto capital necesitas para vivir de tus rentas siguiendo la <strong>Regla del 4%</strong>. Analizamos tu patrimonio actual para decirte qué tan cerca estás de tu objetivo.
          </p>

          <FinancialFreedomCalculator currentNetWorth={currentNetWorth} />
        </div>
      )}
    </div>
  );
}

function FinancialFreedomCalculator({ currentNetWorth }) {
  const { formatCurrency, formatNumber, formatPercent } = useData();
  const [monthlyExpenses, setMonthlyExpenses] = useState(2000);
  const [withdrawalRate, setWithdrawalRate] = useState(4); // %

  const fireNumber = useMemo(() => {
    return (monthlyExpenses * 12) / (withdrawalRate / 100);
  }, [monthlyExpenses, withdrawalRate]);

  const progress = Math.min(100, (currentNetWorth / fireNumber) * 100);

  const levels = [
    { name: 'Lean FIRE', factor: 0.7, color: '#90CAF9', desc: 'Gastos mínimos cubiertos.' },
    { name: 'FIRE', factor: 1, color: '#66BB6A', desc: 'Nivel de vida actual cubierto.' },
    { name: 'Fat FIRE', factor: 1.5, color: '#FFA726', desc: 'Nivel de vida con lujos.' }
  ];

  return (
    <div className="wizard-slide-enter">
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 40 }}>
        <div className="glass-panel" style={{ padding: 32, alignSelf: 'start' }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 32, letterSpacing: 1 }}>Parámetros de Estilo de Vida</h3>
          
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>GASTOS MENSUALES DESEADOS</label>
              <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(monthlyExpenses)}</span>
            </div>
            <input 
              type="range" min="500" max="10000" step="100"
              value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TASA DE RETIRO SEGURO (SWR)</label>
              <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{withdrawalRate}%</span>
            </div>
            <input 
              type="range" min="2" max="6" step="0.1"
              value={withdrawalRate} onChange={e => setWithdrawalRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 6 }}>
              <Info size={12} /> La regla estándar recomienda un 4%.
            </div>
          </div>

          <div style={{ padding: 20, background: 'rgba(126, 145, 177, 0.05)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>PATRIMONIO ACTUAL</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)' }}>{formatCurrency(currentNetWorth)}</div>
          </div>
        </div>

        <div>
          <div className="glass-panel" style={{ padding: 40, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Tu Número FIRE es:</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--text-main)', marginBottom: 16 }}>{formatCurrency(fireNumber)}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 500 }}>
                Este es el capital que necesitas para generar {formatCurrency(monthlyExpenses)} al mes de forma indefinida.
              </p>
            </div>
            <Sparkles size={120} style={{ position: 'absolute', right: -20, top: -20, opacity: 0.05, color: 'var(--accent)' }} />
          </div>

          <div className="glass-panel" style={{ padding: 40, marginTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Estado de Libertad</h3>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)' }}>{formatPercent(progress)}%</div>
            </div>
            
            <div style={{ height: 24, background: 'rgba(126, 145, 177, 0.1)', borderRadius: 12, overflow: 'hidden', marginBottom: 40 }}>
              <div style={{ 
                height: '100%', 
                width: `${progress}%`, 
                background: 'linear-gradient(90deg, var(--accent) 0%, #4CD964 100%)',
                boxShadow: '0 0 20px rgba(0, 113, 227, 0.4)',
                transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {levels.map(level => {
                const target = fireNumber * level.factor;
                const isReached = currentNetWorth >= target;
                return (
                  <div key={level.name} style={{ padding: 20, borderRadius: 16, background: 'rgba(126, 145, 177, 0.03)', border: '1px solid var(--border)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: level.color }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{level.name}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>{formatCurrency(target)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{level.desc}</div>
                    {isReached && <Trophy size={16} style={{ position: 'absolute', top: 20, right: 20, color: '#FFD700' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompoundCalculator() {
  const { formatCurrency, formatNumber, formatPercent } = useData();
  const [calcMode, setCalcMode] = useState('forward');
  const [principal, setPrincipal] = useState(10000);
  const [contribution, setContribution] = useState(500);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(8);
  const [targetCapital, setTargetCapital] = useState(100000);

  const COLORS = {
    initial: '#B39DDB', 
    periodic: '#64B5F6',
    interest: '#81C784' 
  };

  const calculatedValues = useMemo(() => {
    const i = (rate / 100) / 12;
    const n = Math.max(1, years * 12);
    const P = principal;
    const C = contribution;
    const FV = targetCapital;

    let resYears = years;
    let resContribution = contribution;
    let resRate = rate;

    if (calcMode === 'time') {
      if (P >= FV) resYears = 0;
      else {
        const months = Math.log((FV + Math.max(0.01, C/i)) / (P + Math.max(0.01, C/i))) / Math.log(1 + i);
        resYears = Math.round(months / 12 * 10) / 10;
      }
    } else if (calcMode === 'contribution') {
      const pow = Math.pow(1 + i, n);
      const denom = (pow - 1) / i;
      resContribution = Math.max(0, (FV - P * pow) / (denom || 1));
    } else if (calcMode === 'rate') {
      let low = 0, high = 1;
      for (let iter = 0; iter < 40; iter++) {
        let mid = (low + high) / 2;
        let testFV = P * Math.pow(1 + mid, n) + C * (Math.pow(1 + mid, n) - 1) / mid;
        if (testFV > FV) high = mid; else low = mid;
      }
      resRate = Math.round(low * 12 * 100 * 10) / 10;
    }

    return { 
      years: calcMode === 'time' ? resYears : years,
      contribution: calcMode === 'contribution' ? resContribution : contribution,
      rate: calcMode === 'rate' ? resRate : rate
    };
  }, [calcMode, principal, contribution, years, rate, targetCapital]);

  const data = useMemo(() => {
    const { years: yOut, contribution: cOut, rate: rOut } = calculatedValues;
    const monthlyRate = (rOut / 100) / 12;
    const totalMonths = Math.ceil(yOut * 12);
    
    let currentCapital = principal;
    let totalDeposits = principal;
    const result = [];

    for (let m = 0; m <= totalMonths; m++) {
      if (m % 12 === 0 || m === totalMonths) {
        const year = Math.floor(m / 12);
        const periodicAccum = totalDeposits - principal;
        const interestAccum = currentCapital - totalDeposits;

        result.push({
          label: year === 0 ? 'Inicio' : `${year}`,
          year,
          initial: principal,
          periodic: Math.round(periodicAccum),
          interest: Math.round(interestAccum),
          total: Math.round(currentCapital),
          periodicAnnual: cOut * 12
        });
      }

      if (m < totalMonths) {
        currentCapital = (currentCapital * (1 + monthlyRate)) + cOut;
        totalDeposits += cOut;
      }
    }
    return result;
  }, [principal, calculatedValues]);

  const finalData = data[data.length - 1] || { total: 0, initial: 0, periodic: 0, interest: 0 };
  const pieData = [
    { name: 'Balance Inicial', value: finalData.initial, color: COLORS.initial },
    { name: 'Depósito Periódicos', value: finalData.periodic, color: COLORS.periodic },
    { name: 'Interés total', value: finalData.interest, color: COLORS.interest },
  ];

  return (
    <div className="wizard-slide-enter" style={{ paddingBottom: 40 }}>
      {/* Selector de Modo */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Modo de Cálculo</label>
        <select 
          value={calcMode} 
          onChange={e => setCalcMode(e.target.value)}
          style={{ width: '100%', maxWidth: 600, padding: '14px 20px', background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-main)', fontSize: 16, outline: 'none' }}
        >
          <option value="forward">¿Cuánto puedo ahorrar? (Capital Final)</option>
          <option value="time">¿Cuánto tardaré en alcanzar mi objetivo?</option>
          <option value="contribution">¿Cuánto necesito ahorrar cada mes?</option>
          <option value="rate">¿Qué rentabilidad (%) necesito?</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 40 }}>
        <div className="glass-panel" style={{ padding: 32, alignSelf: 'start' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, fontSize: 18 }}>
            <Wrench size={20} className="text-accent" /> Parámetros
          </h3>

          {[
            { label: 'Inversión Inicial', val: principal, set: setPrincipal, min: 0, max: 200000, step: 1000 },
            ...(calcMode !== 'forward' ? [{ label: 'Objetivo Final', val: targetCapital, set: setTargetCapital, min: 1000, max: 2000000, step: 5000, color: 'var(--success)' }] : []),
            ...(calcMode !== 'contribution' ? [{ label: 'Aportación Mensual', val: contribution, set: setContribution, min: 0, max: 5000, step: 50 }] : []),
            ...(calcMode !== 'time' ? [{ label: 'Años', val: years, set: setYears, min: 1, max: 50, step: 1 }] : []),
            ...(calcMode !== 'rate' ? [{ label: 'Interés Anual (%)', val: rate, set: setRate, min: 0.1, max: 30, step: 0.1 }] : [])
          ].map((item, idx) => (
            <div key={idx} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</label>
                <input 
                  type="number" value={item.val} onChange={e => item.set(Number(e.target.value))}
                  style={{ 
                    width: 100, textAlign: 'right', 
                    background: 'rgba(126, 145, 177, 0.05)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 6,
                    padding: '4px 8px',
                    color: 'var(--text-main)', 
                    fontWeight: 700, fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>
              <input 
                type="range" min={item.min} max={item.max} step={item.step} 
                value={item.val} onChange={e => item.set(Number(e.target.value))} 
                style={{ width: '100%', accentColor: item.color || 'var(--accent)' }} 
              />
            </div>
          ))}

          <button className="btn btn-outline" style={{ width: '100%', marginTop: 20, justifyContent: 'center' }} onClick={() => { setPrincipal(10000); setContribution(500); setYears(20); setRate(8); setCalcMode('forward'); setTargetCapital(100000); }}>
            <RotateCcw size={16} /> Resetear
          </button>
        </div>

        <div>
          <div className="glass-panel" style={{ padding: 32, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{calcMode === 'forward' ? 'Puedes ahorrar' : 'Resultado proyectado'}</div>
              <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 8, color: 'var(--text-main)' }}>{formatCurrency(finalData.total)}</div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>
                {calcMode === 'time' ? `Necesitarías ${calculatedValues.years} años` : 
                 calcMode === 'contribution' ? `Ahorrando ${formatCurrency(calculatedValues.contribution)} al mes` :
                 calcMode === 'rate' ? `Con un interés del ${calculatedValues.rate}% anual` :
                 `Ahorro ${formatCurrency(contribution)} mensual durante ${years} años`}
              </div>

              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 40, width: 300 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, background: d.color, borderRadius: 2 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-main)' }}>{d.name}:</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: 220, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(v) => formatCurrency(v)} 
                    contentStyle={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12 }}
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 32, marginBottom: 32 }}>
            <h4 style={{ fontSize: 13, marginBottom: 24, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 600 }}>Composición del Patrimonio por Años</h4>
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tickLine={false} axisLine={false} dx={-10} />
                  <RechartsTooltip 
                    formatter={(v) => formatCurrency(v)} 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                    contentStyle={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--glass-shadow)' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  <Bar name="Balance Inicial" dataKey="initial" stackId="a" fill={COLORS.initial} barSize={40} />
                  <Bar name="Depósito Periódicos" dataKey="periodic" stackId="a" fill={COLORS.periodic} />
                  <Bar name="Interés total" dataKey="interest" stackId="a" fill={COLORS.interest} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 32, overflowX: 'auto' }}>
            <h4 style={{ fontSize: 13, marginBottom: 24, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 600 }}>Desglose Anual Detallado</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 0', color: 'var(--text-muted)', fontWeight: 600 }}>AÑO</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-muted)', fontWeight: 600 }}>DEPÓSITO ANUAL</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-muted)', fontWeight: 600 }}>DEPÓSITOS TOTALES</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-muted)', fontWeight: 600 }}>INTERÉS ACUM.</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {data.filter((_, i) => i > 0 || calcMode !== 'forward').map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                    <td style={{ padding: '14px 0', fontWeight: 600, color: 'var(--text-main)' }}>{row.label === 'Inicio' ? 0 : row.label}</td>
                    <td style={{ padding: '14px 0', color: 'var(--text-main)' }}>{formatCurrency(row.periodicAnnual)}</td>
                    <td style={{ padding: '14px 0', color: 'var(--text-main)' }}>{formatCurrency(row.initial + row.periodic)}</td>
                    <td style={{ padding: '14px 0', color: '#81C784', fontWeight: 500 }}>{formatCurrency(row.interest)}</td>
                    <td style={{ padding: '14px 0', fontWeight: 800, textAlign: 'right', color: 'var(--text-main)' }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .tool-tab {
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }
  .tool-tab:hover {
    color: var(--text-main);
    background: rgba(126, 145, 177, 0.08);
  }
  .tool-tab.active {
    background: var(--panel-bg);
    color: var(--accent);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
  .hover-row:hover { background: rgba(126, 145, 177, 0.05); }
  input[type="number"]::-webkit-inner-spin-button, 
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  select { 
    -webkit-appearance: none; 
    background-image: url('data:image/svg+xml;charset=US-ASCII,<svg%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"%20width%3D"24"%20height%3D"24"%20viewBox%3D"0%200%2024%2024"%20fill%3D"none"%20stroke%3D"%238d8d93"%20stroke-width%3D"2"%20stroke-linecap%3D"round"%20stroke-linejoin%3D"round"><polyline%20points%3D"6%209%2012%2015%2018%209"><%2Fpolyline><%2Fsvg>'); 
    background-repeat: no-repeat; 
    background-position: right%2016px%20center; 
    background-size: 16px; 
  }
`;
