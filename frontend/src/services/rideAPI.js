import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const rideAPI = axios.create({
  baseURL: `${API_BASE_URL}/ride`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests if it exists
rideAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('driverToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle response errors
rideAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('driverToken')
      localStorage.removeItem('driver')
      // Don't redirect for ride polling - it's not critical
    }
    return Promise.reject(error)
  }
)

export const getPendingRides = async (latitude, longitude) => {
  try {
    if (!latitude || !longitude) {
      throw new Error('Driver location is required')
    }
    
    const response = await rideAPI.get('/pending-rides', {
      params: {
        latitude,
        longitude
      }
    })
    if (response.data && response.data.data) {
      return response.data.data
    }
    return null
  } catch (error) {
    console.error('Error fetching rides:', error)
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch ride'
    throw new Error(errorMessage)
  }
}

export const getPendingBatches = async (latitude, longitude) => {
  try {
    if (!latitude || !longitude) {
      throw new Error('Driver location is required')
    }
    
    const response = await rideAPI.get('/pending-batches', {
      params: {
        latitude,
        longitude
      }
    })
    if (response.data && response.data.data) {
      return response.data.data
    }
    return null
  } catch (error) {
    console.error('Error fetching batches:', error)
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch batch'
    throw new Error(errorMessage)
  }
}

export const acceptRide = async (rideId) => {
  try {
    const response = await rideAPI.post(`/accept-ride/${rideId}`)
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export const declineRide = async (rideId, reason = '') => {
  try {
    const response = await rideAPI.post(`/decline-ride/${rideId}`, { reason })
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export default rideAPI
