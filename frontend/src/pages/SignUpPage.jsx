import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import SocialLogin from '../components/SocialLogin'
import { useDriverAuth } from '../context/DriverAuthContext'
import { signupDriver } from '../services/driverAPI'

const SignUpPage = () => {
  const navigate = useNavigate()
  const { login } = useDriverAuth()
  const [formData, setFormData] = useState({
    name: { first_name: '', last_name: '' },
    email: '',
    contact: '',
    password: '',
    vehicle: {
      color: '',
      capacity: '',
      license_plate: '',
      vehicleType: ''
    }
  })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: personal info, 2: vehicle info

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleNameChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      name: {
        ...prev.name,
        [name]: value
      }
    }))
  }

  const handleVehicleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      vehicle: {
        ...prev.vehicle,
        [name]: name === 'capacity' ? parseInt(value) || '' : value
      }
    }))
  }

  const validateStep1 = () => {
    if (!formData.name.first_name.trim()) {
      setError('First name is required')
      return false
    }
    if (formData.name.first_name.length < 3) {
      setError('First name must be at least 3 characters')
      return false
    }
    if (!formData.email) {
      setError('Email is required')
      return false
    }
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      setError('Please enter a valid email')
      return false
    }
    if (!formData.contact) {
      setError('Phone number is required')
      return false
    }
    if (!/^\d{10}$/.test(formData.contact)) {
      setError('Phone number must be 10 digits')
      return false
    }
    if (!formData.password) {
      setError('Password is required')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!formData.vehicle.color.trim()) {
      setError('Vehicle color is required')
      return false
    }
    if (formData.vehicle.color.length < 3) {
      setError('Vehicle color must be at least 3 characters')
      return false
    }
    if (!formData.vehicle.capacity) {
      setError('Vehicle capacity is required')
      return false
    }
    const capacity = parseInt(formData.vehicle.capacity)
    if (capacity < 1 || capacity > 7) {
      setError('Vehicle capacity must be between 1 and 7')
      return false
    }
    if (!formData.vehicle.license_plate.trim()) {
      setError('License plate is required')
      return false
    }
    if (!/^[A-Z0-9-]+$/.test(formData.vehicle.license_plate)) {
      setError('License plate must be alphanumeric')
      return false
    }
    if (formData.vehicle.license_plate.length < 5 || formData.vehicle.license_plate.length > 10) {
      setError('License plate must be between 5 and 10 characters')
      return false
    }
    if (!formData.vehicle.vehicleType) {
      setError('Vehicle type is required')
      return false
    }
    if (!termsAccepted) {
      setError('Please accept Terms & Conditions')
      return false
    }
    return true
  }

  const handleNext = () => {
    setError('')
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
    setError('')
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!validateStep2()) {
      setLoading(false)
      return
    }

    try {
      const data = await signupDriver(formData)
      login(data.driver, data.token)
      navigate('/location')
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen justify-center text-center container animate-fade-in">
      <div className="mb-10">
        <h1 className="text-[32px] mb-3">Create Account</h1>
        <p className="text-[15px] text-[var(--text-muted)]">
          {step === 1 ? 'Fill your information below' : 'Add your vehicle details'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      <form className="mb-6" onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSignUp}>
        {step === 1 ? (
          <>
            <Input 
              label="First Name" 
              placeholder="Jenny" 
              type="text"
              name="first_name"
              value={formData.name.first_name}
              onChange={handleNameChange}
            />
            <Input 
              label="Last Name (Optional)" 
              placeholder="Wilson" 
              type="text"
              name="last_name"
              value={formData.name.last_name}
              onChange={handleNameChange}
            />
            <Input 
              label="Email" 
              placeholder="example@gmail.com" 
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <Input 
              label="Phone Number" 
              placeholder="1234567890" 
              type="tel"
              name="contact"
              value={formData.contact}
              onChange={handleInputChange}
            />
            <Input 
              label="Password" 
              placeholder="••••••••" 
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
            />

            <Button type="submit">
              Next
            </Button>
          </>
        ) : (
          <>
            <Input 
              label="Vehicle Color" 
              placeholder="Red" 
              type="text"
              name="color"
              value={formData.vehicle.color}
              onChange={handleVehicleChange}
            />
            <Input 
              label="Vehicle Capacity" 
              placeholder="4" 
              type="number"
              name="capacity"
              value={formData.vehicle.capacity}
              onChange={handleVehicleChange}
            />
            <div className="mb-5 w-full">
              <label className="block text-sm font-semibold mb-2 text-left">Vehicle Type</label>
              <select 
                name="vehicleType"
                value={formData.vehicle.vehicleType}
                onChange={handleVehicleChange}
                className="w-full px-4 py-3.5 border border-[var(--border)] rounded-[var(--radius-md)] text-[15px] bg-white focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Select Vehicle Type</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="auto">Auto</option>
                <option value="bike">Bike</option>
              </select>
            </div>
            <Input 
              label="License Plate" 
              placeholder="ABC-1234" 
              type="text"
              name="license_plate"
              value={formData.vehicle.license_plate}
              onChange={handleVehicleChange}
            />
            
            <div className="flex items-center gap-3 mb-6 text-sm font-medium cursor-pointer">
              <input 
                type="checkbox" 
                id="terms" 
                className="accent-primary w-5 h-5 cursor-pointer"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <label htmlFor="terms">
                Agree with <span className="text-primary underline cursor-pointer">Terms & Condition</span>
              </label>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <Button 
              type="button" 
              variant="outline" 
              onClick={handleBack}
              className="mt-3"
            >
              Back
            </Button>
          </>
        )}
      </form>

      {step === 1 && <SocialLogin />}

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        Already have an account? <span className="text-primary font-bold cursor-pointer underline" onClick={() => navigate('/signin')}>Sign In</span>
      </p>
    </div>
  )
}

export default SignUpPage
