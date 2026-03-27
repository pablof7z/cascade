export type ApiRequest = {
  query: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status(code: number): ApiResponse
  setHeader(name: string, value: string): void
  send(body: string): void
}

export function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.send(JSON.stringify(data))
}

export function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function readNumber(value: string | string[] | undefined) {
  const raw = readString(value)
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}
