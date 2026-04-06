import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import CircularTimer from '../components/Dashboard/CircularTimer'
import Button from '../components/Button'
import { useRide } from '../context/RideContext'

const RideRequestPage = () => {
  const navigate = useNavigate()
  const { activeRide, clearActiveRide, declineRide } = useRide()

  // Default position if no ride data
  const position = activeRide?.pickup_location?.coordinates
    ? [activeRide.pickup_location.coordinates[1], activeRide.pickup_location.coordinates[0]]
    : [40.7128, -74.0060]

  const handleDecline = () => {
    if (activeRide) {
      declineRide(activeRide._id)
    }
    navigate('/dashboard')
  }

  const handleAccept = () => {
    // Create a structured ride object to pass to next page
    if (activeRide) {
      localStorage.setItem('acceptedRide', JSON.stringify({
        rideId: activeRide._id,
        employeeName: activeRide.employee_id?.name,
        pickupAddress: activeRide.pickup_address,
        pickupLocation: activeRide.pickup_location,
        dropAddress: activeRide.drop_address,
        dropLocation: activeRide.drop_location,
        paymentMethod: 'Cash Payment' // Can be enhanced based on data
      }))
      navigate('/customer-location')
    }
  }

  const handleTimerComplete = () => {
    // Timer expired, decline the ride and go back to dashboard
    if (activeRide) {
      declineRide(activeRide._id)
    }
    navigate('/dashboard')
  }

  // If no active ride, redirect to dashboard
  useEffect(() => {
    if (!activeRide) {
      navigate('/dashboard')
    }
  }, [activeRide, navigate])

  if (!activeRide) {
    return null
  }

  return (
    <div className="relative h-screen flex flex-col bg-[#f0f0f5] animate-fade-in overflow-hidden">
      <div className="absolute inset-0 z-[1] w-full h-full grayscale-[0.8] contrast-[0.9] brightness-[1.1]">
        <MapContainer className="w-full h-full" center={position} zoom={15} scrollWheelZoom={false} zoomControl={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
      </div>

      <div className="relative z-[10] flex flex-col h-full bg-black/5">
        <div className="flex justify-center mt-32 gap-6 items-center">
            <CircularTimer initialTime={20} onComplete={handleTimerComplete} />
        </div>

        <div className="mt-auto bg-white rounded-t-[40px] p-8 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-[20]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-gray-800">Ride Request</h2>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {activeRide.scheduled_at ? new Date(activeRide.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Soon'}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden ring-4 ring-orange-50">
                {/* Placeholder avatar - can be enhanced with actual employee photo */}
                <div className="w-full h-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-2xl">
                  {activeRide.employee_id?.name?.first_name?.[0] || 'U'}
                </div>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-800">
                {activeRide.employee_id?.name?.first_name || 'Employee'} {activeRide.employee_id?.name?.last_name || ''}
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cash Payment</p>
            </div>
          </div>

          <div className="space-y-6 mb-8 relative pl-8">
            {/* Pick-up location */}
            <div className="relative">
              <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full border-4 border-gray-900 bg-white z-10"></div>
              <p className="text-sm font-bold text-gray-500 leading-tight">{activeRide.pickup_address || 'Pickup Location'}</p>
            </div>
            
            {/* Visual connector */}
            <div className="absolute left-[3.5px] top-6 bottom-6 w-[1.5px] border-l-2 border-dashed border-gray-200"></div>

            {/* Drop-off location */}
            <div className="relative">
              <div className="absolute -left-8 top-1.5 w-4 h-5 rounded-t-full rounded-b-full bg-primary flex items-center justify-center">
                <div className="w-1 h-1 bg-white rounded-full"></div>
              </div>
              <p className="text-sm font-bold text-gray-900 leading-tight">{activeRide.drop_address || 'Drop Location'}</p>
              <div className="absolute right-0 top-0 bg-white border border-gray-100 shadow-sm px-3 py-1 rounded-lg text-[10px] font-extrabold text-gray-400 uppercase">
                Est. {Math.floor(Math.random() * 15 + 5)} mins
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" className="text-primary border-none shadow-none text-lg bg-gray-50" onClick={handleDecline}>
              Decline
            </Button>
            <Button className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)]" onClick={handleAccept}>
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RideRequestPage
