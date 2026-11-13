import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RoundStatus,
} from "./orders"

export interface DashboardOverview {
  generatedAt: string
  days: number
  money: boolean
  today: {
    sales: number | null
    payments: number
    orders: number
    averageTicket: number | null
    itemsSold: number
    taxTotal: number | null
  }
  period: {
    sales: number | null
    payments: number
    averageTicket: number | null
  }
  paymentsByMethod: {
    method: PaymentMethod
    total: number | null
    count: number
  }[]
  salesSeries: { date: string; sales: number | null; payments: number }[]
  topItems: { name: string; quantity: number; revenue: number | null }[]
  inventory: {
    lowStockCount: number
    alerts: {
      id: string
      name: string
      baseUnit: string
      displayUnit: string
      currentStock: number
      minStock: number
      deficit: number
    }[]
  }
  kitchen: {
    pending: number
    preparing: number
    ready: number
    delayed: number
    averagePrepMinutes: number | null
  }
  openOrders: { count: number; total: number | null }
  recentOrders: {
    id: string
    tableNumber: string | null
    isTakeaway: boolean
    status: OrderStatus
    total: number | null
    createdAt: string
    rounds: number
    user: string | null
    /** Sucursal de la cuenta; `null` si se creó antes de activar sucursales. */
    branch: string | null
  }[]
}

export interface SalesReport {
  from: string
  to: string
  totals: {
    sales: number
    payments: number
    orders: number
    averageTicket: number
  }
  byMethod: { method: PaymentMethod; total: number; count: number }[]
  byDay: { date: string; sales: number; count: number }[]
  byCashier: { name: string; total: number; count: number }[]
  topItems: { name: string; quantity: number; revenue: number }[]
}

export interface InventoryReport {
  from: string
  to: string
  movements: { type: string; count: number; quantity: number }[]
  consumption: {
    name: string
    displayUnit: string
    quantity: number
  }[]
  lowStock: {
    id: string
    name: string
    baseUnit: string
    displayUnit: string
    currentStock: number
    minStock: number
    deficit: number
  }[]
}

export interface KitchenReport {
  from: string
  to: string
  totals: {
    rounds: number
    averageWaitMinutes: number | null
    averagePrepMinutes: number | null
    averageDeliveryMinutes: number | null
    averageTotalMinutes: number | null
  }
  byStatus: { status: RoundStatus; count: number }[]
  byDay: { date: string; count: number }[]
}

/**
 * Reporte de operación del POS: tiempos de captura, fricción del catálogo y
 * consumo por cliente/mesa (con y sin IVA).
 */
export interface PosOperationsReport {
  from: string
  to: string
  capture: {
    samples: number
    sent: number
    abandoned: number
    switched: number
    activeMedianMs: number | null
    activeP90Ms: number | null
    wallMedianMs: number | null
    wallP90Ms: number | null
    browseMedianMs: number | null
    assemblyMedianMs: number | null
    averageItems: number | null
    averageLines: number | null
    averageInteractions: number | null
    averageGuests: number | null
    itemsPerMinute: number | null
    searches: number
    emptySearches: number
    emptySearchRate: number | null
    itemDialogs: number
    validationErrors: number
    byDay: {
      date: string
      samples: number
      activeMedianMs: number | null
    }[]
  }
  friction: {
    opened: number
    added: number
    cancelled: number
    cancelRate: number | null
    validationErrors: number
    emptySearches: number
    topEmptySearches: { query: string; count: number }[]
  }
  guests: {
    orders: number
    ordersWithGuests: number
    seats: number
    guestsWithItems: number
    lines: number
    guestLines: number
    assignedLineShare: number | null
    assignedAmountShare: number | null
    averageGrossPerGuest: number | null
    averageNetPerGuest: number | null
    averageGrossPerSeat: number | null
    averageNetPerSeat: number | null
    totalGross: number
    totalNet: number
    guestGross: number
    guestNet: number
    generalGross: number
    generalNet: number
  }
  data: {
    firstCaptureAt: string | null
    days: number
    autoAfterDays: number
    autoEnabled: boolean
    samples: number
  }
}

export interface PaymentRow {
  id: string
  method: PaymentMethod
  amount: string
  status: PaymentStatus
  paidAt: string | null
  confirmedAt: string | null
  createdAt: string
  order: {
    id: string
    tableNumber: string | null
    isTakeaway: boolean
    status: OrderStatus
    total: string
  }
  user: { id: string; name: string | null; username: string | null } | null
  confirmedBy: { id: string; name: string | null; username: string | null } | null
}

export interface CashSummary {
  items: PaymentRow[]
  totals: {
    count: number
    confirmed: number
    byMethod: { method: PaymentMethod; total: number; count: number }[]
    byStatus: { status: PaymentStatus; total: number; count: number }[]
  }
}
