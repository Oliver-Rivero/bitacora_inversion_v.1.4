import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Utilities for formatting dates natively
const formatDate = (isoDate) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export function exportLibroMayorExcel(transactions, entities) {
  const dataToExport = transactions.map(t => ({
    'Fecha': formatDate(t.date),
    'Entidad': entities.find(e => e.id == t.entityId)?.name || 'N/A',
    'Operación': t.operation,
    'Activo': t.assetType,
    'Nombre': t.name || '',
    'Símbolo': t.symbol || '',
    'Participaciones': t.shares,
    'Precio Unitario (€)': t.unitPrice,
    'Total (€)': t.total,
    'Comisiones (€)': t.commission,
    'Impuestos (€)': t.tax,
    'Cambio Aplicado': t.exchangeRate
  }))

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Libro Mayor')
  XLSX.writeFile(workbook, `Libro_Mayor_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export function exportLibroMayorCSV(transactions, entities) {
  const dataToExport = transactions.map(t => ({
    'Fecha': t.date,
    'Entidad': entities.find(e => e.id == t.entityId)?.name || 'N/A',
    'Operacion': t.operation,
    'Activo': t.assetType,
    'Nombre': t.name || '',
    'Simbolo': t.symbol || '',
    'Participaciones': t.shares,
    'Precio_Unitario': t.unitPrice,
    'Total': t.total,
    'Comisiones': t.commission,
    'Impuestos': t.tax,
    'Cambio': t.exchangeRate
  }))

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.setAttribute('hidden', '')
  a.setAttribute('href', url)
  a.setAttribute('download', `Libro_Mayor_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function exportDetailedReportPDF(report, periodString) {
  const doc = new jsPDF()
  const dateStr = new Date().toISOString().split('T')[0]
  
  // Header
  doc.setFontSize(22)
  doc.setTextColor(44, 44, 46)
  doc.text('Mi Cartera - Informe de Rendimiento', 14, 22)
  
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Periodo: ${periodString}`, 14, 30)
  doc.text(`Generado el: ${formatDate(dateStr)}`, 14, 35)

  // 1. Resumen Ejecutivo
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('Resumen Ejecutivo', 14, 50)
  
  doc.autoTable({
    startY: 55,
    head: [['Métrica de Cartera', 'Valor']],
    body: [
      ['Valor al Inicio del Periodo', `${report.totals.start.toFixed(2)} €`],
      ['Valor al Final del Periodo', `${report.totals.end.toFixed(2)} €`],
      ['Aportaciones Netas (Compras - Ventas)', `${(report.totals.buys - report.totals.salesProceeds).toFixed(2)} €`],
      ['Rendimiento Total Neto', `${report.totals.totalGain.toFixed(2)} €`],
      ['Rendimiento Porcentual Total', `${report.totals.start > 0 ? ((report.totals.totalGain / report.totals.start) * 100).toFixed(2) : '0.00'} %`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [44, 44, 46] },
    styles: { fontSize: 10 }
  })

  // 2. Desglose de Valores Liquidados (Resultados Reales)
  doc.setFontSize(14)
  doc.text('Desglose de Resultados Realizados (Caja)', 14, doc.lastAutoTable.finalY + 15)
  
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Concepto Liquidado', 'Total']],
    body: [
      ['Intereses Cobrados', `${report.totals.interests.toFixed(2)} €`],
      ['Dividendos Percibidos', `${report.totals.dividends.toFixed(2)} €`],
      ['Plusvalías por Venta (Realizadas)', `${report.totals.realizedGain.toFixed(2)} €`],
      ['TOTAL CAJA GENERADA', `${report.totals.yieldCash.toFixed(2)} €`]
    ],
    theme: 'striped',
    headStyles: { fillColor: [52, 199, 89] },
    styles: { fontSize: 10 }
  })

  // 3. Desglose de Actividad por Producto (Aportaciones)
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Actividad y Aportaciones por Producto', 14, 20)
  
  const activityBody = []
  report.categories.forEach(cat => {
    cat.products.forEach(p => {
      activityBody.push([
        p.name,
        `${p.buysInRange.toFixed(2)} €`,
        `${p.salesInRangeTotal.toFixed(2)} €`,
        `${(p.buysInRange - p.salesInRangeTotal).toFixed(2)} €`
      ])
    })
  })

  doc.autoTable({
    startY: 25,
    head: [['Producto', 'Compras (+)', 'Ventas (-)', 'Inyectado Neto']],
    body: activityBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 113, 227] },
    styles: { fontSize: 9 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  })

  // 4. Detalle de Rendimiento por Activo
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Detalle de Rendimiento y Variación', 14, 20)
  
  let currentY = 25

  report.categories.forEach(cat => {
    if (currentY > 240) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(12)
    doc.setTextColor(44, 44, 46)
    doc.text(cat.name.toUpperCase(), 14, currentY)
    
    const body = cat.products.map(p => [
      p.name,
      `${p.startValue.toFixed(2)} €`,
      `${p.endValue.toFixed(2)} €`,
      `${p.latentGain.toFixed(2)} €`,
      `${(p.realizedGainInRange + p.dividendsInRange + p.interestsInRange).toFixed(2)} €`,
      `${p.gainPct.toFixed(2)} %`
    ])

    doc.autoTable({
      startY: currentY + 5,
      head: [['Producto', 'V. Inicial', 'V. Final', 'Var. Mercado', 'Ingr. Caja', 'Rend. %']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 85] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    })

    currentY = doc.lastAutoTable.finalY + 15
  })

  // Footer Paging
  const pageCount = doc.internal.getNumberOfPages()
  doc.setFontSize(8)
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10)
  }

  doc.save(`Informe_Detallado_${dateStr}.pdf`)
}
