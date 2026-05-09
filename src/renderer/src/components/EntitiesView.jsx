import React, { useState } from 'react'
import { useData } from '../context/DataContext'
import { Plus, Edit2, Trash2, X } from 'lucide-react'

export default function EntitiesView() {
  const { entities, addEntity, editEntity, deleteEntity } = useData()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [isEditing, setIsEditing] = useState(null) // holds id if editing

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (name.trim()) {
      if (isEditing) {
        await editEntity({ id: isEditing, name: name.trim(), url: url.trim() })
      } else {
        await addEntity({ name: name.trim(), url: url.trim() })
      }
      setName('')
      setUrl('')
      setIsEditing(null)
    }
  }

  const handleEdit = (ent) => {
    setName(ent.name)
    setUrl(ent.url || '')
    setIsEditing(ent.id)
  }

  const handleCancel = () => {
    setName('')
    setUrl('')
    setIsEditing(null)
  }

  return (
    <div>
      <h1>Entidades Financieras</h1>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>{isEditing ? 'Editar Entidad' : 'Nombre de la Entidad (ej. De Giro, My Investor)'}</label>
          <input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label>Dominio (ej. kraken.com)</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Opcional" />
        </div>
        <button type="submit" className="btn">
          {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
          {isEditing ? 'Actualizar' : 'Añadir'}
        </button>
        {isEditing && (
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            <X size={16} /> Cancelar
          </button>
        )}
      </form>

      <div className="glass-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{width: 80}}>ID</th>
              <th>Nombre</th>
              <th style={{width: 100, textAlign: 'right'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {entities.map(e => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td><span style={{fontWeight: 600}}>{e.name}</span></td>
                <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => handleEdit(e)} title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: 6 }} onClick={() => deleteEntity(e.id)} title="Borrar">
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
