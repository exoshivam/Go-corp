import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getPendingBatches } from '../services/rideAPI'

const RideContext = createContext()

export const RideProvider = ({ children }) => {
  const [activeBatch, setActiveBatch] = useState(null)
  const [isLoadingBatch, setIsLoadingBatch] = useState(false)
  const [batchError, setBatchError] = useState(null)
  const [declinedBatchIds, setDeclinedBatchIds] = useState(() => {
    // Load declined batches from localStorage
    const saved = localStorage.getItem('declinedBatchIds')
    return saved ? JSON.parse(saved) : []
  })

  // Persist declined batches to localStorage
  useEffect(() => {
    localStorage.setItem('declinedBatchIds', JSON.stringify(declinedBatchIds))
  }, [declinedBatchIds])

  const fetchPendingBatch = useCallback(async (latitude, longitude) => {
    try {
      setIsLoadingBatch(true)
      setBatchError(null)
      
      if (!latitude || !longitude) {
        throw new Error('Driver location is required')
      }
      
      let batch = await getPendingBatches(latitude, longitude)
      
      // Skip declined batches
      if (batch && declinedBatchIds.includes(batch._id)) {
        console.log(`⏭️ Skipping declined batch: ${batch._id}`)
        batch = null
      }
      
      if (batch) {
        setActiveBatch(batch)
        return batch
      } else {
        setActiveBatch(null)
        return null
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error) || 'Failed to fetch batch'
      console.error('Batch fetch error:', errorMsg, error)
      setBatchError(errorMsg)
      setActiveBatch(null)
      return null
    } finally {
      setIsLoadingBatch(false)
    }
  }, [declinedBatchIds])

  const clearActiveBatch = useCallback(() => {
    setActiveBatch(null)
    setBatchError(null)
  }, [])

  const declineBatch = useCallback((batchId) => {
    if (batchId) {
      console.log(`❌ Declining batch: ${batchId}`)
      setDeclinedBatchIds(prev => {
        if (!prev.includes(batchId)) {
          return [...prev, batchId]
        }
        return prev
      })
      clearActiveBatch()
    }
  }, [clearActiveBatch])

  const clearDeclinedBatches = useCallback(() => {
    console.log('🔄 Clearing all declined batches')
    setDeclinedBatchIds([])
    localStorage.removeItem('declinedBatchIds')
  }, [])

  const value = {
    activeBatch,
    isLoadingBatch,
    batchError,
    fetchPendingBatch,
    clearActiveBatch,
    setActiveBatch,
    declineBatch,
    declinedBatchIds,
    clearDeclinedBatches
  }

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  )
}

export const useRide = () => {
  const context = useContext(RideContext)
  if (!context) {
    throw new Error('useRide must be used within RideProvider')
  }
  return context
}
