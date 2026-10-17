import type { FloorTable, MenuItem, Order, OrderStatus, TableStatus, Variation, OrderItem, PaymentMethod, OrderType } from './schema'

const TAX_RATE = 0.08

const DAY = 24 * 60 * 60 * 1000

function startOfDay(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return new Date(date.getTime() - offsetDays * DAY)
}

function createInitialTables(): FloorTable[] {
  const now = new Date()
  return [
    { id: 1, name: 'Table 1', seats: 2, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 2, name: 'Table 2', seats: 4, zone: 'Main Floor', status: 'occupied', guestCount: 3, occupiedSince: new Date(Date.now() - 25 * 60000), updatedAt: now },
    { id: 3, name: 'Table 3', seats: 4, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 4, name: 'Table 4', seats: 2, zone: 'Main Floor', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: now },
    { id: 5, name: 'Table 5', seats: 6, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 6, name: 'Table 6', seats: 4, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 7, name: 'Table 7', seats: 4, zone: 'Patio', status: 'occupied', guestCount: 4, occupiedSince: new Date(Date.now() - 40 * 60000), updatedAt: now },
    { id: 8, name: 'Table 8', seats: 2, zone: 'Patio', status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 9, name: 'Table 9', seats: 4, zone: 'Patio', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 10, name: 'Table 10', seats: 2, zone: 'Patio', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 11, name: 'Table 11', seats: 2, zone: 'Patio', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: now },
    { id: 12, name: 'Table 12', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 13, name: 'Table 13', seats: 1, zone: 'Coffee Bar', status: 'occupied', guestCount: 1, occupiedSince: new Date(Date.now() - 10 * 60000), updatedAt: now },
    { id: 14, name: 'Table 14', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
    { id: 15, name: 'Table 15', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now },
  ]
}

function createInitialMenuItems(): MenuItem[] {
  const now = new Date()
  return [
    {
      id: 1,
      name: 'Cà phê Muối Đặc Biệt',
      category: 'Cà phê',
      kind: 'menu',
      stockQty: 85,
      unit: 'ly',
      lowStockThreshold: 20,
      costPrice: 15000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy thơm ngon.',
      variations: [{ name: 'Nóng', price: 0 }, { name: 'Đá', price: 0 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 2,
      name: 'Cà phê Latte Vani Mịn',
      category: 'Cà phê',
      kind: 'menu',
      stockQty: 45,
      unit: 'ly',
      lowStockThreshold: 15,
      costPrice: 18000,
      sellPrice: 55000,
      inStock: true,
      recipe: 'Double shot espresso, siro vani ngọt thanh và sữa tươi thanh trùng đánh bông mịn.',
      variations: [{ name: 'Sữa tươi', price: 0 }, { name: 'Sữa yến mạch', price: 10000 }, { name: 'Sữa hạnh nhân', price: 10000 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 3,
      name: 'Bạc Xỉu Sữa Tươi',
      category: 'Cà phê',
      kind: 'menu',
      stockQty: 32,
      unit: 'ly',
      lowStockThreshold: 10,
      costPrice: 16000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Nhiều sữa ít cà phê, béo ngậy thơm mát chuẩn vị Sài Gòn.',
      variations: [{ name: 'Nóng', price: 0 }, { name: 'Đá', price: 0 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 4,
      name: 'Cold Brew Cam Vàng',
      category: 'Cà phê ủ lạnh',
      kind: 'menu',
      stockQty: 28,
      unit: 'ly',
      lowStockThreshold: 10,
      costPrice: 20000,
      sellPrice: 55000,
      inStock: true,
      recipe: 'Cà phê ủ lạnh thanh mát kết hợp lát cam vàng mọng nước và mật ong hoa rừng.',
      variations: [{ name: 'Chuẩn vị', price: 0 }, { name: 'Ít ngọt', price: 0 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 5,
      name: 'Trà Đào Cam Sả',
      category: 'Trà & Bánh',
      kind: 'menu',
      stockQty: 24,
      unit: 'ly',
      lowStockThreshold: 10,
      costPrice: 18000,
      sellPrice: 50000,
      inStock: true,
      recipe: 'Trà đen thơm mát kết hợp miếng đào tươi giòn sần sật, sả đập dập và cam vàng.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 6,
      name: 'Cà phê Ủ Lạnh Nitro',
      category: 'Cà phê ủ lạnh',
      kind: 'menu',
      stockQty: 18,
      unit: 'ly',
      lowStockThreshold: 10,
      costPrice: 22000,
      sellPrice: 58000,
      inStock: true,
      recipe: 'Ủ lạnh 20 tiếng rót sục khí Nitơ tạo lớp bọt kem bồng bềnh mịn màng.',
      variations: [{ name: 'Tiêu chuẩn', price: 0 }, { name: 'Kem béo ngọt', price: 10000 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 7,
      name: 'Cà phê Trứng Hà Nội',
      category: 'Cà phê',
      kind: 'menu',
      stockQty: 22,
      unit: 'ly',
      lowStockThreshold: 10,
      costPrice: 25000,
      sellPrice: 60000,
      inStock: true,
      recipe: 'Kem trứng đánh bông mịn sánh quyện cùng cà phê nguyên chất đậm đà.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 8,
      name: 'Cà phê Pour Over Guji Ethiopia',
      category: 'Pha thủ công',
      kind: 'menu',
      stockQty: 14,
      unit: 'phần',
      lowStockThreshold: 5,
      costPrice: 28000,
      sellPrice: 65000,
      inStock: true,
      recipe: 'Pha thủ công V60, nốt hương hoa nhài hoang dã, đào chín và cam bergamot.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 9,
      name: 'Cà phê Geisha Tuyển Chọn',
      category: 'Pha thủ công',
      kind: 'menu',
      stockQty: 4,
      unit: 'phần',
      lowStockThreshold: 8,
      costPrice: 45000,
      sellPrice: 95000,
      inStock: true,
      recipe: 'Lô cà phê quý hiếm Panama Geisha. Hương hoa quả, bergamot và mật ngọt.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 10,
      name: 'Bánh Croissant Bơ Pháp',
      category: 'Bánh ngọt',
      kind: 'menu',
      stockQty: 5,
      unit: 'chiếc',
      lowStockThreshold: 8,
      costPrice: 20000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Bánh sừng bò bơ Pháp ngàn lớp nướng giòn rụm với hạnh nhân lát thơm béo.',
      variations: [{ name: 'Nóng ấm', price: 0 }, { name: 'Bình thường', price: 0 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 11,
      name: 'Bánh Pain au Chocolat Socola',
      category: 'Bánh ngọt',
      kind: 'menu',
      stockQty: 9,
      unit: 'chiếc',
      lowStockThreshold: 6,
      costPrice: 18000,
      sellPrice: 42000,
      inStock: true,
      recipe: 'Bánh pastry ngàn lớp bơ vàng giòn thơm cuộn hai thanh socola đen Valrhona.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 12,
      name: 'Bánh Chuối Óc Chó Thủ Công',
      category: 'Bánh ngọt',
      kind: 'menu',
      stockQty: 14,
      unit: 'lát',
      lowStockThreshold: 5,
      costPrice: 15000,
      sellPrice: 38000,
      inStock: true,
      recipe: 'Bánh chuối nướng mềm ẩm, giòn bùi hạt óc chó và phết bơ cà phê.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 13,
      name: 'Hạt Cà Phê Đà Lạt House Blend (250g)',
      category: 'Cà phê hạt',
      kind: 'menu',
      stockQty: 16,
      unit: 'gói',
      lowStockThreshold: 5,
      costPrice: 90000,
      sellPrice: 180000,
      inStock: true,
      recipe: 'Phối trộn Colombia & Ethiopia. Hương vị socola fudge, hạt phỉ và vỏ cam.',
      variations: [{ name: 'Nguyên hạt', price: 0 }, { name: 'Xay cho Pour Over', price: 0 }, { name: 'Xay cho Phin', price: 0 }],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 14,
      name: 'Sữa tươi thanh trùng nguyên kem',
      category: 'Nguyên liệu',
      kind: 'ingredient',
      stockQty: 6,
      unit: 'lít',
      lowStockThreshold: 10,
      costPrice: 38000,
      sellPrice: 0,
      inStock: true,
      recipe: null,
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 15,
      name: 'Sữa yến mạch chuyên pha chế Barista',
      category: 'Nguyên liệu',
      kind: 'ingredient',
      stockQty: 14,
      unit: 'hộp',
      lowStockThreshold: 8,
      costPrice: 45000,
      sellPrice: 0,
      inStock: true,
      recipe: null,
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 16,
      name: 'Siro Vani Madagascar',
      category: 'Siro & Gia vị',
      kind: 'ingredient',
      stockQty: 3,
      unit: 'chai',
      lowStockThreshold: 6,
      costPrice: 120000,
      sellPrice: 0,
      inStock: true,
      recipe: 'Đường mía nguyên chất kết hợp hạt vani tự nhiên vùng Madagascar.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 17,
      name: 'Siro Caramel Muối Biển',
      category: 'Siro & Gia vị',
      kind: 'ingredient',
      stockQty: 2,
      unit: 'chai',
      lowStockThreshold: 5,
      costPrice: 125000,
      sellPrice: 0,
      inStock: true,
      recipe: 'Đường caramel thủ công, kem béo tươi và muối biển nguyên chất.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
    {
      id: 18,
      name: 'Hạt Cà Phê Espresso Rang Mộc',
      category: 'Hạt cà phê',
      kind: 'ingredient',
      stockQty: 4,
      unit: 'kg',
      lowStockThreshold: 10,
      costPrice: 220000,
      sellPrice: 0,
      inStock: true,
      recipe: '70% Colombia sơ chế ướt, 30% Ethiopia Yirgacheffe tự nhiên.',
      variations: [],
      imageUrl: null,
      createdAt: now,
    },
  ]
}

function createInitialOrders(): Order[] {
  const orders: Order[] = []
  let nextId = 1

  const makeOrder = (
    codeNum: number,
    customer: string,
    tableId: number | null,
    orderType: OrderType,
    items: OrderItem[],
    paymentMethod: PaymentMethod,
    paymentStatus: 'paid' | 'unpaid' | 'refunded',
    status: OrderStatus,
    createdAt: Date,
    completedAt: Date | null,
  ): Order => {
    const subtotal = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
    const total = Math.round(subtotal * (1 + TAX_RATE) * 100) / 100
    return {
      id: nextId++,
      orderCode: `AC-${String(codeNum).padStart(4, '0')}`,
      customer,
      tableId,
      orderType,
      items,
      subtotal,
      total,
      paymentMethod,
      paymentStatus,
      status,
      createdAt,
      completedAt,
    }
  }

  const now = Date.now()

  // Active tickets for today (Kitchen Display & Floor Plan)
  orders.push(
    makeOrder(
      101,
      'Hoàng Thùy Linh',
      null,
      'pickup',
      [
        { name: 'Cà phê Latte Vani Mịn', qty: 1, price: 65000, variation: 'Sữa yến mạch' },
        { name: 'Bánh Croissant Bơ Pháp', qty: 1, price: 45000 },
      ],
      'card',
      'paid',
      'ready',
      new Date(now - 14 * 60000),
      null,
    ),
    makeOrder(
      102,
      'Lê Minh Tuấn',
      2,
      'dine-in',
      [
        { name: 'Cà phê Muối Đặc Biệt', qty: 2, price: 45000, variation: 'Đá' },
        { name: 'Bánh Pain au Chocolat Socola', qty: 2, price: 42000 },
      ],
      'qr',
      'paid',
      'brewing',
      new Date(now - 22 * 60000),
      null,
    ),
    makeOrder(
      103,
      'Trần Đức Anh',
      7,
      'dine-in',
      [
        { name: 'Cà phê Ủ Lạnh Nitro', qty: 2, price: 68000, variation: 'Kem béo ngọt' },
        { name: 'Bánh Chuối Óc Chó Thủ Công', qty: 1, price: 38000 },
      ],
      'card',
      'unpaid',
      'brewing',
      new Date(now - 35 * 60000),
      null,
    ),
    makeOrder(
      104,
      'Phạm Ngọc Mai',
      10,
      'dine-in',
      [{ name: 'Cà phê Pour Over Guji Ethiopia', qty: 1, price: 65000 }],
      'card',
      'paid',
      'ready',
      new Date(now - 8 * 60000),
      null,
    ),
    makeOrder(
      105,
      'Khách vãng lai',
      null,
      'pickup',
      [
        { name: 'Bạc Xỉu Sữa Tươi', qty: 1, price: 45000, variation: 'Đá' },
        { name: 'Cold Brew Cam Vàng', qty: 1, price: 55000 },
      ],
      'cash',
      'paid',
      'pending',
      new Date(now - 4 * 60000),
      null,
    ),
  )

  // Completed orders earlier today
  const todayMorning = startOfDay().getTime() + 8 * 3600000
  orders.push(
    makeOrder(
      96,
      'Nguyễn Văn Nam',
      null,
      'pickup',
      [{ name: 'Hạt Cà Phê Đà Lạt House Blend (250g)', qty: 1, price: 180000 }],
      'card',
      'paid',
      'completed',
      new Date(todayMorning + 30 * 60000),
      new Date(todayMorning + 35 * 60000),
    ),
    makeOrder(
      97,
      'Đặng Hải Yến',
      1,
      'dine-in',
      [
        { name: 'Cà phê Latte Vani Mịn', qty: 2, price: 55000 },
        { name: 'Bánh Croissant Bơ Pháp', qty: 2, price: 45000 },
      ],
      'qr',
      'paid',
      'completed',
      new Date(todayMorning + 75 * 60000),
      new Date(todayMorning + 84 * 60000),
    ),
    makeOrder(
      98,
      'Vũ Đình Trọng',
      3,
      'dine-in',
      [{ name: 'Trà Đào Cam Sả', qty: 1, price: 50000 }],
      'cash',
      'paid',
      'completed',
      new Date(todayMorning + 120 * 60000),
      new Date(todayMorning + 128 * 60000),
    ),
    makeOrder(
      99,
      'Nguyễn Bích Thủy',
      null,
      'delivery',
      [
        { name: 'Cà phê Ủ Lạnh Nitro', qty: 2, price: 58000 },
        { name: 'Bánh Pain au Chocolat Socola', qty: 1, price: 42000 },
      ],
      'card',
      'paid',
      'completed',
      new Date(todayMorning + 180 * 60000),
      new Date(todayMorning + 192 * 60000),
    ),
    makeOrder(
      100,
      'Khách vãng lai',
      5,
      'dine-in',
      [
        { name: 'Cold Brew Cam Vàng', qty: 3, price: 55000 },
        { name: 'Bánh Chuối Óc Chó Thủ Công', qty: 2, price: 38000 },
      ],
      'card',
      'paid',
      'completed',
      new Date(todayMorning + 220 * 60000),
      new Date(todayMorning + 231 * 60000),
    ),
  )

  // Orders for yesterday
  const yesterdayBase = startOfDay(1).getTime() + 8 * 3600000
  const yesterdayCustomers = ['Hoàng Thùy Linh', 'Lê Minh Tuấn', 'Phạm Ngọc Mai', 'Trần Đức Anh', 'Nguyễn Văn Nam', 'Đặng Hải Yến', 'Khách vãng lai']
  for (let i = 0; i < 9; i++) {
    const time = new Date(yesterdayBase + i * 45 * 60000)
    orders.push(
      makeOrder(
        80 + i,
        yesterdayCustomers[i % yesterdayCustomers.length],
        i % 3 === 0 ? (i % 6) + 1 : null,
        i % 3 === 0 ? 'dine-in' : 'pickup',
        [
          { name: 'Cà phê Latte Vani Mịn', qty: 1, price: 55000 },
          { name: 'Cà phê Muối Đặc Biệt', qty: 1, price: 45000 },
        ],
        i % 2 === 0 ? 'card' : 'cash',
        'paid',
        'completed',
        time,
        new Date(time.getTime() + 9 * 60000),
      ),
    )
  }

  // Orders for previous 5 days (days 2..6)
  for (let day = 2; day <= 6; day++) {
    const dayBase = startOfDay(day).getTime() + 9 * 3600000
    for (let j = 0; j < 7; j++) {
      const time = new Date(dayBase + j * 50 * 60000)
      orders.push(
        makeOrder(
          40 + day * 7 + j,
          yesterdayCustomers[(day + j) % yesterdayCustomers.length],
          null,
          'dine-in',
          [
            { name: 'Cold Brew Cam Vàng', qty: 1, price: 55000 },
            { name: 'Bánh Pain au Chocolat Socola', qty: 1, price: 42000 },
          ],
          j % 3 === 0 ? 'qr' : j % 2 === 0 ? 'card' : 'cash',
          'paid',
          'completed',
          time,
          new Date(time.getTime() + 8 * 60000),
        ),
      )
    }
  }

  return orders
}

export type MockReservation = {
  code: string
  customer: string
  contact: string
  email: string | null
  note: string | null
  dateTime: Date
  guests: number
  tableId: number
  status: 'Chờ xác nhận'
}

type StoreState = {
  tables: FloorTable[]
  menuItems: MenuItem[]
  orders: Order[]
  reservations?: MockReservation[]
}

const globalForMock = globalThis as unknown as { __daLatCafeStore?: StoreState }

function getStore(): StoreState {
  if (!globalForMock.__daLatCafeStore) {
    globalForMock.__daLatCafeStore = {
      tables: createInitialTables(),
      menuItems: createInitialMenuItems(),
      orders: createInitialOrders(),
    }
  }
  return globalForMock.__daLatCafeStore
}

export function getMockMenuItems(): MenuItem[] {
  const store = getStore()
  return [...store.menuItems].sort((a, b) => {
    const cat = a.category.localeCompare(b.category)
    return cat !== 0 ? cat : a.name.localeCompare(b.name)
  })
}

export function getMockTables(): FloorTable[] {
  const store = getStore()
  return [...store.tables].sort((a, b) => a.id - b.id)
}

export function getMockActiveOrders(): Order[] {
  const store = getStore()
  return store.orders
    .filter((order) => order.status !== 'completed')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function getMockOrdersSince(days: number): Order[] {
  const store = getStore()
  const cutoff = startOfDay(days).getTime()
  return store.orders
    .filter((order) => order.createdAt.getTime() >= cutoff)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function updateMockOrderStatus(orderId: number, status: OrderStatus): { ok: boolean; error?: string } {
  const store = getStore()
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, error: 'Order not found.' }
  order.status = status
  order.completedAt = status === 'completed' ? new Date() : null
  return { ok: true }
}

export function markMockOrderPaid(orderId: number): { ok: boolean; error?: string } {
  const store = getStore()
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, error: 'Order not found.' }
  order.paymentStatus = 'paid'
  return { ok: true }
}

export function updateMockTableStatus(tableId: number, status: TableStatus, guestCount = 0): { ok: boolean; error?: string } {
  const store = getStore()
  const table = store.tables.find((t) => t.id === tableId)
  if (!table) return { ok: false, error: 'Table not found.' }
  table.status = status
  table.guestCount = status === 'occupied' ? Math.max(guestCount, 1) : 0
  table.occupiedSince = status === 'occupied' ? table.occupiedSince ?? new Date() : null
  table.updatedAt = new Date()
  return { ok: true }
}

export function setMockItemInStock(itemId: number, inStock: boolean): { ok: boolean; error?: string } {
  const store = getStore()
  const item = store.menuItems.find((m) => m.id === itemId)
  if (!item) return { ok: false, error: 'Item not found.' }
  item.inStock = inStock
  return { ok: true }
}

export type NewMockOrderInput = {
  lines: { menuItemId: number; qty: number; variation?: string }[]
  customer: string
  tableId: number | null
  orderType: OrderType
  paymentMethod: PaymentMethod
  paid: boolean
  // Set when the Java backend already issued the order code.
  orderCode?: string
}

export function createMockOrder(input: NewMockOrderInput): { ok: boolean; message?: string; error?: string } {
  const store = getStore()
  const byId = new Map(store.menuItems.map((item) => [item.id, item]))

  const items: OrderItem[] = []
  for (const line of input.lines) {
    const item = byId.get(line.menuItemId)
    if (!item || item.kind !== 'menu' || !item.inStock) {
      return { ok: false, error: 'One of the items is no longer available.' }
    }
    const variation = line.variation ? item.variations.find((v: Variation) => v.name === line.variation) : undefined
    items.push({
      name: item.name,
      qty: line.qty,
      price: item.sellPrice + (variation?.price ?? 0),
      variation: variation?.name,
    })
    // Deduct stock
    item.stockQty = Math.max(0, item.stockQty - line.qty)
  }

  const subtotal = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
  const total = Math.round(subtotal * (1 + TAX_RATE) * 100) / 100
  const nextId = store.orders.reduce((max, o) => Math.max(max, o.id), 0) + 1

  const newOrder: Order = {
    id: nextId,
    orderCode: input.orderCode ?? `AC-${String(nextId).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
    customer: input.customer.trim().slice(0, 60) || 'Walk-in',
    tableId: input.tableId,
    orderType: input.orderType,
    items,
    subtotal,
    total,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paid ? 'paid' : 'unpaid',
    status: 'pending',
    createdAt: new Date(),
    completedAt: null,
  }

  store.orders.unshift(newOrder)

  if (input.tableId) {
    const table = store.tables.find((t) => t.id === input.tableId)
    if (table) {
      table.status = 'occupied'
      table.occupiedSince = table.occupiedSince ?? new Date()
      table.updatedAt = new Date()
    }
  }

  return { ok: true, message: `Order sent to the bar for ${newOrder.customer}.` }
}

export type NewMockReservationInput = Omit<MockReservation, 'code' | 'status'>

// Local stand-in for POST /api/reservations while the Java backend is offline.
// Only the checks that need no backend state run here; the full Chain of Responsibility lives in Java.
export function createMockReservation(input: NewMockReservationInput): { ok: boolean; code?: string; error?: string } {
  const store = getStore()
  const table = store.tables.find((t) => t.id === input.tableId)
  if (!table) return { ok: false, error: 'Table not found.' }
  if (input.guests > table.seats) return { ok: false, error: `${table.name} seats at most ${table.seats} guests.` }

  const reservations = (store.reservations ??= [])
  // The L marks a local booking so it is never mistaken for a backend-issued RES-0001.
  const code = `RES-L${String(reservations.length + 1).padStart(4, '0')}`
  reservations.push({ ...input, code, status: 'Chờ xác nhận' })
  return { ok: true, code }
}

export function getMockReservations(): MockReservation[] {
  return [...(getStore().reservations ?? [])]
}

export type NewMockItemInput = {
  name: string
  category: string
  kind: 'menu' | 'ingredient'
  stockQty: number
  unit: string
  lowStockThreshold: number
  costPrice: number
  sellPrice: number
  recipe: string
  imageUrl: string
  variations: Variation[]
}

export function createMockMenuItem(input: NewMockItemInput): { ok: boolean; message?: string; error?: string } {
  const store = getStore()
  const nextId = store.menuItems.reduce((max, m) => Math.max(max, m.id), 0) + 1
  const newItem: MenuItem = {
    id: nextId,
    name: input.name,
    category: input.category,
    kind: input.kind,
    stockQty: input.stockQty,
    unit: input.unit || 'pcs',
    lowStockThreshold: input.lowStockThreshold,
    costPrice: input.costPrice,
    sellPrice: input.sellPrice,
    inStock: input.stockQty > 0,
    recipe: input.recipe || null,
    variations: input.variations,
    imageUrl: input.imageUrl || null,
    createdAt: new Date(),
  }
  store.menuItems.push(newItem)
  return { ok: true, message: `${newItem.name} added.` }
}

