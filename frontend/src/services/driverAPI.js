import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const driverAPI = axios.create({
  baseURL: `${API_BASE_URL}/driver`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests if it exists
driverAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('driverToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle response errors
driverAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('driverToken')
      localStorage.removeItem('driver')
      window.location.href = '/signin'
    }
    return Promise.reject(error)
  }
)

export const signupDriver = async (driverData) => {
  try {
    const response = await driverAPI.post('/add-driver', driverData)
    if (response.data.data.token) {
      localStorage.setItem('driverToken', response.data.data.token)
      localStorage.setItem('driver', JSON.stringify(response.data.data.driver))
    }
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export const loginDriver = async (email, password) => {
  try {
    const response = await driverAPI.post('/login', { email, password })
    if (response.data.data.token) {
      localStorage.setItem('driverToken', response.data.data.token)
      localStorage.setItem('driver', JSON.stringify(response.data.data.driver))
    }
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export const getDriverProfile = async () => {
  try {
    const response = await driverAPI.get('/profile')
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export const logoutDriver = async () => {
  try {
    await driverAPI.get('/logout')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    localStorage.removeItem('driverToken')
    localStorage.removeItem('driver')
  }
}

export default driverAPI
