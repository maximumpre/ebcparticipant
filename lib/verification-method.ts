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

export function otpCodeDeliveryMessage(method: DeliveryMethod): string {
  switch (method) {
    case "email":
      return "We sent a message to j***@example.com. Enter the code from the message."
    case "call":
    case "text":
      return "We sent a message to (470)955-9382. Enter the code from the message."
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
