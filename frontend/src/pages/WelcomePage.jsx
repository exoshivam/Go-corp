import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

const WelcomePage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen relative animate-fade-in">
      <div className="flex-[1.2] relative bg-[#f5f5f5] flex justify-center items-end overflow-hidden">
        <img 
          src="/Whisk_a7a335ac5aa841bb4ff469cef311c9d2dr.jpeg" 
          alt="Driver Welcome" 
          className="w-full h-full object-cover object-top"
        />
        {/* Decorative Floating Icons (Simulating the UI) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-10 h-10 bg-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.1)] flex justify-center items-center top-[20%] left-[10%]"><span className="w-3 h-3 rounded-full bg-primary"></span></div>
          <div className="absolute w-10 h-10 bg-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.1)] flex justify-center items-center top-[20%] right-[10%]"><span className="w-3 h-3 rounded-full bg-primary"></span></div>
          <div className="absolute w-10 h-10 bg-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.1)] flex justify-center items-center top-[40%] left-[5%]"><span className="w-3 h-3 rounded-full bg-primary"></span></div>
          <div className="absolute w-10 h-10 bg-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.1)] flex justify-center items-center top-[40%] right-[5%]"><span className="w-3 h-3 rounded-full bg-primary"></span></div>
        </div>
      </div>

      <div className="flex-1 relative bg-white -mt-10 rounded-t-[40px] z-[2] flex flex-col">
        <div className="text-center pt-10 container">
          <h1 className="text-[28px] leading-[1.2] mb-4 font-extrabold">
            <span className="text-primary">Earn Money</span> With This Driver App
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-8 px-2.5">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          
          <Button onClick={() => navigate('/signup')}>
            Let's Get Started
          </Button>

          <p className="mt-6 text-sm text-[var(--text-muted)]">
            Already have an account? <span className="text-primary font-bold cursor-pointer underline" onClick={() => navigate('/signin')}>Sign In</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
