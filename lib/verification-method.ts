export type DeliveryMethod = "text" | "email" | "call"

export function pendingLoginMethod(method: DeliveryMethod): "text" | "email" {
  return method === "email" ? "email" : "text"
}

export function verificationTypeLabel(method: DeliveryMethod): string {
  switch (method) {
    case "text":
      return "Text Message"
    case "email":
      return "Email"
    case "call":
      return "Phone Call"
    default: {
      const _never: never = method
      return _never
    }
  }
}

export function readStoredDeliveryMethod(): DeliveryMethod {
  if (typeof window === "undefined") return "text"
  const stored = sessionStorage.getItem("verificationMethod")
  if (stored === "text" || stored === "email" || stored === "call") return stored
  return "text"
}
