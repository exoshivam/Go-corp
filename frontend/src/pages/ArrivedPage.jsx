import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { ArrowLeft, Check, Navigation } from 'lucide-react'
import Button from '../components/Button'

const MapUpdater = ({ position }) => {
  const map = useMap()
  useEffect(() => {
    if (position && map) {
      map.flyTo(position, 16)
    }
  }, [position, map])
  return null
}

const ArrivedPage = () => {
  const navigate = useNavigate()
  const [rideData, setRideData] = useState(null)
  const [batchData, setBatchData] = useState(null)
  const [currentRideIndex, setCurrentRideIndex] = useState(0)

  useEffect(() => {
    const acceptedRide = localStorage.getItem('acceptedRide')
    const acceptedBatch = localStorage.getItem('acceptedBatch')
    
    if (acceptedBatch) {
      const batch = JSON.parse(acceptedBatch)
      setBatchData(batch)
      setCurrentRideIndex(0)
    } else if (acceptedRide) {
      setRideData(JSON.parse(acceptedRide))
    }
  }, [])

  const currentRide = batchData?.rides?.[currentRideIndex] || rideData

  const pickupCoords = currentRide?.pickupLocation?.coordinates
    ? [currentRide.pickupLocation.coordinates[1], currentRide.pickupLocation.coordinates[0]]
    : [40.7128, -74.0060]
  const position = pickupCoords

  return (
    <div className="relative h-screen flex flex-col bg-[#f0f0f5] animate-fade-in overflow-hidden">
      <div className="absolute inset-0 z-[1] w-full h-full grayscale-[1] contrast-[0.9] brightness-[1.1] opacity-50">
        <MapContainer className="w-full h-full" center={position} zoom={16} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapUpdater position={position} />
          <Marker position={position} />
        </MapContainer>
      </div>

      <div className="relative z-[10] flex flex-col h-full pointer-events-none">
        <div className="flex items-center px-6 pt-12 pointer-events-auto">
          <button className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg" onClick={() => navigate('/customer-location')}>
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-extrabold text-gray-800">Arrived At Destination</h1>
          </div>
        </div>

        <div className="mt-auto bg-white rounded-t-[40px] p-10 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col items-center pointer-events-auto">
          <div className="w-[120px] h-[120px] bg-primary rounded-full flex items-center justify-center mb-8 relative shadow-[0_15px_30px_rgba(242,148,0,0.4)]">
             {/* Droplet shape outer logic or just circle */}
             <Check size={46} className="text-white stroke-[4]" />
             {/* Custom Drop Shape Simulation */}
             <div className="absolute -bottom-2 w-10 h-10 bg-primary rotate-45 rounded-sm"></div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Arrived At Customer Location</h2>
          <p className="text-sm font-bold text-gray-400 mb-10">{currentRide?.pickupAddress || 'Loading location...'}</p>

          {batchData && (
            <p className="text-xs font-bold text-primary mb-4 bg-orange-50 px-3 py-1 rounded-full">
              Stop {currentRideIndex + 1} of {batchData.rides.length}
            </p>
          )}

          <Button className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)] w-full py-5" onClick={() => navigate('/otp-verification')}>
            Ask for OTP
          </Button>

          {/* Floating map focus icon like in design */}
          <div className="absolute top-[-30px] right-6 p-4 bg-white rounded-2xl shadow-xl border border-gray-100 pointer-events-auto">
              <Navigation size={24} className="text-primary fill-primary opacity-20" />
              <Navigation size={24} className="text-primary absolute top-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArrivedPage
