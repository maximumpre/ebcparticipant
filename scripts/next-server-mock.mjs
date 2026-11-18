export class NextResponse extends Response {
  constructor(body, init) {
    super(body, init)
    this._cookies = new Map()
    this.cookies = {
      set: (name, value, options) => {
        this._cookies.set(name, { value, options })
      },
      get: (name) => {
        return this._cookies.get(name)
      },
      delete: (name) => {
        this._cookies.delete(name)
      },
    }
  }

  static json(data, init) {
    const body = JSON.stringify(data)
    const headers = new Headers(init?.headers)
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
    return new NextResponse(body, { ...init, headers })
  }

  static redirect(url, init) {
    const status = typeof init === "number" ? init : (init?.status || 307)
    const headers = new Headers(init?.headers)
    headers.set("Location", url.toString())
    return new NextResponse(null, { ...init, status, headers })
  }

  static next(init) {
    return new NextResponse(null, init)
  }
}

