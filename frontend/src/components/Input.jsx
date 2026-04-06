import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const Input = ({ label, placeholder, type = 'text', value = '', onChange, icon: Icon, name = '' }) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="mb-5 w-full">
      {label && <label className="block text-sm font-semibold mb-2 text-left">{label}</label>}
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-3 text-[var(--text-muted)]" size={20} />}
        <input 
          type={currentType} 
          placeholder={placeholder}
          name={name}
          value={value || ''}
          onChange={onChange}
          autoComplete="off"
          className={`w-full px-4 py-3.5 border border-[var(--border)] rounded-[var(--radius-md)] text-[15px] bg-white focus:outline-none focus:border-primary transition-colors ${Icon ? 'pl-10' : ''}`}
        />
        {isPassword && (
          <button 
            type="button" 
            className="absolute right-3 bg-none border-none text-[var(--text-muted)] flex items-center p-1"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </div>
  )
}

export default Input
