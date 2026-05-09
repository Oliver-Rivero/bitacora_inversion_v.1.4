import React, { useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import { Plus, Edit2, Trash2, X, Building2, Layers, Tag, Save, AlertTriangle, Upload, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import * as XLSX from 'xlsx'

export default function ConfigView() {
  const { 
    entities, addEntity, editEntity, deleteEntity,
    categories, addCategory, editCategory, deleteCategory,
    assetTypes, addAssetType, editAssetType, deleteAssetType,
    resetAllData, bulkAddTransactions, addEntity: addEntityContext
  } = useData()

  const [activeTab, setActiveTab] = useState('entities')
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef(null)
  
  // Forms state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formColor, setFormColor] = useState('#7E91B1')
  const [formParentId, setFormParentId] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [oldName, setOldName] = useState('')

  const resetForm = () => {
    setFormName('')
    setFormUrl('')
    setFormColor('#7E91B1')
    setFormParentId('')
    setEditingId(null)
    setOldName('')
  }

  const handleResetData = async () => {
    if (window.confirm('⚠️ ATENCIÓN: Esta acción borrará todas tus transacciones, huchas y entidades. Es irreversible. ¿Estás COMPLETAMENTE seguro?')) {
      const confirmation = window.prompt('Escribe "ELIMINAR TODO" para confirmar:')
      if (confirmation === 'ELIMINAR TODO') {
        await resetAllData()
        alert('Datos reseteados con éxito.')
      }
    }
  }

  const handleImportLedger = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsImporting(true)

    try {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws)

          if (data.length === 0) {
            alert('El archivo parece estar vacío.')
            setIsImporting(false)
            return
          }

          // Validate basic headers
          const headers = Object.keys(data[0])
          if (!headers.includes('Fecha') || !headers.includes('Operación')) {
            alert('Formato de archivo no válido. Asegúrate de importar un archivo generado por el módulo de Informes.')
            setIsImporting(false)
            return
          }

          // Process entities first (ensure they exist)
          const currentEntities = entities.map(en => en.name.toLowerCase())
          const newEntities = []
          data.forEach(row => {
            const enName = row['Entidad']
            if (enName && !currentEntities.includes(enName.toLowerCase()) && !newEntities.includes(enName)) {
              newEntities.push(enName)
            }
          })

          for (const enName of newEntities) {
            await addEntityContext({ name: enName })
          }

          // Transform rows to transactions
          // We'll map them carefully. Note: entityId needs to be correct.
          // Since context updates are async, we might need a refresh or handle it carefully.
          const txnsToImport = data.map(row => {
            return {
              date: row['Fecha'],
              operation: row['Operación'],
              assetType: row['Tipo'] || 'Otros',
              symbol: row['Símbolo'] || '',
              name: row['Nombre'] || '',
              shares: parseFloat(row['Cant.'] || 0),
              unitPrice: parseFloat(row['Precio Uni.'] || 0),
              exchangeRate: parseFloat(row['Cambio'] || 1),
              commission: parseFloat(row['Comisión'] || 0),
              tax: parseFloat(row['Impuestos'] || 0),
              total: parseFloat(row['Total'] || 0),
              currency: row['Moneda'] || 'EUR',
              yield: parseFloat(row['Rend.'] || 0),
              entityId: entities.find(en => en.name === row['Entidad'])?.id || null
            }
          })

          await bulkAddTransactions(txnsToImport)
          alert(`Éxito: Se han importado ${txnsToImport.length} transacciones.`)
        } catch (err) {
          console.error('Inner import failed:', err)
          alert('Error al procesar el archivo.')
        } finally {
          setIsImporting(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      console.error('Import failed:', err)
      alert('Error al leer el archivo.')
      setIsImporting(false)
    }
  }

  const handleEntitySubmit = async (e) => {
    e.preventDefault()
    if (!formName.trim()) return
    if (editingId) {
      await editEntity({ id: editingId, name: formName.trim(), url: formUrl.trim() })
    } else {
      await addEntity({ name: formName.trim(), url: formUrl.trim() })
    }
    resetForm()
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    if (!formName.trim()) return
    if (editingId) {
      await editCategory({ id: editingId, name: formName.trim(), color: formColor })
    } else {
      await addCategory({ name: formName.trim(), color: formColor })
    }
    resetForm()
  }

  const handleAssetTypeSubmit = async (e) => {
    e.preventDefault()
    if (!formName.trim() || !formParentId) return
    
    if (editingId && oldName !== formName.trim()) {
      if (!window.confirm(`¿Estás seguro de que quieres renombrar "${oldName}" a "${formName.trim()}"? Esto actualizará automáticamente todas tus transacciones pasadas para mantener la coherencia de los datos.`)) {
        return
      }
    }

    if (editingId) {
      await editAssetType({ id: editingId, name: formName.trim(), categoryId: parseInt(formParentId), color: formColor, oldName })
    } else {
      await addAssetType({ name: formName.trim(), categoryId: parseInt(formParentId), color: formColor })
    }
    resetForm()
  }

  const handleEditEntity = (en) => {
    setFormName(en.name)
    setFormUrl(en.url || '')
    setEditingId(en.id)
  }

  const handleEditCategory = (cat) => {
    setFormName(cat.name)
    setFormColor(cat.color)
    setEditingId(cat.id)
  }

  const handleEditAssetType = (at) => {
    setFormName(at.name)
    setFormColor(at.color)
    setFormParentId(at.categoryId.toString())
    setEditingId(at.id)
    setOldName(at.name)
  }

  return (
    <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div style={{ marginBottom: 32 }}>
        <h1>Configuración</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Gestiona tus entidades, categorías de inversión y tipos de activo</p>
      </div>

      <div className="glass-panel" style={{ display: 'flex', padding: 4, borderRadius: 12, marginBottom: 32, width: 'fit-content' }}>
        {[
          { id: 'entities', label: 'Entidades', icon: Building2 },
          { id: 'categories', label: 'Categorías Macro', icon: Layers },
          { id: 'asset_types', label: 'Tipos de Activo', icon: Tag },
          { id: 'advanced', label: 'Avanzado', icon: AlertTriangle },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); resetForm(); }}
              className={clsx('btn-tab', activeTab === tab.id && 'active')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'entities' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <form onSubmit={handleEntitySubmit} className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>
                {editingId ? 'Editar Entidad' : 'Nueva Entidad Financiera'}
              </label>
              <input 
                placeholder="ej: My Investor, Binance, Kraken..." 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                required 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>
                Sitio Web / Dominio
              </label>
              <input 
                placeholder="ej: myinvestor.es, kraken.com..." 
                value={formUrl} 
                onChange={e => setFormUrl(e.target.value)} 
              />
            </div>
            <button type="submit" className="btn">
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Actualizar' : 'Añadir Entidad'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                <X size={16} />
              </button>
            )}
          </form>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>ENTIDAD</th>
                  <th>DOMINIO / URL</th>
                  <th style={{ width: 120, textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(en => (
                  <tr key={en.id}>
                    <td>{en.id}</td>
                    <td><span style={{ fontWeight: 600 }}>{en.name}</span></td>
                    <td><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{en.url || '---'}</code></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => handleEditEntity(en)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => deleteEntity(en.id)}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <form onSubmit={handleCategorySubmit} className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>
                {editingId ? 'Editar Categoría' : 'Nueva Categoría Macro'}
              </label>
              <input 
                placeholder="ej: Renta Variable, Cripto..." 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>Color</label>
              <input 
                type="color" 
                value={formColor} 
                onChange={e => setFormColor(e.target.value)} 
                style={{ width: 60, height: 40, padding: 2, borderRadius: 8 }} 
              />
            </div>
            <button type="submit" className="btn">
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Actualizar' : 'Añadir Categoría'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                <X size={16} />
              </button>
            )}
          </form>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>CATEGORÍA</th>
                  <th>COLOR</th>
                  <th style={{ width: 120, textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td>{cat.id}</td>
                    <td><span style={{ fontWeight: 600 }}>{cat.name}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: cat.color }} />
                        <code style={{ fontSize: 11 }}>{cat.color}</code>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => handleEditCategory(cat)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => deleteCategory(cat.id)}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'asset_types' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <form onSubmit={handleAssetTypeSubmit} className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1.5fr auto auto auto', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>
                {editingId ? 'Editar Tipo' : 'Nuevo Tipo de Activo'}
              </label>
              <input 
                placeholder="ej: Acciones, ETFs, Inmuebles..." 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>Categoría Macro</label>
              <select value={formParentId} onChange={e => setFormParentId(e.target.value)} required>
                <option value="">-- Seleccionar --</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block', color: 'var(--text-muted)' }}>Color</label>
              <input 
                type="color" 
                value={formColor} 
                onChange={e => setFormColor(e.target.value)} 
                style={{ width: 60, height: 40, padding: 2, borderRadius: 8 }} 
              />
            </div>
            <button type="submit" className="btn">
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Actualizar' : 'Añadir Tipo'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                <X size={16} />
              </button>
            )}
          </form>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>TIPO DE ACTIVO</th>
                  <th>CATEGORÍA PADRE</th>
                  <th>COLOR</th>
                  <th style={{ width: 120, textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {assetTypes.map(at => {
                  const parent = categories.find(c => c.id === at.categoryId)
                  return (
                    <tr key={at.id}>
                      <td>{at.id}</td>
                      <td><span style={{ fontWeight: 600 }}>{at.name}</span></td>
                      <td>
                        <span style={{ 
                          fontSize: 11, 
                          padding: '4px 8px', 
                          borderRadius: 6, 
                          background: parent?.color + '20', 
                          color: parent?.color,
                          fontWeight: 700 
                        }}>
                          {parent?.name || '---'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: at.color }} />
                          <code style={{ fontSize: 11 }}>{at.color}</code>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => handleEditAssetType(at)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-secondary" style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => deleteAssetType(at.id)}>
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
        </div>
      )}

      {activeTab === 'advanced' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="glass-panel" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255, 60, 60, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} color="var(--danger)" />
                </div>
                <h3 style={{ margin: 0 }}>Resetear Aplicación</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
                Esto eliminará permanentemente todas tus transacciones, entidades, huchas y snapshots. 
                Se mantendrá tu perfil de usuario y las categorías básicas de inversión.
              </p>
              <button 
                onClick={handleResetData}
                style={{ 
                  background: 'rgba(255, 60, 60, 0.1)', 
                  color: 'var(--danger)', 
                  border: '1px solid rgba(255, 60, 60, 0.2)',
                  padding: '12px 20px',
                  borderRadius: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <AlertTriangle size={18} /> Borrar todos los datos
              </button>
            </div>

            <div className="glass-panel" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(100, 100, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={20} color="var(--accent)" />
                </div>
                <h3 style={{ margin: 0 }}>Importar Libro Mayor</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
                Carga un archivo Excel o CSV exportado previamente desde la sección de Informes para restaurar tus movimientos.
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportLedger} 
                accept=".xlsx,.csv" 
                style={{ display: 'none' }} 
              />
              
              <button 
                onClick={() => fileInputRef.current.click()}
                disabled={isImporting}
                className="btn"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isImporting ? <RefreshCw size={18} className="spinning" /> : <Upload size={18} />}
                {isImporting ? 'Importando...' : 'Seleccionar Archivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
