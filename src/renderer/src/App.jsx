import { useState, useEffect } from 'react'
import { LayoutDashboard, Wallet, Building2, ArrowRightLeft, Settings, Sun, Moon, RefreshCw, FileText, Sparkles, TrendingUp, Wrench, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import DashboardView from './components/DashboardView'
import AnalyticsView from './components/AnalyticsView'
import LedgerView from './components/LedgerView'
import ConfigView from './components/ConfigView'
import AssetsView from './components/AssetsView'
import ReportsView from './components/ReportsView'
import EntitiesDetailView from './components/EntitiesDetailView'
import ToolsView from './components/ToolsView'
import { useData } from './context/DataContext'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'

export default function App() {
  const { setLedgerFormRequested } = useData()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const navItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'assets', label: 'Mis Activos', icon: Wallet },
    { id: 'entities_detail', label: 'Mis Entidades', icon: Building2 },
    { id: 'ledger', label: 'Libro Mayor', icon: ArrowRightLeft },
    { id: 'reports', label: 'Informes', icon: FileText },
    { id: 'analytics', label: 'Análisis Avanzado', icon: TrendingUp },
    { id: 'tools', label: 'Herramientas', icon: Wrench },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ]

  return (
    <>
      <div className="sidebar glass-panel" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, WebkitAppRegion: 'drag' }}>
        <div className="sidebar-header">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Bitácora" className="sidebar-logo" />
        </div>

        <div style={{ padding: '0 20px 24px 20px', WebkitAppRegion: 'no-drag' }}>
          <button 
            onClick={() => {
              setActiveTab('ledger')
              setLedgerFormRequested(true)
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8EA0BE 0%, #7E91B1 100%)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(126, 145, 177, 0.2)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(126, 145, 177, 0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(126, 145, 177, 0.2)'
            }}
          >
            <Plus size={18} />
            Nueva Operación
          </button>
        </div>
        
        <div className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <div 
                key={item.id}
                className={clsx('nav-item', activeTab === item.id && 'active')}
                style={{ WebkitAppRegion: 'no-drag' }}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </div>
            )
          })}
        </div>
        
        <div style={{ marginTop: 'auto', WebkitAppRegion: 'no-drag' }}>
          <div className="nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          </div>
          <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
            <div style={{ fontSize: 10, opacity: 1, fontWeight: 600, marginTop: 4, letterSpacing: 1, color: '#8E8E93' }}>beta 1.6</div>
          </div>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'assets' && <AssetsView />}
        {activeTab === 'entities_detail' && <EntitiesDetailView />}
        {activeTab === 'ledger' && <LedgerView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'tools' && <ToolsView />}
        { activeTab === 'settings' && <ConfigView /> }
      </div>
    </>
  )
}
