import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import Button from '../components/Button'

const LocationAccessPage = () => {
  const navigate = useNavigate()

  const handleAllowLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          console.log('Location access granted:', { latitude, longitude })
          // Store location in localStorage
          localStorage.setItem('driverLocation', JSON.stringify({ latitude, longitude }))
          // Navigate to dashboard
          navigate('/dashboard')
        },
        (error) => {
          console.error('Error getting location:', error)
          alert('Failed to get location. Please allow access in your browser settings.')
        }
      )
    } else {
      alert('Geolocation is not supported by your browser.')
    }
  }

  return (
    <div className="flex flex-col justify-between h-screen pb-10 text-center container animate-fade-in">
      <div className="flex-1 flex flex-col justify-center items-center max-w-[300px] mx-auto">
        <div className="w-[120px] h-[120px] bg-[#fef3c7] rounded-full flex justify-center items-center mb-8">
          <MapPin size={48} color="var(--primary)" />
        </div>
        
        <h2 className="text-2xl mb-4">Enable Location Access</h2>
        <p className="text-[var(--text-muted)] text-sm leading-[1.6]">To ensure a seamless and efficient experience, allow us access to your location.</p>
      </div>

      <div className="w-full">
        <Button onClick={handleAllowLocation}>
          Allow Location Access
        </Button>
        <p className="mt-5 text-primary font-bold cursor-pointer" onClick={() => navigate('/dashboard')}>
          Maybe Later
        </p>
      </div>
    </div>
  )
}

export default LocationAccessPage
