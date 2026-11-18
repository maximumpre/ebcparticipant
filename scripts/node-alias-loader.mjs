export function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    const target = new URL("./next-server-mock.mjs", import.meta.url).href
    return nextResolve(target, context)
  }
  if (specifier.startsWith("@/lib/")) {
    const target = new URL(
      "../lib/" + specifier.slice(6) + (specifier.endsWith(".ts") ? "" : ".ts"),
      import.meta.url,
    ).href
    return nextResolve(target, context)
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.endsWith(".ts") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".json") &&
    !specifier.endsWith(".mjs")
  ) {
    try {
      const parent = context.parentURL ? new URL(context.parentURL) : import.meta.url
      const target = new URL(specifier + ".ts", parent).href
      return nextResolve(target, context)
    } catch {
      // ignore
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: "json" },
    })
  }
  return nextLoad(url, context)
}
