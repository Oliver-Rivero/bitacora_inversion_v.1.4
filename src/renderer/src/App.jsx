import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, Wallet, Building2, ArrowRightLeft, Settings, 
  Sun, Moon, RefreshCw, FileText, Sparkles, TrendingUp, 
  Wrench, Plus, Radar, GripVertical, Check, Settings2,
  Search, Command, Bell, Info, CheckCircle2, AlertCircle, X
} from 'lucide-react'
import { clsx } from 'clsx'
import DashboardView from './components/DashboardView'
import AnalyticsView from './components/AnalyticsView'
import LedgerView from './components/LedgerView'
import ConfigView from './components/ConfigView'
import AssetsView from './components/AssetsView'
import ReportsView from './components/ReportsView'
import EntitiesDetailView from './components/EntitiesDetailView'
import ToolsView from './components/ToolsView'
import RadarView from './components/RadarView'
import OnboardingModal from './components/OnboardingModal'
import AdvancedTutorial from './components/AdvancedTutorial'
import { useData } from './context/DataContext'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'

// Sub-componente para el Centro de Comandos
function CommandPalette({ isOpen, onClose, onSelect, items }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filteredItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
    } else if (e.key === 'Enter') {
      if (filteredItems[selectedIndex]) {
        onSelect(filteredItems[selectedIndex].id)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={20} style={{ position: 'absolute', left: 24, opacity: 0.5 }} />
          <input 
            autoFocus
            className="command-search"
            placeholder="Buscar sección o acción..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            style={{ paddingLeft: 60 }}
          />
        </div>
        <div className="command-list">
          {filteredItems.map((item, idx) => {
            const Icon = item.icon || LayoutDashboard
            return (
              <div 
                key={item.id}
                className={clsx('command-item', idx === selectedIndex && 'active')}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => { onSelect(item.id); onClose(); }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.5, fontSize: 14 }}>
              No se encontraron resultados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { setLedgerFormRequested, transactions, quotes, fxRate, loading, showTutorial, showAdvancedTutorial } = useData()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState('light')
  const [mood, setMood] = useState('neutral')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  // Exponer addToast globalmente para que otros componentes puedan usarlo
  useEffect(() => {
    window.addToast = addToast
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Atajo global Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  // Calculate Portfolio Mood (Bullish / Bearish / Neutral)
  useEffect(() => {
    if (loading || !transactions.length) return

    const calculateMood = () => {
      let totalInvested = 0
      let totalCurrent = 0

      transactions.forEach(t => {
        const amt = Number(t.total || 0)
        const symbol = (t.symbol || '').toUpperCase()
        const quote = quotes[symbol]
        const shares = Number(t.shares || 0)

        if (t.operation === 'Compra' || t.operation === 'Depósito') {
          totalInvested += amt
          if (quote) {
            const price = quote.price
            const value = shares * price
            totalCurrent += (quote.currency === 'USD' ? value / fxRate : value)
          } else {
            totalCurrent += amt
          }
        } else if (t.operation === 'Retiro') {
            totalInvested -= amt
            totalCurrent -= amt
        }
      })

      const profit = totalCurrent - totalInvested
      if (Math.abs(profit) < 10) setMood('neutral')
      else if (profit > 0) setMood('bullish')
      else setMood('bearish')
    }

    calculateMood()
  }, [transactions, quotes, fxRate, loading])

  useEffect(() => {
    document.documentElement.setAttribute('data-mood', mood)
  }, [mood])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const [isEditingSidebar, setIsEditingSidebar] = useState(false)
  const [navItems, setNavItems] = useState([
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'assets', label: 'Mis Activos', icon: Wallet },
    { id: 'entities_detail', label: 'Mis Entidades', icon: Building2 },
    { id: 'ledger', label: 'Libro Mayor', icon: ArrowRightLeft },
    { id: 'reports', label: 'Informes', icon: FileText },
    { id: 'analytics', label: 'Análisis Avanzado', icon: TrendingUp },
    { id: 'radar', label: 'Radar', icon: Radar },
    { id: 'tools', label: 'Herramientas', icon: Wrench },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ])

  // Cargar orden guardado al montar
  useEffect(() => {
    const loadOrder = async () => {
      const saved = await window.api.getConfig('sidebar_order')
      if (saved) {
        try {
          const orderIds = JSON.parse(saved)
          const sorted = [...navItems].sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id))
          setNavItems(sorted)
        } catch (e) { console.error(e) }
      }
    }
    loadOrder()
  }, [])

  const activeIndex = navItems.findIndex(item => item.id === activeTab)

  // Handlers para Drag & Drop
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)

  const handleDragStart = (e, index) => {
    if (!isEditingSidebar) return
    setDraggedItem(index)
    e.dataTransfer.effectAllowed = 'move'
    // Hack para ocultar la imagen de arrastre por defecto si quisiéramos algo custom,
    // pero el nativo con wiggle queda bien.
  }

  const handleDragOver = (e, index) => {
    if (!isEditingSidebar) return
    e.preventDefault()
    setDragOverItem(index)
  }

  const handleDrop = (index) => {
    if (!isEditingSidebar || draggedItem === null) return
    const newItems = [...navItems]
    const item = newItems.splice(draggedItem, 1)[0]
    newItems.splice(index, 0, item)
    setNavItems(newItems)
    setDraggedItem(null)
    setDragOverItem(null)
    
    // Guardar nuevo orden
    window.api.saveConfig('sidebar_order', JSON.stringify(newItems.map(i => i.id)))
  }

  return (
    <div id="app-shell" data-mood={mood} className={clsx(isEditingSidebar && 'edit-mode')} style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      <div className="living-bg" style={{ pointerEvents: 'none' }}>
        <div className="bg-blob bg-blob-1"></div>
        <div className="bg-blob bg-blob-2"></div>
        <div className="bg-blob bg-blob-3"></div>
      </div>

      <div className="sidebar glass-panel" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, WebkitAppRegion: 'drag' }}>
        <div className="sidebar-header">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Bitácora" className="sidebar-logo" />
        </div>

        <div style={{ padding: '0 20px 24px 20px', WebkitAppRegion: 'no-drag' }}>
          <button 
            id="tutorial-new-op"
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
              boxShadow: '0 4px 12px rgba(126, 145, 177, 0.2)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={e => {
              if (isEditingSidebar) return
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
          {!isEditingSidebar && (
            <div 
              className="nav-indicator" 
              style={{ transform: `translateY(${activeIndex * (40 + 4)}px)` }} 
            />
          )}

          {navItems.map((item, index) => {
            const Icon = item.icon
            return (
              <div 
                key={item.id}
                id={`tutorial-${item.id}`}
                draggable={isEditingSidebar}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => { setDraggedItem(null); setDragOverItem(null); }}
                className={clsx(
                  'nav-item', 
                  activeTab === item.id && !isEditingSidebar && 'active',
                  dragOverItem === index && 'drag-over'
                )}
                style={{ WebkitAppRegion: 'no-drag' }}
                onClick={() => !isEditingSidebar && setActiveTab(item.id)}
              >
                {isEditingSidebar ? <GripVertical size={14} style={{ opacity: 0.5 }} /> : <Icon size={18} />}
                {item.label}
              </div>
            )
          })}
        </div>
        
        <div style={{ marginTop: 'auto', WebkitAppRegion: 'no-drag', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="edit-sidebar-btn" onClick={() => setIsEditingSidebar(!isEditingSidebar)}>
            {isEditingSidebar ? <Check size={14} /> : <Settings2 size={14} />}
            {isEditingSidebar ? 'Finalizar edición' : 'Personalizar menú'}
          </div>

          <div className="nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          </div>
          <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
            <div style={{ fontSize: 10, opacity: 1, fontWeight: 600, marginTop: 4, letterSpacing: 1, color: '#8E8E8E' }}>beta 2.0</div>
          </div>
        </div>
      </div>

      <div className="main-content page-transition" key={activeTab}>
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'assets' && <AssetsView />}
        {activeTab === 'entities_detail' && <EntitiesDetailView />}
        {activeTab === 'ledger' && <LedgerView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'radar' && <RadarView />}
        {activeTab === 'tools' && <ToolsView />}
        { activeTab === 'settings' && <ConfigView /> }
      </div>

      {/* Componentes UI Phase 3 */}
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)}
        onSelect={(id) => {
          if (id === 'new_tx') {
            setActiveTab('ledger')
            setLedgerFormRequested(true)
          } else if (id === 'toggle_theme') {
            toggleTheme()
          } else {
            setActiveTab(id)
          }
        }}
        items={[
          ...navItems,
          { id: 'new_tx', label: 'Añadir Nueva Operación', icon: Plus, shortcut: 'N' },
          { id: 'toggle_theme', label: 'Cambiar Modo Claro/Oscuro', icon: Sun, shortcut: 'T' }
        ]}
      />

      {/* Tutorial Interactivo */}
      {showTutorial && <OnboardingModal />}
      {showAdvancedTutorial && <AdvancedTutorial setActiveTab={setActiveTab} />}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            {t.type === 'success' && <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />}
            {t.type === 'error' && <AlertCircle size={18} style={{ color: 'var(--danger)' }} />}
            {t.type === 'info' && <Info size={18} style={{ color: 'var(--accent)' }} />}
            <span>{t.message}</span>
            <X size={14} style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.5 }} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
          </div>
        ))}
      </div>
    </div>
  )
}
