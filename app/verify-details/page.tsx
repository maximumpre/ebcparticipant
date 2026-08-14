"use client"

import { useEffect } from "react"

export default function SecondaryFlowRedirect() {
  useEffect(() => {
    window.location.href = "/api/login-out"
  }, [])
  return null
}
