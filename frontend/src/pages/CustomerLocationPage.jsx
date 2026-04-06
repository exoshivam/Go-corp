import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { ArrowLeft, Phone, MessageSquare } from 'lucide-react'
import Button from '../components/Button'

const CustomerLocationPage = () => {
  const navigate = useNavigate()
  const [rideData, setRideData] = useState(null)
  const [batchData, setBatchData] = useState(null)
  const [currentRideIndex, setCurrentRideIndex] = useState(0)
  const [routePath, setRoutePath] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [estimatedTime, setEstimatedTime] = useState(null)

  useEffect(() => {
    // Get accepted ride or batch data from localStorage
    const acceptedRide = localStorage.getItem('acceptedRide')
    const acceptedBatch = localStorage.getItem('acceptedBatch')
    
    if (acceptedBatch) {
      const batch = JSON.parse(acceptedBatch)
      setBatchData(batch)
      // Initialize with first ride in batch
      setCurrentRideIndex(0)
    } else if (acceptedRide) {
      setRideData(JSON.parse(acceptedRide))
    }
  }, [])

  // Get actual driver position from localStorage
  const storedLocation = localStorage.getItem('driverLocation')
  const driverLatLng = storedLocation ? JSON.parse(storedLocation) : null
  const driverPos = driverLatLng ? [driverLatLng.latitude, driverLatLng.longitude] : [28.6280, 77.3649]

  // Determine current ride (from batch or single ride)
  const currentRide = batchData?.rides?.[currentRideIndex] || rideData

  const customerPos = currentRide?.pickupLocation?.coordinates
    ? [currentRide.pickupLocation.coordinates[1], currentRide.pickupLocation.coordinates[0]]
    : [28.6350, 77.3700]

  // Display route from driver to customer
  useEffect(() => {
    // Only show route if we have valid ride data with pickup location
    if (!currentRide?.pickupLocation) {
      console.log('⏳ Waiting for ride data...')
      return
    }

    const driverCoords = storedLocation ? JSON.parse(storedLocation) : null
    if (!driverCoords) return

    const dLat = driverCoords.latitude
    const dLng = driverCoords.longitude
    const cLng = currentRide.pickupLocation.coordinates[0]
    const cLat = currentRide.pickupLocation.coordinates[1]

    const fetchRoute = async () => {
      setLoadingRoute(true)
      try {
        console.log('📍 Fetching actual road route...')
        console.log('🚗 Driver:', dLat, dLng)
        console.log('📍 Customer:', cLat, cLng)
        
        // Call our backend endpoint
        const backendUrl = `http://localhost:5000/api/ride/route?startLat=${dLat}&startLng=${dLng}&endLat=${cLat}&endLng=${cLng}`
        
        const response = await fetch(backendUrl)
        const data = await response.json()
        
        console.log('📡 Backend Response:', data)

        if (data.success && data.data && data.data.coordinates && data.data.coordinates.length > 0) {
          const coordinates = data.data.coordinates
          const timeInMinutes = Math.round(data.data.duration / 60)
          console.log('✅ Actual road route loaded!')
          console.log('📏 Distance:', (data.data.distance / 1000).toFixed(2), 'km')
          console.log('⏱️ Duration:', timeInMinutes, 'minutes')
          console.log('📍 Number of route points:', coordinates.length)
          setRoutePath(coordinates)
          setEstimatedTime(timeInMinutes)
        } else {
          console.warn('⚠️ Invalid response, showing straight line fallback')
          // Fallback to straight line
          setRoutePath([[dLat, dLng], [cLat, cLng]])
        }
      } catch (error) {
        console.error('❌ Error fetching route:', error)
        // Fallback to straight line if route fails
        console.log('🔄 Using fallback straight line route')
        setRoutePath([[dLat, dLng], [cLat, cLng]])
      } finally {
        setLoadingRoute(false)
      }
    }

    fetchRoute()
  }, [currentRide, storedLocation])

  const handleNext = () => {
    if (batchData && currentRideIndex < batchData.rides.length - 1) {
      setCurrentRideIndex(currentRideIndex + 1)
    } else {
      navigate('/arrived')
    }
  }

  if (!currentRide) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No ride data available</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen flex flex-col bg-[#f0f0f5] animate-fade-in overflow-hidden">
      <div className="absolute inset-0 z-[1] w-full h-full grayscale-[0.8] contrast-[0.9] brightness-[1.1]">
        <MapContainer className="w-full h-full" center={customerPos} zoom={15} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {routePath && routePath.length > 0 && (
            <>
              <Polyline pathOptions={{ color: 'lime', weight: 5, opacity: 0.8 }} positions={routePath} />
              <Marker position={driverPos} title="Driver Location" />
              <Marker position={customerPos} title="Customer Pickup Location" />
            </>
          )}
          {!routePath && <Marker position={customerPos} title="Customer Location" />}
        </MapContainer>
      </div>

      <div className="relative z-[10] flex flex-col h-full pointer-events-none">
        <div className="flex items-center px-6 pt-10 pointer-events-auto">
          <button className="w-12 h-12 bg-white rounded-full flex justify-center items-center shadow-lg" onClick={() => navigate(batchData ? '/batch-request' : '/ride-request')}>
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-extrabold text-gray-800">Customer Location</h1>
          </div>
        </div>

        <div className="mt-auto bg-white rounded-t-[40px] p-8 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] pointer-events-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-gray-800">Customer Location</h2>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {loadingRoute ? '📍 Loading route...' : estimatedTime ? `${estimatedTime} mins Away` : '5 mins Away'}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden ring-4 ring-orange-50">
              {/* Placeholder avatar */}
              <div className="w-full h-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-2xl">
                {currentRide?.employeeName?.[0] || 'U'}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-800">
                {currentRide?.employeeName || 'Employee'}
                {batchData && <span className="ml-2 text-sm bg-primary text-white px-2 py-1 rounded">Stop {currentRideIndex + 1}</span>}
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{currentRide?.paymentMethod || 'Cash Payment'}</p>
            </div>
            <div className="flex-1"></div>
            <div className="flex gap-2">
                <button className="w-12 h-12 bg-orange-50 rounded-full flex justify-center items-center text-primary">
                    <MessageSquare size={20} fill="currentColor" className="opacity-20" />
                    <MessageSquare size={20} className="absolute" />
                </button>
                <button className="w-12 h-12 bg-orange-50 rounded-full flex justify-center items-center text-primary">
                    <Phone size={20} fill="currentColor" className="opacity-20" />
                    <Phone size={20} className="absolute" />
                </button>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pickup</p>
              <p className="text-sm font-bold text-gray-700">{currentRide?.pickupAddress}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dropoff</p>
              <p className="text-sm font-bold text-gray-700">{currentRide?.dropAddress}</p>
            </div>
          </div>

          <Button className="text-lg shadow-[0_10px_20px_rgba(242,148,0,0.3)]" onClick={handleNext}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CustomerLocationPage
