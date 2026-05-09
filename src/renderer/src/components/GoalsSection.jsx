import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Target, Clock, Zap, XCircle, CheckCircle2, Activity } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend
} from 'recharts';

export default function GoalsSection({ transactions, evolutionTimeline, totalData, formatCurrency, formatNumber, formatPercent, setShowGoalFeedback }) {
  const { userProfile, updateProfile } = useData();
  const currentYear = new Date().getFullYear();
  
  const [q1, setQ1] = useState(userProfile?.q1Target || 1200);
  const [q2, setQ2] = useState(userProfile?.q2Target || 1200);
  const [q3, setQ3] = useState(userProfile?.q3Target || 1200);
  const [q4, setQ4] = useState(userProfile?.q4Target || 1200);
  const [yieldGoal, setYieldGoal] = useState(userProfile?.annualYieldTarget || 4);
  const [capitalJan, setCapitalJan] = useState(userProfile?.annualInitialCapital || 0);
  const [isSaving, setIsSaving] = useState(false);

  // Calculation logic for Current Year
  const stats = useMemo(() => {
    try {
      const yearTxns = (transactions || [])
        .filter(t => {
           const dateStr = String(t.date || '');
           if (!dateStr) return false;
           return dateStr.includes(currentYear.toString());
        })
        .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));

      const qData = [
        { name: 'Q1', target: Number(q1) || 0, real: 0, months: [0, 1, 2] },
        { name: 'Q2', target: Number(q2) || 0, real: 0, months: [3, 4, 5] },
        { name: 'Q3', target: Number(q3) || 0, real: 0, months: [6, 7, 8] },
        { name: 'Q4', target: Number(q4) || 0, real: 0, months: [9, 10, 11] }
      ];

      yearTxns.forEach(t => {
        const date = new Date(t.date);
        const m = date.getMonth();
        if (isNaN(m)) return; 
        
        const amt = Number(t.total) || 0;
        let val = 0;
        
        if (t.operation === 'Depósito' || t.operation === 'Compra') val = amt;
        else if (t.operation === 'Retiro') val = -amt;
        
        const qIndex = Math.floor(m / 3);
        if (qData[qIndex]) {
          qData[qIndex].real += val;
        }
      });

      let startNW = Number(capitalJan) || 0;
      if (startNW === 0 && evolutionTimeline && evolutionTimeline.length > 0) {
        const startOfYearPoint = evolutionTimeline.find(p => p.date && p.date >= `${currentYear}-01-01`) || evolutionTimeline[0];
        startNW = Number(startOfYearPoint?.value) || 0;
      }
      if (isNaN(startNW)) startNW = 0;

      const netInflowYTD = qData.reduce((acc, q) => acc + (Number(q.real) || 0), 0);
      const currentNW = Number(totalData?.netWorth) || 0;
      const profitYTD = currentNW - startNW - netInflowYTD;
      const yieldYTD = startNW > 0 ? (profitYTD / (startNW + Math.abs(netInflowYTD)/2)) * 100 : 0;
      const safeYieldYTD = isNaN(yieldYTD) ? 0 : yieldYTD;

      const curveData = [];
      let runningTarget = startNW;
      let runningReal = startNW;
      
      const yieldMonthRate = (Number(yieldGoal) || 0) / 100 / 12;
      const targets = [q1, q2, q3, q4];

      for (let m = 0; m < 12; m++) {
        const qIndex = Math.floor(m / 3);
        const monthlyTargetAport = (Number(targets[qIndex]) || 0) / 3;
        
        runningTarget = (runningTarget * (1 + yieldMonthRate)) + monthlyTargetAport;
        if (isNaN(runningTarget)) runningTarget = 0;
        
        const lastDayOfMonth = new Date(currentYear, m + 1, 0);
        const dateStr = lastDayOfMonth instanceof Date && !isNaN(lastDayOfMonth) ? lastDayOfMonth.toISOString().split('T')[0] : `${currentYear}-${(m+1).toString().padStart(2,'0')}-28`;
        
        const realPoint = (evolutionTimeline || []).filter(p => p.date && p.date <= dateStr).pop();
        const isPast = new Date() >= new Date(currentYear, m, 1);

        let realVal = isPast ? (realPoint ? realPoint.value : runningReal) : undefined;
        if (isPast && !realPoint && startNW > 0) realVal = startNW;

        curveData.push({
          month: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(currentYear, m, 1)),
          objetivo: Math.round(Number(runningTarget) || 0),
          real: (realVal === undefined || isNaN(realVal)) ? undefined : Number(realVal)
        });
        if (realPoint) runningReal = Number(realPoint.value) || runningReal;
      }

      return { qData, yieldYTD: safeYieldYTD, profitYTD, curveData };
    } catch (err) {
      console.error("Error calculating stats in GoalsSection:", err);
      return null;
    }
  }, [transactions, evolutionTimeline, totalData, q1, q2, q3, q4, yieldGoal, capitalJan, currentYear]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        q1Target: Number(q1),
        q2Target: Number(q2),
        q3Target: Number(q3),
        q4Target: Number(q4),
        annualYieldTarget: Number(yieldGoal),
        annualInitialCapital: Number(capitalJan)
      });
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  useEffect(() => {
    if (!stats?.qData) return;
    
    const now = new Date();
    const month = now.getMonth();
    
    let checkQ = null;
    if (month >= 9) checkQ = 2;      
    else if (month >= 6) checkQ = 1; 
    else if (month >= 3) checkQ = 0; 

    if (checkQ === null) return;

    const hasSeen = sessionStorage.getItem(`goal_feedback_${currentYear}_${checkQ}`);
    if (!hasSeen) {
      const qObj = stats.qData[checkQ];
      if (!qObj) return;
      
      const successAport = qObj.real >= qObj.target;
      const successYield = stats.yieldYTD >= yieldGoal;
      
      let title = successAport ? "¡Increíble esfuerzo de ahorro!" : "Buen intento este trimestre";
      let message = "";
      
      if (successAport && successYield) {
        message = `¡Enhorabuena! Has conseguido tu objetivo de aportar ${formatCurrency(qObj.real)} este trimestre. Además, tu cartera se ha revalorizado un ${formatPercent(stats.yieldYTD)}%, ¡superando tus expectativas!`;
      } else if (successAport && !successYield) {
        message = `¡Felicidades! Has cumplido tu objetivo de aportaciones con ${formatCurrency(qObj.real)}. El mercado no ha acompañado tanto esta vez (${formatPercent(stats.yieldYTD)}%), pero has hecho lo más difícil: mantener tu ritmo de inversión.`;
      } else {
        message = `Has aportado ${formatCurrency(qObj.real)} este trimestre. Aunque no hemos llegado a la meta de ${formatCurrency(qObj.target)}, lo importante es seguir sumando. La rentabilidad actual es del ${formatPercent(stats.yieldYTD)}%.`;
      }

      setShowGoalFeedback({
        title,
        message,
        success: successAport,
        current: qObj.real,
        target: qObj.target,
        yield: stats.yieldYTD,
        yieldTarget: yieldGoal,
        quarter: qObj.name
      });
      sessionStorage.setItem(`goal_feedback_${currentYear}_${checkQ}`, 'true');
    }
  }, [stats]);

  if (!stats) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <Activity size={40} className="spinning" style={{ opacity: 0.3, marginBottom: 16 }} />
        <p>Error en el cálculo de objetivos. Revisa tus transacciones.</p>
      </div>
    );
  }

  return (
    <div className="goals-container">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 32 }}>
        <div className="glass-panel" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Progreso Trimestral {currentYear}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Comparativa de aportación neta (depósitos - retiros)</p>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(108, 165, 123, 0.1)', borderRadius: 8, textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>Rentabilidad YTD</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{formatPercent(stats.yieldYTD)}%</div>
            </div>
          </div>

          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.curveData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorGoal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <RechartsTooltip 
                  formatter={(v) => formatCurrency(v)} 
                  contentStyle={{ background: '#2c2c2e', border: 'none', borderRadius: 12, color: '#fff' }}
                />
                <Legend iconType="circle" />
                <Area name="Trayectoria Plan" dataKey="objetivo" stroke="var(--accent)" strokeDasharray="5 5" fill="url(#colorGoal)" strokeWidth={2} />
                <Area name="Evolución Real" dataKey="real" stroke="var(--success)" fill="none" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 32 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, fontSize: 16 }}>
            <Target size={20} className="text-accent" /> Definir Metas {currentYear}
          </h3>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>CAPITAL A 1 DE ENERO (€)</label>
            <input type="number" value={capitalJan} onChange={e => setCapitalJan(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>OBJETIVO Q1</label>
              <input type="number" value={q1} onChange={e => setQ1(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>OBJETIVO Q2</label>
              <input type="number" value={q2} onChange={e => setQ2(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>OBJETIVO Q3</label>
              <input type="number" value={q3} onChange={e => setQ3(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>OBJETIVO Q4</label>
              <input type="number" value={q4} onChange={e => setQ4(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>EXPECTATIVA REVALORIZACIÓN (%)</label>
            <input type="number" value={yieldGoal} onChange={e => setYieldGoal(e.target.value)} style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>

          <button onClick={handleSave} disabled={isSaving} className="btn" style={{ width: '100%', padding: 14 }}>
            {isSaving ? 'Guardando...' : 'Guardar Objetivos'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 32 }}>
        {(stats.qData || []).map((q, idx) => {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentQ = Math.floor(currentMonth / 3);
          
          const isPast = currentQ > idx;
          const isCurrent = currentQ === idx;
          const isFuture = currentQ < idx;
          const met = q.real >= q.target;

          let Icon = Clock;
          let iconColor = 'var(--text-muted)';
          
          if (isPast) {
            Icon = met ? CheckCircle2 : XCircle;
            iconColor = met ? 'var(--success)' : '#ff4d4d';
          } else if (isCurrent) {
            Icon = Zap;
            iconColor = 'var(--accent)';
          }

          return (
            <div key={q.name} className="glass-panel" style={{ 
              padding: 24, 
              border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--border)',
              opacity: isFuture ? 0.6 : 1,
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{q.name}</span>
                <Icon size={18} color={iconColor} style={{ opacity: isFuture ? 0.3 : 1 }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(q.real)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Meta: {formatCurrency(q.target)}</div>
              <div className="progress-bar-container" style={{ height: 4, marginTop: 16, background: 'rgba(255,255,255,0.05)' }}>
                <div className="progress-bar-fill" style={{ 
                  width: `${Math.min(100, (q.real / (q.target || 1)) * 100)}%`, 
                  background: iconColor,
                  boxShadow: isCurrent ? '0 0 10px var(--accent)' : 'none',
                  transition: 'width 1s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
