import React from 'react'

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const variants = {
    primary: 'bg-primary text-white active:bg-primary-hover active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed',
    outline: 'bg-transparent border border-[var(--border)] text-[var(--text-main)] active:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
  }

  return (
    <button 
      type={type}
      disabled={disabled}
      className={`w-full p-4 rounded-button text-base font-semibold flex justify-center items-center gap-2 transition-all ${variants[variant] || ''} ${className}`} 
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
