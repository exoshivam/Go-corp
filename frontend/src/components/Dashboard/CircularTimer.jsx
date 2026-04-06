import React, { useState, useEffect } from 'react'

const CircularTimer = ({ initialTime = 30, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime)
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (timeLeft / initialTime) * circumference

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onComplete) onComplete()
      return
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, onComplete])

  return (
    <div className="relative flex items-center justify-center w-32 h-32 bg-white rounded-full shadow-lg">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="#f3f4f6"
          strokeWidth="6"
          fill="transparent"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="#F29400"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl">⏳</span>
        <span className="text-3xl font-extrabold text-gray-800">{timeLeft}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Seconds</span>
      </div>
    </div>
  )
}

export default CircularTimer
