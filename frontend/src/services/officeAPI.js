import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const officeAPI = axios.create({
  baseURL: `${API_BASE_URL}/office`,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const getAllOffices = async () => {
  try {
    const response = await officeAPI.get('/all')
    return response.data.data
  } catch (error) {
    throw error.response?.data || error.message
  }
}

export default officeAPI
