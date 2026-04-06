import React, { createContext, useContext, useState, useEffect } from 'react'
import { logoutDriver as logoutDriverAPI } from '../services/driverAPI'

const DriverAuthContext = createContext()

export const DriverAuthProvider = ({ children }) => {
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedDriver = localStorage.getItem('driver')
    const token = localStorage.getItem('driverToken')
    
    if (storedDriver && token) {
      setDriver(JSON.parse(storedDriver))
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const logout = async () => {
    await logoutDriverAPI()
    setDriver(null)
    setIsAuthenticated(false)
  }

  const login = (driverData, token) => {
    setDriver(driverData)
    setIsAuthenticated(true)
  }

  const value = {
    driver,
    loading,
    isAuthenticated,
    logout,
    login,
    setDriver
  }

  return (
    <DriverAuthContext.Provider value={value}>
      {children}
    </DriverAuthContext.Provider>
  )
}

export const useDriverAuth = () => {
  const context = useContext(DriverAuthContext)
  if (!context) {
    throw new Error('useDriverAuth must be used within DriverAuthProvider')
  }
  return context
}
