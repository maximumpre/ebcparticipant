"use client"

import { useEffect, useState } from "react"

interface PreloaderProps {
  onComplete: () => void
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    
    const timer = setTimeout(() => {
      setShow(false)
      
      setTimeout(onComplete, 300)
    }, 1500) 

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ease-out">
      <div className="flex flex-col items-center justify-center">
        <img
          src="/loading_animation.gif"
          alt="Loading..."
          className="w-10 h-10"
        />
        <p className="text-gray-600 mt-2 text-sm">Hold on</p>
      </div>
    </div>
  )
}
