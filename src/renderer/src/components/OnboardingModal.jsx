import React, { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { Compass, Building2, Settings2, PlusCircle, CheckCircle2, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react'

export default function OnboardingModal() {
  const { setShowTutorial } = useData()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)

  const finishTutorial = async () => {
    try {
      await window.api.saveConfig('has_seen_tutorial', 'true')
      setShowTutorial(false)
    } catch (e) {
      console.error('Error saving tutorial status', e)
      setShowTutorial(false)
    }
  }

  const steps = [
    {
      type: 'modal',
      title: 'Bienvenido a Bitácora Inversión',
      icon: <Compass size={48} color="var(--accent)" />,
      description: 'El centro de control premium para tu patrimonio.',
      content: (
        <div style={{ textAlign: 'left', lineHeight: 1.6, color: '#E2E8F0' }}>
          <p style={{ marginBottom: 16 }}>
            Esta aplicación está diseñada específicamente para <strong>gestionar tus productos de inversión</strong> y hacer seguimiento de tu patrimonio neto a largo plazo.
          </p>
          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#fff', fontSize: 13 }}>
            <strong>Aclaración importante:</strong> Bitácora Inversión no es una app de control de gastos diarios ni de liquidez corriente. Está enfocada en calcular rentabilidades, plusvalías y el crecimiento de tus activos de inversión.
          </div>
        </div>
      )
    },
    {
      type: 'popover',
      targetId: 'tutorial-settings',
      title: 'Configura tu Entorno',
      content: 'El primer paso será ir a Configuración. Desde allí podrás dar de alta tus Entidades (bancos y brókers) y personalizar tus Categorías y Tipos de Activos a tu medida.'
    },
    {
      type: 'popover',
      targetId: 'tutorial-new-op',
      title: 'Registra Operaciones',
      content: (
        <>
          <p>Una vez configurado, usa este botón para registrar compras, ventas, dividendos o aportaciones. ¡La app usa sistema FIFO para calcular tus plusvalías automáticamente!</p>
          <div style={{ marginTop: 12, padding: 8, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, fontSize: 12, color: '#93C5FD' }}>
            💡 Si quieres profundizar más, encontrarás un <strong>Tutorial Avanzado</strong> muy completo dentro del menú Configuración.
          </div>
        </>
      )
    }
  ]

  const activeStep = steps[currentStep]

  // Actualizar la posición si es un popover
  useEffect(() => {
    if (activeStep.type === 'popover' && activeStep.targetId) {
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
      }
    } else {
      setTargetRect(null)
    }
  }, [currentStep, activeStep])

  // Escuchar redimensionado de ventana para ajustar popover
  useEffect(() => {
    const handleResize = () => {
      if (activeStep.type === 'popover' && activeStep.targetId) {
        const el = document.getElementById(activeStep.targetId)
        if (el) {
          const rect = el.getBoundingClientRect()
          setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, right: rect.right })
        }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeStep])

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

  return (
    <>
      {/* Fondo oscuro general */}
      <div style={{
        position: 'fixed', inset: 0, 
        background: activeStep.type === 'modal' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.4)', 
        backdropFilter: activeStep.type === 'modal' ? 'blur(8px)' : 'none',
        zIndex: 99998,
        transition: 'all 0.4s ease'
      }} />

      {/* Highlighter Element (Recorte visual para el objetivo) */}
      {activeStep.type === 'popover' && targetRect && (
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

      {/* Contenido del Modal Principal */}
      {activeStep.type === 'modal' && (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            width: 550, padding: 40, display: 'flex', flexDirection: 'column',
            background: '#1A1E2E', // Fondo oscuro sólido para máximo contraste
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            position: 'relative'
          }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(0, 113, 227, 0.1)', borderRadius: '50%' }}>
                {activeStep.icon}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, color: '#FFFFFF' }}>
                {activeStep.title}
              </h2>
              <p style={{ fontSize: 16, color: '#93C5FD', fontWeight: 600, marginBottom: 28 }}>
                {activeStep.description}
              </p>
              <div style={{ width: '100%' }}>
                {activeStep.content}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40 }}>
              <button className="btn" onClick={handleNext} style={{ background: 'var(--accent)', padding: '0 32px', height: 44, fontSize: 15 }}>
                Empezar Tour <ChevronRight size={18} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido del Popover (Guía Interactiva) */}
      {activeStep.type === 'popover' && targetRect && (
        <div style={{
          position: 'fixed',
          top: targetRect.top + (targetRect.height / 2) - 80, // Centrado verticalmente aproximado
          left: targetRect.right + 24, // A la derecha del elemento
          width: 320,
          background: '#1A1E2E',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          zIndex: 100000,
          animation: 'toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'top 0.3s ease, left 0.3s ease'
        }}>
          {/* Triángulo apuntador */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: -8,
            marginTop: -8,
            width: 0,
            height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '8px solid #1A1E2E'
          }} />

          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FFF', marginBottom: 12 }}>{activeStep.title}</h3>
          <p style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 24 }}>{activeStep.content}</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
              Paso {currentStep} de {steps.length - 1}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={handlePrev}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNext}
                style={{ background: currentStep === steps.length - 1 ? 'var(--success)' : 'var(--accent)', border: 'none', color: '#FFF', padding: '0 16px', height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 13 }}
              >
                {currentStep === steps.length - 1 ? '¡Entendido!' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
