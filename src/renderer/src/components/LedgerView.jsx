import React, { useState, useMemo } from 'react'
import { useData } from '../context/DataContext'
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Coins,
  CircleDollarSign,
  Filter,
  X,
  Info,
  RefreshCcw,
  ArrowRightLeft
} from 'lucide-react'
import { clsx } from 'clsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: 'rgba(255,0,0,0.05)', borderRadius: 16, border: '1px solid rgba(255,0,0,0.1)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Algo salió mal en esta vista</h2>
          <pre style={{ fontSize: 12, opacity: 0.7 }}>{this.state.error?.toString()}</pre>
          <button className="btn" onClick={() => window.location.reload()}>Recargar Aplicación</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LedgerView() {
  const data = useData() || {}
  const { 
    transactions = [], 
    entities = [], 
    addTransaction, 
    editTransaction, 
    deleteTransaction, 
    formatCurrency = (v) => v, 
    formatNumber = (v) => v, 
    assetTypes = [], 
    categories = [],
    ledgerFormRequested,
    setLedgerFormRequested
  } = data
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(null) // holds id if editing
  const [filterText, setFilterText] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterOp, setFilterOp] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  React.useEffect(() => {
    if (ledgerFormRequested) {
      setShowForm(true)
      setIsEditing(null)
      setFormData(defaultFormData)
      setLedgerFormRequested(false)
    }
  }, [ledgerFormRequested])
  
  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1)
  const [sortDir, setSortDir] = useState('desc') // 'asc' or 'desc'
  const itemsPerPage = 30
  
  const defaultFormData = {
    date: new Date().toISOString().split('T')[0],
    entityId: '',
    operation: 'Compra',
    assetType: 'Acciones',
    symbol: '',
    name: '',
    shares: '',
    unitPrice: '',
    originalUnitPrice: '',
    originalTotal: '',
    exchangeRate: '1',
    currency: 'EUR',
    commission: '',
    tax: '',
    yield: '',
    maturityDate: ''
  }
  
  const [formData, setFormData] = useState(defaultFormData)
  const [loadingSymbol, setLoadingSymbol] = useState(false)

  const handleSymbolBlur = async () => {
    if (formData?.symbol) {
      setLoadingSymbol(true)
      try {
        const results = await window.api?.getQuotes?.([formData.symbol])
        if (results && results.length > 0) {
          const quote = results[0]
          let detectedCurrency = quote.currency || 'EUR'
          if (detectedCurrency === 'USD' && formData.currency !== 'USD') {
            if (window.confirm(`Se ha detectado que el activo ${quote.symbol} cotiza en USD. ¿Quieres cambiar la moneda de la operación a USD?`)) {
              setFormData(prev => ({ ...prev, currency: 'USD' }))
            }
          }
          setFormData(prev => ({ 
            ...prev, 
            name: quote.shortName || quote.longName || prev.name,
            unitPrice: detectedCurrency === 'EUR' ? (quote.regularMarketPrice || prev.unitPrice) : prev.unitPrice,
            originalUnitPrice: detectedCurrency !== 'EUR' ? (quote.regularMarketPrice || prev.originalUnitPrice) : prev.originalUnitPrice,
            currency: detectedCurrency === 'USD' ? 'USD' : prev.currency
          }))
        }
      } catch (err) {
        console.error("Error fetching symbol", err)
      } finally {
        setLoadingSymbol(false)
      }
    }
  }

  // --- Auto FX Rate Fetching ---
  React.useEffect(() => {
    const fetchFX = async () => {
      if (formData.currency !== 'EUR' && formData.date) {
        const symbol = formData.currency === 'USD' ? 'EURUSD=X' : null
        if (symbol) {
          // Fix: The API expects (symbol, date) as separate arguments
          const rate = await window.api?.getHistoricalPrice?.(symbol, formData.date)
          if (rate) {
            setFormData(prev => ({ ...prev, exchangeRate: Number(rate).toFixed(4) }))
          }
        }
      } else {
        setFormData(prev => ({ ...prev, exchangeRate: '1' }))
      }
    }
    fetchFX()
  }, [formData.date, formData.currency])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Calculate total
    const sharesNum = parseFloat(formData.shares) || 1
    const currency = formData.currency || 'EUR'
    const isEUR = currency === 'EUR'
    
    const originalPrice = parseFloat(isEUR ? formData.unitPrice : formData.originalUnitPrice) || 0
    const fxRate = parseFloat(formData.exchangeRate) || 1
    const priceInEUR = isEUR ? originalPrice : (originalPrice / fxRate)
    
    const commNum = parseFloat(formData.commission) || 0
    const taxNum = parseFloat(formData.tax) || 0

    let baseTotal = (sharesNum * priceInEUR)
    let finalTotal = 0
    
    // Calculate original total for reference
    const origTotal = (sharesNum * originalPrice)

    if (formData.operation === 'Compra' || formData.operation === 'Saldo Inicial') {
      finalTotal = baseTotal + commNum + taxNum
    } else if (formData.operation === 'Venta') {
      finalTotal = baseTotal - commNum - taxNum
    } else if (formData.operation === 'Aportación' || formData.operation === 'Retirada') {
      finalTotal = priceInEUR - commNum - taxNum;
    } else {
      finalTotal = priceInEUR - commNum - taxNum 
    }

    const payload = {
      ...formData,
      shares: (formData.operation === 'Depósito' || formData.operation === 'Retiro') ? 0 : sharesNum,
      unitPrice: priceInEUR,
      originalUnitPrice: originalPrice,
      originalTotal: origTotal,
      exchangeRate: fxRate,
      commission: commNum,
      tax: taxNum,
      yield: parseFloat(formData.yield) || 0,
      maturityDate: formData.maturityDate || null,
      total: finalTotal
    }

    if (isEditing) {
      await editTransaction?.({ ...payload, id: isEditing })
    } else {
      await addTransaction?.(payload)
    }
    
    setShowForm(false)
    setIsEditing(null)
  }

  const handleEditClick = (t) => {
    setFormData({
      date: t.date,
      entityId: t.entityId,
      operation: t.operation,
      assetType: t.assetType,
      symbol: t.symbol || '',
      name: t.name || '',
      shares: t.shares,
      unitPrice: t.unitPrice,
      originalUnitPrice: t.originalUnitPrice || t.unitPrice,
      originalTotal: t.originalTotal || t.total,
      exchangeRate: t.exchangeRate || '1',
      currency: t.currency || 'EUR',
      commission: t.commission,
      tax: t.tax,
      yield: t.yield || '0',
      maturityDate: t.maturityDate || '',
      toEntityId: t.toEntityId || ''
    })
    setIsEditing(t.id)
    setShowForm(true)
  }
  
  const handleNewClick = () => {
    setFormData(defaultFormData)
    setIsEditing(null)
    setShowForm(!showForm)
  }

  const filteredTransactions = (transactions || []).filter(t => {
    const textMatch = (t.symbol?.toLowerCase().includes(filterText.toLowerCase()) || t.name?.toLowerCase().includes(filterText.toLowerCase()));
    const entityMatch = filterEntity ? t.entityId?.toString() === filterEntity : true;
    const opMatch = filterOp ? t.operation === filterOp : true;
    const dateFromMatch = filterDateFrom ? t.date >= filterDateFrom : true;
    const dateToMatch = filterDateTo ? t.date <= filterDateTo : true;
    return textMatch && entityMatch && opMatch && dateFromMatch && dateToMatch;
  }).sort((a, b) => {
    return sortDir === 'asc' ? (a.date || '').localeCompare(b.date || '') : (b.date || '').localeCompare(a.date || '')
  })

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const pagedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const currentPositions = useMemo(() => {
    if (!transactions) return [];
    const positions = {};
    transactions.forEach(t => {
      const entityIdStr = String(t.entityId || '');
      const toEntityIdStr = String(t.toEntityId || '');
      const assetTypeClean = String(t.assetType || '').trim().toLowerCase();
      const nameClean = String(t.name || '').trim().toLowerCase();
      const symbolClean = String(t.symbol || '').trim().toUpperCase();
      
      const op = String(t.operation || '').trim().toLowerCase();

      // Normal operations
      if (op !== 'transferencia') {
        const assetKey = `${entityIdStr}_${symbolClean || nameClean}`;
        if (!t.symbol && !t.name) return;
        if (!positions[assetKey]) {
          positions[assetKey] = { 
            entityId: t.entityId,
            symbol: t.symbol, 
            name: t.name, 
            shares: 0, 
            assetType: t.assetType,
            yield: t.yield,
            maturityDate: t.maturityDate,
            currency: t.currency
          };
        }
        const mult = (t.operation === 'Venta') ? -1 : 1;
        if (op === 'compra' || op === 'saldo inicial' || op === 'venta') {
          positions[assetKey].shares += (Number(t.shares || 0) * mult);
        }
      }
    });
    return Object.values(positions).filter(p => Math.abs(p.shares) > 0.000001);
  }, [transactions]);

  const filteredAssetTypes = useMemo(() => {
    if (formData.operation === 'Dividendos') {
      return new Set(['Acciones', "ETF's"]);
    }
    if (formData.operation === 'Venta' || formData.operation === 'Intereses') {
      if (!formData.entityId) return null;
      const types = new Set();
      currentPositions.forEach(p => {
        if (String(p.entityId) === String(formData.entityId)) {
          types.add(String(p.assetType || '').trim());
        }
      });
      return types;
    }
    return null;
  }, [currentPositions, formData.entityId, formData.operation]);

  const assetsOfSelectedType = useMemo(() => {
    if (!formData.entityId || !formData.assetType) return [];
    const targetEntity = String(formData.entityId);
    const targetType = String(formData.assetType || '').trim().toLowerCase();
    
    return currentPositions.filter(p => 
      String(p.entityId) === targetEntity &&
      String(p.assetType || '').trim().toLowerCase() === targetType
    );
  }, [currentPositions, formData.entityId, formData.assetType]);

  const globalAssetsByType = useMemo(() => {
    if (!transactions) return [];
    const seen = new Set();
    const assets = [];
    
    transactions.forEach(t => {
      if (!t.assetType || (!t.symbol && !t.name)) return;
      const key = `${t.assetType}_${t.symbol || ''}_${t.name || ''}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        assets.push({
          symbol: t.symbol,
          name: t.name,
          assetType: t.assetType,
          currency: t.currency || 'EUR',
          yield: t.yield,
          maturityDate: t.maturityDate
        });
      }
    });
    
    return assets.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [transactions]);

  const availableGlobalAssets = useMemo(() => {
    if (!formData.assetType) return [];
    const targetType = String(formData.assetType).trim().toLowerCase();
    return globalAssetsByType.filter(a => String(a.assetType).trim().toLowerCase() === targetType);
  }, [globalAssetsByType, formData.assetType]);

  const formatDate = (isoDate) => {
    if (!isoDate) return ''
    const [y, m, d] = isoDate.split('-')
    return `${d}/${m}/${y}`
  }

  const getOpIcon = (op) => {
    switch(op) {
      case 'Compra': return <ArrowUpCircle size={20} color="var(--success)" />;
      case 'Saldo Inicial': return <ArrowUpCircle size={20} color="var(--accent)" />;
      case 'Venta': return <ArrowDownCircle size={20} color="var(--danger)" />;
      case 'Aportación': return <Plus size={20} color="var(--success)" />;
      case 'Retirada': return <X size={20} color="var(--danger)" />;
      case 'Intereses': return <Coins size={20} color="#EAB308" />;
      case 'Dividendos': return <CircleDollarSign size={20} color="#3B82F6" />;
      case 'Transferencia': return <RefreshCcw size={20} color="#8B5CF6" />;
      default: return null;
    }
  }

  if (!entities || entities.length === 0 || !assetTypes) {
    return (
      <div style={{ padding: 60, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
        <div className="glass-panel" style={{ display: 'inline-block', padding: '24px 40px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Preparando el Libro Mayor...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Libro Mayor</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Registro detallado de todos los movimientos y operaciones</p>
          </div>
          <button className="btn" onClick={handleNewClick}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cerrar Diario' : 'Nueva Operación'}
          </button>
        </div>
        
        {!showForm && (
          <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', gap: 12, marginBottom: 32, alignItems: 'center', overflowX: 'auto' }}>
            <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color:'var(--text-muted)', opacity: 0.6 }} />
              <input 
                placeholder="Buscar activo..." 
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
                style={{ paddingLeft: 36, paddingRight: 12, height: 36, fontSize: 13, border: 'none', background: 'transparent' }} 
              />
            </div>
            
            <div style={{ height: 20, width: 1, background: 'var(--border)' }} />
            
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 13, width: 'auto', padding: '0 8px' }}>
                <option value="">Entidad: Todas</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
              <select value={filterOp} onChange={e => setFilterOp(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 13, width: 'auto', padding: '0 8px' }}>
                <option value="">Operación: Todas</option>
                <option>Compra</option>
                <option>Venta</option>
                <option>Aportación</option>
                <option>Retirada</option>
                <option>Saldo Inicial</option>
                <option>Intereses</option>
                <option>Dividendos</option>
              </select>
            </div>

            <div style={{ height: 20, width: 1, background: 'var(--border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Desde:</span>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, width: 120 }} />
              <span>Hasta:</span>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, width: 120 }} />
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: 32, marginBottom: 32, animation: 'fadeUp 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              <div style={{ gridColumn: 'span 1', background: 'rgba(0,0,0,0.03)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)' }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, display: 'block', color: 'var(--text-muted)' }}>Información General</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  <select 
                    value={formData.operation} 
                    onChange={e => setFormData({
                      ...formData, 
                      operation: e.target.value,
                      symbol: '',
                      name: '',
                      shares: '',
                      unitPrice: ''
                    })} 
                    style={{ fontWeight: 700, color: 'var(--accent)' }}
                  >
                    <option>Compra</option>
                    <option>Venta</option>
                    <option>Aportación</option>
                    <option>Retirada</option>
                    <option>Intereses</option>
                    <option>Dividendos</option>
                    <option>Saldo Inicial</option>
                  </select>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>ENTIDAD / CUENTA</label>
                      <select value={formData.entityId} onChange={e => setFormData({...formData, entityId: e.target.value})} required>
                        <option value="">-- Seleccionar Entidad --</option>
                        {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', background: 'var(--bg-subtle)', padding: 20, borderRadius: 16, border: '1px solid var(--border-subtle)', opacity: 0.8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, display: 'block', color: 'var(--text-muted)' }}>
                  Detalles del Activo
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select 
                    value={formData.assetType} 
                    onChange={e => setFormData({
                      ...formData, 
                      assetType: e.target.value,
                      symbol: '',
                      name: '',
                      shares: '',
                      unitPrice: ''
                    })} 
                    style={{ gridColumn: 'span 2' }}
                  >
                    <option value="">-- Tipo de Activo --</option>
                    {(assetTypes || [])
                      .filter(at => !filteredAssetTypes || filteredAssetTypes.has(at.name))
                      .map(at => (
                        <option key={at.id} value={at.name}>{at.name}</option>
                      ))
                    }
                  </select>
                  
                  {(() => {
                    const currentAT = (assetTypes || []).find(at => String(at.name || '').trim().toLowerCase() === String(formData.assetType || '').trim().toLowerCase());
                    const currentCat = (categories || []).find(c => c.id === currentAT?.categoryId)?.name;
                    const isFixed = ['Depósitos', 'Bonos/Letras', 'Renta Fija'].includes(currentCat);
                    const isDividend = formData.operation === 'Dividendos';
                    const isInterest = formData.operation === 'Intereses';
                     const isCashFlow = formData.operation === 'Aportación' || formData.operation === 'Retirada';
                    
                    const showTicker = ['Acciones', "ETF's", 'Fondos Indexados', 'Cripto'].includes(formData.assetType);
                    
                    if (isCashFlow) {
                      return (
                        <>
                          <input placeholder="Concepto (ej: Aportación mensual)" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ gridColumn: 'span 2' }} />
                          <input type="number" step="0.01" placeholder="Importe" value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required style={{ gridColumn: 'span 2' }} />
                        </>
                      );
                    }
                    
                    const isVenta = formData.operation === 'Venta';
                    const isSmartFlow = isVenta || isDividend || isInterest;
                    
                    if (isSmartFlow) {
                      const currentPos = (currentPositions || []).find(p => 
                        String(p.entityId) === String(formData.entityId) && 
                        (
                          (p.symbol && formData.symbol && String(p.symbol).toUpperCase() === String(formData.symbol).toUpperCase()) || 
                          (String(p.name || '').toLowerCase() === String(formData.name || '').toLowerCase())
                        )
                      );

                      return (
                        <>
                          {formData.entityId && formData.assetType && (
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>PASO 1: SELECCIONAR PRODUCTO</label>
                              <select 
                                value={formData.symbol || formData.name || ''}
                                onChange={e => {
                                  const pos = assetsOfSelectedType.find(p => (p.symbol || p.name) === e.target.value);
                                  if (pos) {
                                    setFormData({ 
                                      ...formData, 
                                      symbol: pos.symbol || '', 
                                      name: pos.name,
                                      yield: pos.yield || '',
                                      maturityDate: pos.maturityDate || '',
                                      currency: pos.currency || 'EUR'
                                    });
                                  }
                                }}
                                style={{ width: '100%', border: !formData.name ? '1px solid var(--accent)' : 'none' }}
                              >
                                <option value="">{assetsOfSelectedType.length > 0 ? (isVenta ? '-- Elige qué quieres vender --' : (isDividend ? '-- Elige qué activo paga el dividendo --' : '-- Elige qué activo genera intereses --')) : '-- No hay posiciones registradas --'}</option>
                                {assetsOfSelectedType.map(p => (
                                  <option key={`${p.entityId}_${p.symbol || p.name}`} value={p.symbol || p.name}>
                                    {p.name} {p.symbol ? `(${p.symbol})` : ''} {isVenta && `- (Disp: ${formatNumber(p.shares)})`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {formData.name && (
                            <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: 10, padding: 15, background: 'var(--bg-subtle)', borderRadius: 12 }}>
                              <label style={{ gridColumn: 'span 2', fontSize: 10, color: 'var(--text-muted)' }}>PASO 2: DETALLES DE LA OPERACIÓN</label>
                              
                              {isDividend || isInterest ? (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>Importe del {isDividend ? 'Dividendo' : 'Interés'} (Total)</label>
                                  <input type="number" step="0.01" placeholder={isDividend ? "Importe Dividendo" : "Importe Interés"} value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required style={{ width: '100%' }} />
                                </div>
                              ) : !isFixed ? (
                                <>
                                  <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>Participaciones a vender</label>
                                    <input type="number" step="0.000000001" placeholder="Participaciones" value={formData.shares || ''} onChange={e => setFormData({...formData, shares: e.target.value})} required style={{ width: '100%' }} />
                                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, marginLeft: 8 }}>
                                      Máx: {formatNumber(currentPos?.shares || 0)}
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>Precio de venta (Unitario)</label>
                                    <input type="number" step="0.01" placeholder="Precio Unitario" value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required style={{ width: '100%' }} />
                                  </div>
                                </>
                              ) : (
                                <div style={{ gridColumn: 'span 2', position: 'relative' }}>
                                  <label style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>Importe de la venta</label>
                                  <input type="number" step="0.01" placeholder="Importe Venta" value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required style={{ width: '100%' }} />
                                  <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, marginLeft: 8 }}>
                                    Saldo Actual: {formatCurrency(currentPos?.shares || 0)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {!formData.entityId && (
                            <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                              Por favor, selecciona una entidad para comenzar.
                            </div>
                          )}
                          
                          {formData.entityId && !formData.assetType && (
                            <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                              Ahora selecciona el tipo de activo.
                            </div>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        {!isFixed ? (
                          <>
                            {formData.assetType && availableGlobalAssets.length > 0 && (
                              <div style={{ gridColumn: 'span 2', marginBottom: 4 }}>
                                <label style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>REUTILIZAR PRODUCTO EXISTENTE (OPCIONAL)</label>
                                <select 
                                  value=""
                                  onChange={e => {
                                    const asset = availableGlobalAssets.find(a => (a.symbol || a.name) === e.target.value);
                                    if (asset) {
                                      setFormData({
                                        ...formData,
                                        symbol: asset.symbol || '',
                                        name: asset.name,
                                        currency: asset.currency || 'EUR'
                                      });
                                    }
                                  }}
                                  style={{ border: '1px solid var(--accent)', opacity: 0.8 }}
                                >
                                  <option value="">-- Seleccionar para autorellenar --</option>
                                  {availableGlobalAssets.map(a => (
                                    <option key={`${a.symbol || ''}_${a.name}`} value={a.symbol || a.name}>
                                      {a.name} {a.symbol ? `(${a.symbol})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {showTicker && (
                              <input 
                                placeholder={formData.assetType === 'Cripto' ? "Moneda (ej: BTC)" : "Ticker (ej: AAPL)"} 
                                value={formData.symbol || ''} 
                                onChange={e => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
                                onBlur={handleSymbolBlur}
                              />
                            )}
                            <input 
                              placeholder="Nombre completo" 
                              value={formData.name || ''} 
                              onChange={e => setFormData({...formData, name: e.target.value})} 
                              required 
                              style={{ gridColumn: showTicker ? 'span 1' : 'span 2' }} 
                            />
                            <div style={{ position: 'relative' }}>
                              <input type="number" step="0.000000001" placeholder="Participaciones / Cantidad" value={formData.shares || ''} onChange={e => setFormData({...formData, shares: e.target.value})} required style={{ width: '100%' }} />
                            </div>
                            <input 
                              type="number" 
                              step="0.01" 
                              placeholder={formData.currency === 'EUR' ? "Precio Unitario (€)" : `Precio Unitario (${formData.currency})`} 
                              value={formData.currency === 'EUR' ? formData.unitPrice : formData.originalUnitPrice} 
                              onChange={e => setFormData({
                                ...formData, 
                                [formData.currency === 'EUR' ? 'unitPrice' : 'originalUnitPrice']: e.target.value
                              })} 
                              required 
                            />
                          </>
                        ) : (
                          <>
                            {formData.assetType && availableGlobalAssets.length > 0 && (
                              <div style={{ gridColumn: 'span 2', marginBottom: 4 }}>
                                <label style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>REUTILIZAR PRODUCTO EXISTENTE (OPCIONAL)</label>
                                <select 
                                  value=""
                                  onChange={e => {
                                    const asset = availableGlobalAssets.find(a => (a.symbol || a.name) === e.target.value);
                                    if (asset) {
                                      setFormData({
                                        ...formData,
                                        symbol: asset.symbol || '',
                                        name: asset.name,
                                        yield: asset.yield || '',
                                        maturityDate: asset.maturityDate || '',
                                        currency: asset.currency || 'EUR'
                                      });
                                    }
                                  }}
                                  style={{ border: '1px solid var(--accent)', opacity: 0.8 }}
                                >
                                  <option value="">-- Seleccionar para autorellenar --</option>
                                  {availableGlobalAssets.map(a => (
                                    <option key={`${a.symbol || ''}_${a.name}`} value={a.symbol || a.name}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <input placeholder="Nombre de la inversión" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ gridColumn: 'span 2' }} />
                            <input type="number" step="0.01" placeholder="Interés %" value={formData.yield || ''} onChange={e => setFormData({...formData, yield: e.target.value})} />
                            <input type="date" title="Fecha de Vencimiento" value={formData.maturityDate || ''} onChange={e => setFormData({...formData, maturityDate: e.target.value})} />
                            <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                              <input type="number" step="0.01" placeholder="Importe Compra" value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: e.target.value})} required style={{ width: '100%' }} />
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div style={{ gridColumn: 'span 1', background: 'rgba(0,0,0,0.03)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)' }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, display: 'block', color: 'var(--text-muted)' }}>Gastos y Moneda</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <select value={formData.currency || 'EUR'} onChange={e => setFormData({...formData, currency: e.target.value})}>
                    <option value="EUR">Euros (€)</option>
                    <option value="USD">Dólares ($)</option>
                    <option value="BTC">Bitcoin (BTC)</option>
                  </select>
                  
                  {formData.currency !== 'EUR' && (
                    <div style={{ animation: 'fadeUp 0.3s ease', background: 'rgba(0,113,227,0.05)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                       <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>TIPO DE CAMBIO (1€ = ? {formData.currency})</label>
                       <input 
                         type="number" 
                         step="0.0001" 
                         placeholder="Tipo de cambio" 
                         value={formData.exchangeRate} 
                         onChange={e => setFormData({...formData, exchangeRate: e.target.value})} 
                       />
                       <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: 0 }}>
                         {formData.originalUnitPrice ? `${formatCurrency(formData.originalUnitPrice, formData.currency)} ≈ ${formatCurrency(formData.originalUnitPrice / (formData.exchangeRate || 1), 'EUR')}` : 'Introduce el cambio del día'}
                       </p>
                       <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', opacity: 0.8 }}>
                         <Info size={10} />
                         <span style={{ fontSize: 9, fontWeight: 600 }}>Revisa el tipo de cambio por si tu broker aplicó uno distinto</span>
                       </div>
                    </div>
                  )}

                  <input type="number" step="0.01" placeholder="Comisiones (€)" value={formData.commission || ''} onChange={e => setFormData({...formData, commission: e.target.value})} />
                  <input type="number" step="0.01" placeholder="Impuestos (€)" value={formData.tax || ''} onChange={e => setFormData({...formData, tax: e.target.value})} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-secondary" style={{ minWidth: 100 }} onClick={() => { setShowForm(false); setIsEditing(null); setFormData(defaultFormData); }}>
                Cancelar
              </button>
              <button type="submit" className="btn" style={{ minWidth: 160 }}>
                {isEditing ? 'Actualizar Registro' : 'Guardar Operación'}
              </button>
            </div>
          </form>
        )}

        <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer', textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>FECHA {sortDir === 'asc' ? '↑' : '↓'}</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>OPERACIÓN</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11 }}>ACTIVO / ENTIDAD</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>CANTIDAD</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>PRECIO</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', fontSize: 11 }}>TOTAL (€)</th>
                <th style={{ textAlign: 'right', padding: '16px 20px' }}></th>
              </tr>
            </thead>
            <tbody>
              {pagedTransactions.map(t => {
                const entityName = entities.find(e => e.id == t.entityId)?.name || 'N/A'
                const opColor = (t.operation === 'Compra' || t.operation === 'Saldo Inicial') ? 'var(--success)' : (t.operation === 'Venta' ? 'var(--danger)' : 'var(--accent)')
                
                return (
                  <tr key={t.id} className="list-row-hover" style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(t.date)}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {getOpIcon(t.operation)}
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{t.operation}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name || (t.operation === 'Transferencia' ? 'Movimiento de Fondos' : '')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {t.operation === 'Transferencia' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{entityName}</span>
                              <ArrowRightLeft size={10} />
                              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{entities.find(e => e.id == t.toEntityId)?.name || 'N/A'}</span>
                            </div>
                          ) : (
                            <>{entityName} • {t.assetType} {t.symbol && `(${t.symbol})`}</>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13 }}>{formatNumber(t.shares)}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13 }}>
                        {t.currency && t.currency !== 'EUR' ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(t.originalUnitPrice, t.currency)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCurrency(t.unitPrice, 'EUR')}</div>
                          </>
                        ) : (
                          formatCurrency(t.unitPrice, 'EUR')
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: opColor }}>
                        {t.operation === 'Venta' ? '-' : (t.operation === 'Compra' || t.operation === 'Saldo Inicial' ? '+' : '')}
                        {formatCurrency(t.total)}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => handleEditClick(t)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => deleteTransaction(t.id)}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
            Mostrando {pagedTransactions.length} de {filteredTransactions.length} registros
          </div>
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 12 }}>
            <button 
              className="btn-secondary" 
              style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
              {currentPage} / {totalPages || 1}
            </span>
            <button 
              className="btn-secondary" 
              style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <style>{`
          .list-row-hover {
            transition: background 0.2s ease;
          }
          .list-row-hover:hover {
            background: rgba(0, 0, 0, 0.02);
          }
          [data-theme='dark'] .list-row-hover:hover {
            background: rgba(255, 255, 255, 0.03);
          }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
