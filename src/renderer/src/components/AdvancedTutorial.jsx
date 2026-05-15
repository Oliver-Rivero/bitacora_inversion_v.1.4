import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { ChevronRight, ChevronLeft, X } from 'lucide-react'

export default function AdvancedTutorial({ setActiveTab }) {
  const { setShowAdvancedTutorial, setGlobalAnalyticsTab } = useData()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)

  const finishTutorial = () => {
    setShowAdvancedTutorial(false)
  }

  const steps = [
    {
      targetId: 'tutorial-assets',
      tab: 'assets',
      title: 'Mis Activos',
      content: 'Aquí puedes ver todos los productos en cartera, separados y organizados por su categoría macro y su tipo de activo específico.'
    },
    {
      targetId: 'tutorial-entities_detail',
      tab: 'entities_detail',
      title: 'Mis Entidades',
      content: 'En esta sección puedes consultar qué activos específicos tienes disponibles y depositados en cada uno de tus bancos o brókers registrados.'
    },
    {
      targetId: 'tutorial-ledger',
      tab: 'ledger',
      title: 'Libro Mayor',
      content: 'El corazón de la app. Aquí puedes añadir nuevas transacciones manualmente, así como consultar y filtrar todo el historial de operaciones pasadas.'
    },
    {
      targetId: 'tutorial-reports',
      tab: 'reports',
      title: 'Informes',
      content: 'Genera un resumen anual de tus resultados, analiza las plusvalías de un periodo concreto y exporta los datos completos de tu cartera (PDF, Excel, CSV).'
    },
    {
      targetId: 'tutorial-analytics-flow',
      tab: 'analytics',
      analyticsTab: 'flow',
      title: 'Aportaciones y Rendimientos',
      content: 'Esta sub-pestaña desglosa tu flujo de caja real. Compara de forma visual cuánto capital has aportado de tu propio bolsillo frente al rendimiento líquido orgánico (beneficios, dividendos) que está generando tu cartera mes a mes.'
    },
    {
      targetId: 'tutorial-analytics-evolution',
      tab: 'analytics',
      analyticsTab: 'evolution',
      title: 'Evolución Histórica',
      content: 'Observa el crecimiento a largo plazo. Aquí se dibuja la curva histórica de tu patrimonio neto total y la línea de tu coste base. La diferencia entre ambas es tu plusvalía latente a lo largo del tiempo.'
    },
    {
      targetId: 'tutorial-analytics-goals',
      tab: 'analytics',
      analyticsTab: 'goals',
      title: 'Objetivos Trimestrales',
      content: 'Fíjate metas concretas. Establece un objetivo de ahorro o inversión para cada trimestre y visualiza de forma gamificada cuánto te falta para alcanzar esa meta gracias a tus aportaciones.'
    },
    {
      targetId: 'tutorial-analytics-diversification',
      tab: 'analytics',
      analyticsTab: 'diversification',
      title: 'Diversificación y Salud',
      content: 'La regla de oro de la inversión. Descubre mediante gráficas y un mapa mundial interactivo cómo de expuesto estás a un solo sector económico o país. Una cartera saludable debe estar bien equilibrada.'
    },
    {
      targetId: 'tutorial-radar',
      tab: 'radar',
      title: 'Radar de Activos',
      content: 'Incluye productos financieros (como acciones o ETFs) que deseas tener vigilados para estudiar su posible adquisición en el futuro.'
    },
    {
      targetId: 'tutorial-tools',
      tab: 'tools',
      title: 'Herramientas',
      content: 'Dispones de utilidades como una calculadora de interés compuesto proyectado, así como una calculadora para estimar tu Libertad Financiera.'
    },
    {
      targetId: 'tutorial-settings',
      tab: 'settings',
      title: 'Configuración',
      content: 'Por último, aquí puedes personalizar las categorías y subcategorías, añadir nuevos bancos/brókers, e incluso resetear la aplicación si lo necesitas.'
    }
  ]

  const activeStep = steps[currentStep]

  // Actualizar la pestaña principal y sub-pestaña de Analytics al cambiar de paso
  useEffect(() => {
    setActiveTab(activeStep.tab)
    if (activeStep.analyticsTab) {
      setGlobalAnalyticsTab(activeStep.analyticsTab)
    }
  }, [currentStep, activeStep, setActiveTab, setGlobalAnalyticsTab])

  // Obtener las coordenadas del elemento resaltado
  useEffect(() => {
    // Un pequeño timeout para asegurar que el DOM se ha actualizado tras cambiar de pestaña
    const updateRect = () => {
      const el = document.getElementById(activeStep.targetId)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          right: rect.right
        })
      } else {
        setTargetRect(null)
      }
    }
    
    const timeoutId = setTimeout(updateRect, 100)
    
    const handleResize = () => updateRect()
    window.addEventListener('resize', handleResize)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [currentStep, activeStep])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      finishTutorial()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Calculate dynamic popover position
  const popoverWidth = 320;
  let popoverLeft = 0;
  let popoverTop = 0;
  let isLeftAligned = false;

  if (targetRect) {
    popoverLeft = targetRect.right + 24;
    popoverTop = targetRect.top + (targetRect.height / 2) - 80;

    // Boundary check: If popover exceeds right edge of screen, flip it to the left side
    if (popoverLeft + popoverWidth + 20 > window.innerWidth) {
      popoverLeft = targetRect.left - popoverWidth - 24;
      isLeftAligned = true;
    }
  }

  return (
    <>
      {/* Fondo semitransparente general, sin blur para que se vea la UI */}
      <div style={{
        position: 'fixed', inset: 0, 
        background: 'rgba(0, 0, 0, 0.4)', 
        zIndex: 99998,
        transition: 'all 0.3s ease'
      }} />

      {/* Highlighter Element */}
      {targetRect && (
        <div style={{
          position: 'fixed',
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 113, 227, 0.5)',
          border: '2px solid var(--accent)',
          zIndex: 99999,
          pointerEvents: 'none',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      )}

      {/* Contenido del Popover */}
      {targetRect && (
        <div style={{
          position: 'fixed',
          top: popoverTop,
          left: popoverLeft,
          width: popoverWidth,
          background: '#1A1E2E',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          zIndex: 100000,
          animation: 'toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'top 0.3s ease, left 0.3s ease'
        }}>
          {/* Triángulo apuntador */}
          <div style={{
            position: 'absolute',
            top: '50%',
            ...(isLeftAligned ? { right: -8 } : { left: -8 }),
            marginTop: -8,
            width: 0,
            height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            ...(isLeftAligned ? { borderLeft: '8px solid #1A1E2E' } : { borderRight: '8px solid #1A1E2E' })
          }} />

          {/* Botón Cerrar (Cancelar tutorial) */}
          <button 
            onClick={finishTutorial}
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
            title="Cancelar Tutorial"
          >
            <X size={16} />
          </button>

          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FFF', marginBottom: 12, paddingRight: 16 }}>{activeStep.title}</h3>
          <p style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 24 }}>{activeStep.content}</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
              Paso {currentStep + 1} de {steps.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={handlePrev}
                disabled={currentStep === 0}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', width: 32, height: 32, borderRadius: 8, cursor: currentStep === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentStep === 0 ? 0.3 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNext}
                style={{ background: currentStep === steps.length - 1 ? 'var(--success)' : 'var(--accent)', border: 'none', color: '#FFF', padding: '0 16px', height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}
              >
                {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
