import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Calendar, DollarSign, Navigation, LogOut } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Button from '../components/Button'
import { useRide } from '../context/RideContext'
import { logoutDriver } from '../services/driverAPI'

// Fix for default Leaflet icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

// Custom icons for employees
const createEmployeeIcon = (index) => {
  return L.divIcon({
    html: `
      <div class="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-xs font-bold border-2 border-white shadow-md">
        ${index}
      </div>
    `,
    iconSize: [32, 32],
    className: 'custom-div-icon'
  })
}

// Custom icon for office
const officeIcon = L.divIcon({
  html: `
    <div class="flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-full text-xs font-bold border-2 border-white shadow-md">
      🏢
    </div>
  `,
  iconSize: [40, 40],
  className: 'custom-div-icon'
})

// Map content component to handle fitBounds
const MapContent = ({ position, isOnline, activeBatch, employeeLocations, officeLocation, routePoints }) => {
  const map = useMap()

  // Fit map bounds to show all markers and routes
  useEffect(() => {
    if (employeeLocations.length > 0 && officeLocation) {
      // Collect all coordinates (employees + office)
      const allCoordinates = [
        ...employeeLocations.map(e => e.coordinates),
        officeLocation
      ]

      // Calculate bounds
      const bounds = L.latLngBounds(allCoordinates)
      
      // Fit map to bounds with padding
      map.fitBounds(bounds, { padding: [50, 50] })
    } else if (isOnline) {
      // If no batch, show driver location
      map.setView(position, 13)
    }
  }, [employeeLocations, officeLocation, map, position, isOnline])

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Driver marker */}
      {isOnline && (
        <Marker position={position}>
        </Marker>
      )}

      {/* Employee markers from batch */}
      {employeeLocations.map((emp, idx) => (
        <Marker key={`emp-${idx}`} position={emp.coordinates} icon={createEmployeeIcon(emp.index)}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold">{emp.name}</p>
              <p className="text-xs text-gray-600">{emp.email}</p>
              <p className="text-xs text-gray-600">{emp.phone}</p>
              <p className="text-xs font-semibold text-blue-600 mt-1">Pickup Order: {emp.pickup_order}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Office marker */}
      {officeLocation && (
        <Marker position={officeLocation} icon={officeIcon}>
          <Popup>
            <div className="text-sm font-bold">
              Office Destination
            </div>
          </Popup>
        </Marker>
      )}

      {/* Route polyline */}
      {routePoints && routePoints.length > 0 && (
        <Polyline
          positions={routePoints}
          color="blue"
          weight={4}
          opacity={0.7}
          dashArray="5, 5"
        />
      )}

      {/* Simplified route connecting employees + office */}
      {employeeLocations.length > 0 && officeLocation && (
        <Polyline
          positions={[...employeeLocations.map(e => e.coordinates), officeLocation]}
          color="green"
          weight={3}
          opacity={0.5}
        />
      )}
    </>
  )
}

const DashboardPage = () => {
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('driverOnlineStatus')
    return saved ? JSON.parse(saved) : false
  })
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef(null)
  const { activeBatch, fetchPendingBatch, setActiveBatch, isLoadingBatch, batchError } = useRide()
  const pollingIntervalRef = useRef(null)
  
  // Get real location from localStorage or use default
  const storedLocation = localStorage.getItem('driverLocation')
  
  // Memoize position to prevent unnecessary recalculations
  const position = useMemo(() => {
    if (storedLocation) {
      try {
        const { latitude, longitude } = JSON.parse(storedLocation)
        return [latitude, longitude]
      } catch (error) {
        console.error('Error parsing stored location:', error)
        return [28.6280, 77.3649]
      }
    }
    return [28.6280, 77.3649]
  }, [storedLocation])

  useEffect(() => {
    localStorage.setItem('driverOnlineStatus', JSON.stringify(isOnline))
  }, [isOnline])

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const handleLogout = async () => {
    try {
      await logoutDriver()
      navigate('/signin')
    } catch (error) {
      console.error('Logout failed:', error)
      localStorage.removeItem('driverToken')
      localStorage.removeItem('driver')
      navigate('/signin')
    }
  }

  // Start polling when driver goes online
  useEffect(() => {
    if (!isOnline) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        console.log('🔴 Driver Offline - Stopped polling')
      }
      return
    }

    if (!storedLocation) {
      setIsOnline(false)
      return
    }

    console.log('🟢 Driver Online - Starting batch polling every 5 seconds...')
    
    fetchPendingBatch(position[0], position[1])

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      console.log('📡 Polling for batches...')
      fetchPendingBatch(position[0], position[1])
    }, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [isOnline, storedLocation, position, fetchPendingBatch])

  // Navigate to batch request when a batch is available
  useEffect(() => {
    if (activeBatch) {
      console.log('🎯 Batch available, navigating to batch request page')
      navigate('/batch-request')
    }
  }, [activeBatch, navigate])

  // Extract route points from batch
  const routePoints = useMemo(() => {
    if (!activeBatch?.route_polyline?.coordinates) return null

    return activeBatch.route_polyline.coordinates.map(([lng, lat]) => [lat, lng])
  }, [activeBatch])

  // Extract employee locations
  const employeeLocations = useMemo(() => {
    if (!activeBatch?.rides) return []

    return activeBatch.rides.map((ride, index) => ({
      index: index + 1,
      name: activeBatch.employee_ids?.[index]?.name || `Employee ${index + 1}`,
      email: activeBatch.employee_ids?.[index]?.email || '',
      phone: activeBatch.employee_ids?.[index]?.phone_number || '',
      coordinates: [ride.pickup_location.coordinates[1], ride.pickup_location.coordinates[0]], // [lat, lng]
      pickup_order: ride.pickup_order || index + 1
    }))
  }, [activeBatch])

  // Get office location
  const officeLocation = useMemo(() => {
    if (!activeBatch?.office_id?.office_location?.coordinates) return null
    const [lng, lat] = activeBatch.office_id.office_location.coordinates
    return [lat, lng]
  }, [activeBatch])

  return (
    <div className="relative h-screen flex flex-col bg-[#f0f0f5] animate-fade-in">
      <div className="absolute inset-0 z-[1] w-full h-full">
        <MapContainer className="w-full h-full" center={position} zoom={13} scrollWheelZoom={true} zoomControl={false}>
          <MapContent 
            position={position}
            isOnline={isOnline}
            activeBatch={activeBatch}
            employeeLocations={employeeLocations}
            officeLocation={officeLocation}
            routePoints={routePoints}
          />
        </MapContainer>
        
        <div className="absolute inset-0 bg-white/10 pointer-events-none z-[2]"></div>
        
        {/* Custom Driver UI overlap on map */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-primary/20 rounded-full animate-pulse-custom"></div>
          <div className="w-10 h-10 bg-primary rounded-full flex justify-center items-center border-[3px] border-primary/40 rotate-45">
            <Navigation size={20} fill="white" color="white" />
          </div>
        </div>
      </div>

      <div className="relative z-[10] flex justify-between items-center pt-10 container">
        <div className="user-profile relative" ref={profileMenuRef}>
          <div 
            className="w-11 h-11 bg-white rounded-xl flex justify-center items-center shadow-[0_4px_10px_rgba(0,0,0,0.1)] cursor-pointer hover:shadow-[0_6px_15px_rgba(0,0,0,0.15)] transition-all"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <User size={24} />
          </div>

          {showProfileMenu && (
            <div className="absolute top-14 left-0 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] py-2 min-w-[150px] z-[20]">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 transition-all text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>

        <div 
          className={`flex items-center gap-3 p-[6px_6px_6px_16px] ${isOnline ? 'bg-primary' : 'bg-[#666]'} text-white rounded-[30px] font-bold cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all`} 
          onClick={() => {
            if (!storedLocation) {
              alert('Please enable location access first')
              navigate('/location')
            } else {
              setIsOnline(!isOnline)
            }
          }}
        >
          <span>{isOnline ? 'Online' : 'Offline'}</span>
          <div className="w-7 h-7 bg-black rounded-full border-2 border-white"></div>
        </div>
      </div>

      <div className="relative z-[10] flex gap-4 mt-5 container">
        <div className="flex-1 bg-white p-4 rounded-2xl flex items-center gap-3 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
          <div className="w-10 h-10 rounded-full flex justify-center items-center bg-[#fff7ed] text-primary">
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <p className="text-[12px] text-[var(--text-muted)] mb-0.5">Batch Riders</p>
            <p className="text-base font-extrabold">{employeeLocations.length}</p>
          </div>
        </div>

        <div className="flex-1 bg-white p-4 rounded-2xl flex items-center gap-3 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
          <div className="w-10 h-10 rounded-full flex justify-center items-center bg-[#fff7ed] text-primary">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <p className="text-[12px] text-[var(--text-muted)] mb-0.5">Today Earned</p>
            <p className="text-base font-extrabold">$754.00</p>
          </div>
        </div>
      </div>

      {isOnline && (
        <div className="absolute bottom-0 left-0 w-full z-[10] pb-10 container">
          <div className="text-center py-4 bg-primary/10 rounded-lg mb-4">
            <p className="text-sm font-bold text-primary animate-pulse">
              {isLoadingBatch ? '🔄 Checking for batches nearby...' : '✅ Waiting for batch requests...'}
            </p>
            {batchError && (
              <p className="text-xs text-red-600 mt-1">Error: {batchError}</p>
            )}
            {employeeLocations.length > 0 && (
              <div className="mt-3 bg-white/50 p-2 rounded text-xs">
                <p className="font-semibold">📍 Route: {employeeLocations.map(e => e.name).join(' → ')} → Office</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!storedLocation && (
        <div className="absolute bottom-0 left-0 w-full z-[10] pb-10 container">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mb-4">
            <p className="text-sm font-bold text-yellow-800">
              ⚠️ Location access required to receive ride requests
            </p>
            <Button 
              className="mt-3 text-sm shadow-[0_10px_20px_rgba(242,148,0,0.3)]"
              onClick={() => navigate('/location')}
            >
              Enable Location
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
