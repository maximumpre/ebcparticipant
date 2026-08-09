export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
export const CURRENT_YEAR = new Date().getFullYear()
export const YEARS = Array.from({ length: 96 }, (_, i) => CURRENT_YEAR - i)
