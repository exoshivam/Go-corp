import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import SocialLogin from '../components/SocialLogin'
import { useDriverAuth } from '../context/DriverAuthContext'
import { loginDriver } from '../services/driverAPI'

const SignInPage = () => {
  const navigate = useNavigate()
  const { login } = useDriverAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError('Please fill in all fields')
        setLoading(false)
        return
      }

      const data = await loginDriver(email, password)
      login(data.driver, data.token)
      navigate('/location')
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen justify-center text-center container animate-fade-in">
      <div className="mb-10">
        <h1 className="text-[32px] mb-3">Sign In</h1>
        <p className="text-[15px] text-[var(--text-muted)]">Hi! Welcome back, you've been missed</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      <form className="mb-6" onSubmit={handleSignIn}>
        <Input 
          label="Email" 
          placeholder="example@gmail.com" 
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input 
          label="Password" 
          placeholder="************" 
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        <div className="text-right mb-6 text-sm font-semibold text-primary cursor-pointer">
          <span>Forgot Password?</span>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      <SocialLogin />

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        Don't have an account? <span className="text-primary font-bold cursor-pointer underline" onClick={() => navigate('/signup')}>Sign Up</span>
      </p>
    </div>
  )
}

export default SignInPage
