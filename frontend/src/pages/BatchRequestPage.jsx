import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import CircularTimer from '../components/Dashboard/CircularTimer'
import Button from '../components/Button'
import { useRide } from '../context/RideContext'

const BatchRequestPage = () => {
  const navigate = useNavigate()
  const { activeBatch, clearActiveBatch, declineBatch } = useRide()

  // Default position if no batch data - use first ride's pickup location
  const position = activeBatch?.rides?.[0]?.pickup_location?.coordinates
    ? [activeBatch.rides[0].pickup_location.coordinates[1], activeBatch.rides[0].pickup_location.coordinates[0]]
    : [40.7128, -74.0060]

  const handleDecline = () => {
    if (activeBatch) {
      declineBatch(activeBatch._id)
    }
    navigate('/dashboard')
  }

  const handleAccept = () => {
    // Create a structured batch object to pass to next page
    if (activeBatch) {
      localStorage.setItem('acceptedBatch', JSON.stringify({
        batchId: activeBatch._id,
        direction: activeBatch.direction,
        rides: activeBatch.rides.map(ride => ({
          rideId: ride._id,
          employeeName: ride.employee_id?.name,
          pickupAddress: ride.pickup_address,
          pickupLocation: ride.pickup_location,
          dropAddress: ride.drop_address,
          dropLocation: ride.drop_location,
          pickupOrder: ride.pickup_order,
          otp: ride.otp
        }))
      }))
      navigate('/customer-location')
    }
  }

  const handleTimerComplete = () => {
    // Timer expired, decline the batch and go back to dashboard
    if (activeBatch) {
      declineBatch(activeBatch._id)
    }
    navigate('/dashboard')
  }

  // If no active batch, redirect to dashboard
  useEffect(() => {
    if (!activeBatch) {
      navigate('/dashboard')
    }
  }, [activeBatch, navigate])

  if (!activeBatch) {
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

        <div className="mt-auto bg-white rounded-t-[40px] p-8 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-[20] max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-gray-800">
              Batch Request
              <span className="ml-3 text-sm font-bold text-white bg-primary px-3 py-1 rounded-full inline-block">
                {activeBatch.rides?.length || 0} Passengers
              </span>
            </h2>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {activeBatch.scheduled_at ? new Date(activeBatch.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Soon'}
            </span>
          </div>

          {/* Passengers List */}
          <div className="space-y-4 mb-8">
            {activeBatch.rides?.map((ride, index) => (
              <div key={ride._id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {ride.pickup_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="font-extrabold text-gray-800 truncate">
                        {ride.employee_id?.name || 'Employee'}
                      </h4>
                      <span className="text-xs font-bold text-primary bg-orange-50 px-2 py-1 rounded whitespace-nowrap">
                        Stop {ride.pickup_order}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      📍 {ride.pickup_address || 'Pickup'}
                    </p>
                    <p className="text-xs text-gray-400">
                      📍 {ride.drop_address || 'Drop off'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Route Summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
            <p className="text-sm font-bold text-blue-900">
              Total Distance & Time
            </p>
            <p className="text-xs text-blue-700 mt-1">
              This batch covers all pickups and drop-offs efficiently
            </p>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" className="text-primary border-none shadow-none text-lg bg-gray-50" onClick={handleDecline}>
              Decline
            </Button>
            <Button className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)]" onClick={handleAccept}>
              Accept Batch
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BatchRequestPage
