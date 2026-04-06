import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl } from 'react-leaflet'
import { ArrowLeft, MapPin, Navigation } from 'lucide-react'
import Button from '../components/Button'
import L from 'leaflet'

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Orange Marker
const orangeIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f29400; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 15px rgba(242,148,0,0.5);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const DestinationPage = () => {
  const navigate = useNavigate()
  const [rideData, setRideData] = useState(null)
  const [batchData, setBatchData] = useState(null)
  const [currentRideIndex, setCurrentRideIndex] = useState(0)
  const [routePath, setRoutePath] = useState(null)

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

  const currentRide = batchData?.rides?.[currentRideIndex] || rideData

  // Mock positions if not available
  const startPos = [40.7128, -74.0060] // New York
  const endPos = currentRide?.dropLocation?.coordinates
    ? [currentRide.dropLocation.coordinates[1], currentRide.dropLocation.coordinates[0]]
    : [40.73061, -73.935242] // Brooklyn

  useEffect(() => {
    // Simulate route fetching
    if (currentRide) {
      // In a real app, we'd fetch actual coordinates
      setRoutePath([startPos, [40.72, -73.98], [40.725, -73.96], endPos])
    } else {
      setRoutePath([startPos, [40.72, -73.98], [40.725, -73.96], endPos])
    }
  }, [currentRide])

  const handleCompleteRide = () => {
    if (batchData && currentRideIndex < batchData.rides.length - 1) {
      // Move to next ride in batch
      const nextIndex = currentRideIndex + 1
      setCurrentRideIndex(nextIndex)
      sessionStorage.setItem('currentRideIndex', nextIndex.toString())
      navigate('/customer-location')
    } else {
      // Batch complete
      navigate('/complete-ride')
    }
  }

  return (
    <div className="relative h-screen flex flex-col bg-white animate-fade-in overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 z-[1] w-full h-full grayscale-[1] contrast-[0.8] brightness-[1.1] opacity-60">
        <MapContainer 
          center={[(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2]} 
          zoom={13} 
          scrollWheelZoom={true} 
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {routePath && (
            <>
              <Polyline pathOptions={{ color: '#444', weight: 4, opacity: 0.8 }} positions={routePath} />
              <Marker position={startPos} icon={orangeIcon} />
              <Marker position={endPos} icon={orangeIcon} />
            </>
          )}
        </MapContainer>
      </div>

      {/* UI Overlay */}
      <div className="relative z-[10] flex flex-col h-full pointer-events-none">
        {/* Header */}
        <div className="flex items-center px-6 pt-12 pointer-events-auto">
          <button 
            className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg border border-gray-100" 
            onClick={() => navigate('/otp-verification')}
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center pr-12">
            <h1 className="text-xl font-extrabold text-gray-800">Destination</h1>
          </div>
        </div>

        {/* Re-center button */}
        <div className="flex justify-end p-6 mt-auto mb-4 pointer-events-auto">
            <button className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg border border-gray-100 text-primary">
                <Navigation size={24} className="fill-primary opacity-20" />
                <Navigation size={24} className="absolute" />
            </button>
        </div>

        {/* Bottom Area */}
        <div className="bg-transparent px-6 pb-10 pointer-events-auto">
          {/* Address Card */}
          <div className="bg-white rounded-2xl p-5 mb-6 shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                <MapPin size={24} fill="currentColor" className="opacity-20" />
                <MapPin size={24} className="absolute" />
            </div>
            <div>
                <p className="text-lg font-extrabold text-gray-800 leading-tight">
                    {currentRide?.dropAddress || '1901 Thornridge Cir. Shiloh, Hawaii 81063'}
                </p>
                {batchData && (
                  <p className="text-xs font-bold text-primary mt-1">Stop {currentRideIndex + 1} of {batchData.rides.length}</p>
                )}
            </div>
          </div>

          <Button 
            className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)] w-full py-5" 
            onClick={handleCompleteRide}
          >
            {batchData && currentRideIndex < batchData.rides.length - 1 ? 'Next Passenger' : 'Complete Delivery'}
          </Button>
        </div>

        {/* Home Indicator */}
        <div className="w-[140px] h-1.5 bg-gray-900 rounded-full mx-auto mb-2 opacity-90"></div>
      </div>
    </div>
  )
}

export default DestinationPage
