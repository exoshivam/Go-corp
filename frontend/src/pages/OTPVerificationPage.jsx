import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from '../components/Button'

const OTPVerificationPage = () => {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(['', '', '', ''])
  const [rideData, setRideData] = useState(null)
  const [batchData, setBatchData] = useState(null)
  const [currentRideIndex, setCurrentRideIndex] = useState(0)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    const acceptedRide = localStorage.getItem('acceptedRide')
    const acceptedBatch = localStorage.getItem('acceptedBatch')
    
    if (acceptedBatch) {
      const batch = JSON.parse(acceptedBatch)
      setBatchData(batch)
      const savedIndex = sessionStorage.getItem('currentRideIndex')
      setCurrentRideIndex(savedIndex ? parseInt(savedIndex) : 0)
    } else if (acceptedRide) {
      setRideData(JSON.parse(acceptedRide))
    }
  }, [])

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const currentRide = batchData?.rides?.[currentRideIndex] || rideData

  const handleChange = (index, value) => {
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')
    
    // Auto-focus next input
    if (value && index < 3) {
      document.getElementById(`otp-${index + 1}`).focus()
    }
  }

  const handleVerifyOTP = async () => {
    const enteredOtp = otp.join('')
    
    if (enteredOtp.length !== 4) {
      setError('Please enter all 4 digits')
      return
    }

    const rideId = currentRide?.rideId || rideData?.rideId
    if (!rideId) {
      setError('Ride information not found')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const response = await fetch('http://localhost:5000/api/ride/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ride_id: rideId,
          otp: enteredOtp
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid OTP. Please try again.')
        return
      }

      // OTP verified successfully
      console.log('✅ OTP Verified Successfully')
      
      // If batch, save current ride index for next pages
      if (batchData) {
        sessionStorage.setItem('currentRideIndex', currentRideIndex.toString())
      }
      
      navigate('/destination')
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Failed to verify OTP. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white container animate-fade-in relative pt-12">
      <div className="flex items-center mb-16">
        <button className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-md border border-gray-100" onClick={() => navigate('/arrived')}>
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center pr-12">
          <h1 className="text-xl font-extrabold text-gray-800">OTP Verification</h1>
        </div>
      </div>

      <div className="text-center px-4 mb-12">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-4">Enter Customer's OTP</h2>
        {batchData && (
          <p className="text-xs font-bold text-primary mb-4">Stop {currentRideIndex + 1} of {batchData.rides.length}</p>
        )}
        <p className="text-sm font-bold text-gray-400 max-w-[280px] mx-auto leading-relaxed">
          We sent a PIN to your customer's mobile number
        </p>
      </div>

      <div className="flex justify-center gap-4 mb-8 px-4">
        {otp.map((digit, idx) => (
          <input
            key={idx}
            id={`otp-${idx}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            className="w-[70px] h-[70px] bg-gray-50 border border-gray-100 rounded-2xl text-center text-2xl font-extrabold text-gray-800 focus:border-primary focus:bg-white focus:outline-none transition-all shadow-sm"
            disabled={isVerifying}
          />
        ))}
      </div>

      {error && (
        <div className="text-center px-4 mb-6">
          <p className="text-sm font-bold text-red-500">{error}</p>
        </div>
      )}

      <div className="text-center mb-12">
        <p className="text-sm font-bold text-gray-400 mb-2">Didn't receive OTP?</p>
        <button 
          className="text-sm font-extrabold text-gray-900 border-b-2 border-gray-900 leading-tight disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={resendTimer > 0}
        >
          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
        </button>
      </div>

      <div className="mt-auto pb-10 sm:pb-12">
        <Button 
          className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)] w-full py-5" 
          onClick={handleVerifyOTP}
          disabled={isVerifying}
        >
          {isVerifying ? 'Verifying...' : 'Verify & Start Ride'}
        </Button>
      </div>
    </div>
  )
}

export default OTPVerificationPage
