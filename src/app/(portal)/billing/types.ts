// tipos compartidos para Billing
export type Org = { id: string; name: string }

export type CountRow = {
  tenantId: string
  tenantName: string
  users: number
  clients: number
  admins: number
  providers: number
  management?: { status: string; date: string }
  error?: string
}