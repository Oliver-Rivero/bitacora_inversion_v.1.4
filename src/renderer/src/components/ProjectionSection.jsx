import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Layers, TrendingUp, Activity, Target } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, ReferenceLine, ComposedChart, Line
} from 'recharts';

export default function ProjectionSection({ totalData, evolutionTimeline, formatCurrency, formatNumber, setShowAchievement }) {
  const { userProfile, updateProfile } = useData();
  const [savingsVal, setSavingsVal] = useState(userProfile?.projectionMonthlySavings || userProfile?.monthlySavings || 500);
  const [yieldVal, setYieldVal] = useState(userProfile?.projectionExpectedYield || 7);
  const [capitalVal, setCapitalVal] = useState(userProfile?.projectionInitialCapital !== undefined ? userProfile.projectionInitialCapital : (evolutionTimeline?.[0]?.value || 0));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        projectionMonthlySavings: Number(savingsVal),
        projectionExpectedYield: Number(yieldVal),
        projectionInitialCapital: Number(capitalVal)
      });
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  const projectionData = useMemo(() => {
    if (!evolutionTimeline || evolutionTimeline.length === 0) return [];
    
    try {
      const startValue = Number(capitalVal) || 0;
      const startDate = new Date(evolutionTimeline[0].date);
      if (isNaN(startDate)) return [];

      const monthsPast = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24 * 30));
      const monthsFuture = 12 * 10;
      const totalMonths = monthsPast + monthsFuture;
      
      const monthlyYield = (Number(yieldVal) / 100) / 12;
      const result = [];
      
      let current = startValue;
      for (let m = 0; m <= totalMonths; m++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + m);
        const dateStr = date.toISOString().split('T')[0];
        
        const realPoint = (evolutionTimeline || []).find(p => p.date === dateStr);
        
        result.push({
          date: dateStr,
          proyectado: Math.round(current),
          real: realPoint ? realPoint.value : undefined,
          marker: (m === monthsPast) ? 'Hoy' : null
        });

        current = (current * (1 + monthlyYield)) + Number(savingsVal);
      }
      return result;
    } catch (err) {
      console.error("Error calculating projection:", err);
      return [];
    }
  }, [evolutionTimeline, savingsVal, yieldVal, capitalVal]);

  const milestones = useMemo(() => {
    if (!evolutionTimeline || evolutionTimeline.length === 0) return [];
    try {
      const years = [3, 5, 7, 10];
      const startDate = new Date(evolutionTimeline[0]?.date);
      if (isNaN(startDate)) return [];

      const results = [];
      years.forEach(y => {
        const targetDate = new Date(startDate);
        targetDate.setFullYear(targetDate.getFullYear() + y);
        const dateStr = targetDate.toISOString().split('T')[0];
        const point = projectionData.find(p => p.date === dateStr);
        if (point) results.push({ year: y, value: point.proyectado });
      });
      return results;
    } catch (e) {
      return [];
    }
  }, [projectionData, evolutionTimeline]);

  return (
    <div className="projection-container">
      <div className="glass-panel" style={{ padding: 40, marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 60, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 28, marginBottom: 16 }}>Proyección de Patrimonio</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              Simula el crecimiento de tu cartera a 10 años combinando tus aportaciones mensuales con la magia del interés compuesto.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>CAPITAL INICIAL (€)</label>
                <input 
                  type="number" 
                  value={capitalVal} 
                  onChange={e => setCapitalVal(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-main)', fontSize: 16 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>AHORRO MENSUAL (€)</label>
                <input 
                  type="number" 
                  value={savingsVal} 
                  onChange={e => setSavingsVal(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-main)', fontSize: 16 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>RENTABILIDAD ANUAL (%)</label>
                <input 
                  type="number" 
                  value={yieldVal} 
                  onChange={e => setYieldVal(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-main)', fontSize: 16 }}
                />
              </div>
            </div>
            <button 
              onClick={handleSave}
              className="btn" 
              disabled={isSaving}
              style={{ marginTop: 32, padding: '14px 28px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <TrendingUp size={18} />
              {isSaving ? 'Actualizando Gráfico...' : 'Sincronizar Simulación'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {milestones.map(m => (
              <div key={m.year} className="glass-panel" style={{ padding: '16px 20px', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>En {m.year} años</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(m.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 40, height: 500 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="var(--text-muted)" 
              fontSize={12} 
              tickFormatter={(v) => (v && typeof v === 'string') ? v.split('-')[0] : ''}
              ticks={projectionData.filter((_, i) => i % 12 === 0).map(p => p.date)}
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={12} 
              tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
            />
            <RechartsTooltip 
              contentStyle={{ background: 'rgba(28, 28, 30, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, backdropFilter: 'blur(10px)' }}
              itemStyle={{ color: '#fff', fontSize: 13 }}
              labelStyle={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}
              formatter={(v) => formatCurrency(v)}
            />
            <Legend verticalAlign="top" align="right" />
            <defs>
              <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Line 
              name="Proyección" 
              type="monotone" 
              dataKey="proyectado" 
              stroke="var(--accent)" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              opacity={0.5}
            />
            <Area 
              name="Realidad" 
              type="monotone" 
              dataKey="real" 
              stroke="var(--success)" 
              strokeWidth={4} 
              fill="url(#colorReal)"
              connectNulls
            />
            <ReferenceLine x={projectionData.find(p => p.marker === 'Hoy')?.date} stroke="var(--accent)" strokeDasharray="3 3" label={{ position: 'top', value: 'Hoy', fill: 'var(--accent)', fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 32 }}>
          <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ padding: 12, borderRadius: 12, background: 'rgba(108, 165, 123, 0.1)', color: 'var(--success)' }}><Target size={24} /></div>
             <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patrimonio Final</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(projectionData?.[projectionData.length - 1]?.proyectado || 0)}</div>
             </div>
          </div>
          <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 183, 178, 0.1)', color: '#ffb7b2' }}><Activity size={24} /></div>
             <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Crecimiento Neto</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency((projectionData?.[projectionData.length - 1]?.proyectado || 0) - Number(capitalVal))}</div>
             </div>
          </div>
          <div className="glass-panel" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ padding: 12, borderRadius: 12, background: 'rgba(126, 145, 177, 0.1)', color: 'var(--accent)' }}><Layers size={24} /></div>
             <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patrimonio en Riesgo</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(totalData?.assetNetWorth || 0)}</div>
             </div>
          </div>
       </div>
    </div>
  );
}
