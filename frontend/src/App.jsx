import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { DriverAuthProvider } from './context/DriverAuthContext'
import { RideProvider } from './context/RideContext'
import WelcomePage from './pages/WelcomePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import LocationAccessPage from './pages/LocationAccessPage'
import DashboardPage from './pages/DashboardPage'
import RideRequestPage from './pages/RideRequestPage'
import BatchRequestPage from './pages/BatchRequestPage'
import CustomerLocationPage from './pages/CustomerLocationPage'
import ArrivedPage from './pages/ArrivedPage'
import OTPVerificationPage from './pages/OTPVerificationPage'
import DestinationPage from './pages/DestinationPage'
import CompleteRidePage from './pages/CompleteRidePage'

function App() {
  return (
    <DriverAuthProvider>
      <RideProvider>
        <div>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/location" element={<LocationAccessPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ride-request" element={<RideRequestPage />} />
            <Route path="/batch-request" element={<BatchRequestPage />} />
            <Route path="/customer-location" element={<CustomerLocationPage />} />
            <Route path="/arrived" element={<ArrivedPage />} />
            <Route path="/otp-verification" element={<OTPVerificationPage />} />
            <Route path="/destination" element={<DestinationPage />} />
            <Route path="/complete-ride" element={<CompleteRidePage />} />
          </Routes>
        </div>
      </RideProvider>
    </DriverAuthProvider>
  )
}

export default App
