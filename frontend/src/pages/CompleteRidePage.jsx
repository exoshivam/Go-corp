import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { ArrowLeft, Check, Navigation } from 'lucide-react'
import Button from '../components/Button'
import L from 'leaflet'

const orangeCircleIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f29400; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 15px rgba(242,148,0,0.5);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const CompleteRidePage = () => {
  const navigate = useNavigate()
  const [batchData, setBatchData] = useState(null)

  useEffect(() => {
    const acceptedBatch = localStorage.getItem('acceptedBatch')
    if (acceptedBatch) {
      setBatchData(JSON.parse(acceptedBatch))
    }
  }, [])

  const position = [40.7128, -74.0060]

  const handleFinish = () => {
    // Clear batch data and go to dashboard
    localStorage.removeItem('acceptedBatch')
    localStorage.removeItem('acceptedRide')
    localStorage.removeItem('rideId')
    navigate('/dashboard')
  }

  return (
    <div className="relative h-screen flex flex-col bg-[#f0f0f5] animate-fade-in overflow-hidden">
      {/* Map Background (Dimmed) */}
      <div className="absolute inset-0 z-[1] w-full h-full grayscale-[1] contrast-[0.8] brightness-[1.1] opacity-60">
        <MapContainer 
          center={position} 
          zoom={15} 
          scrollWheelZoom={true} 
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} icon={orangeCircleIcon} />
        </MapContainer>
      </div>

      {/* UI Overlay */}
      <div className="relative z-[10] flex flex-col h-full pointer-events-none">
        {/* Header */}
        <div className="flex items-center px-6 pt-12 pointer-events-auto">
          <button 
            className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg border border-gray-100" 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center pr-12">
            <h1 className="text-xl font-extrabold text-gray-800">Batch Completed</h1>
          </div>
        </div>

        {/* Bottom Area / Drawer */}
        <div className="mt-auto bg-white rounded-t-[50px] p-10 pb-4 shadow-[0_-15px_50px_rgba(0,0,0,0.15)] flex flex-col items-center pointer-events-auto relative max-h-[60vh] overflow-y-auto">
          {/* Drawer Handle/Indicator */}
          <div className="w-[120px] h-1.5 bg-gray-100 rounded-full absolute top-6 opacity-80"></div>
          
          {/* Main Success Icon */}
          <div className="w-[120px] h-[120px] bg-primary rounded-full flex items-center justify-center mt-6 mb-8 relative shadow-[0_15px_30px_rgba(242,148,0,0.4)]">
            <div className="absolute -bottom-2 w-10 h-10 bg-primary rotate-45 rounded-[4px]"></div>
            <div className="bg-primary w-full h-full rounded-full flex items-center justify-center z-[2]">
              <Check size={46} className="text-white stroke-[4]" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">All Deliveries Complete</h2>
          <p className="text-sm font-bold text-gray-400 mb-8 w-[70%] text-center">
            {batchData?.rides?.length || 0} passengers successfully delivered
          </p>

          {/* Completed Passengers Summary */}
          {batchData?.rides && batchData.rides.length > 0 && (
            <div className="w-full bg-gray-50 rounded-lg p-4 mb-8 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Passengers Delivered</p>
              <div className="space-y-2">
                {batchData.rides.map((ride, index) => (
                  <div key={ride.rideId} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                      {ride.pickupOrder}
                    </div>
                    <span className="font-semibold text-gray-700">{ride.employeeName}</span>
                    <span className="text-xs text-gray-400 ml-auto">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button 
            className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)] w-full py-5 mb-10" 
            onClick={handleFinish}
          >
            Collect Cash
          </Button>

          {/* Floating Focus Icon */}
          <div className="absolute top-[-40px] right-8 p-4 bg-white rounded-2xl shadow-xl border border-gray-50 flex items-center justify-center text-primary">
            <Navigation size={28} className="fill-primary opacity-20" />
            <Navigation size={28} className="absolute" />
          </div>

          {/* Home Indicator */}
          <div className="w-[140px] h-1.5 bg-gray-900 rounded-full mx-auto mb-4 opacity-90"></div>
        </div>
      </div>
    </div>
  )
}

export default CompleteRidePage
