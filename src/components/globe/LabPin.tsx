'use client'
import React from 'react'

interface LabPinProps {
  label: string
  onClick: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const LabPin = React.forwardRef<HTMLButtonElement, LabPinProps>(
  function LabPin({ label, onClick, onMouseEnter, onMouseLeave }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          opacity: 0,
          pointerEvents: 'none',
          fontFamily: '"IBM Plex Mono", monospace',
          zIndex: 5,
        }}
        aria-label={label}
      >
        {/* Pulse ring */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1.5px solid #ff6f61',
            transform: 'translate(-50%, -50%)',
            animation: 'famePulse 2.6s ease-out infinite',
          }}
        />
        {/* Dot */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#ff6f61',
            boxShadow: '0 0 12px #ff6f61, 0 0 0 3px rgba(255,111,97,0.18)',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {/* Label pill */}
        <span
          style={{
            position: 'absolute',
            transform: 'translate(-50%, 16px)',
            whiteSpace: 'nowrap',
            fontSize: 11,
            letterSpacing: '0.14em',
            color: '#fff',
            background: 'rgba(47,68,134,0.92)',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '4px 9px',
            borderRadius: 6,
            backdropFilter: 'blur(6px)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </button>
    )
  }
)
