export const LOADING_MS = {
  landingOption: 1000,
  next: 2000,
  verify: 2000,
  verifyMethodNext: 10000,
  otpVerify: 2000,
} as const

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
