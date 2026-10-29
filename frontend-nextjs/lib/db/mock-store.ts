import type { FloorTable, MenuItem, Order, OrderStatus, TableStatus, Variation, OrderItem, PaymentMethod, OrderType } from './schema'
import { shippingFee } from '../storefront/delivery'
import { orderTransitionError } from '../orders/lifecycle'
import { DEFAULT_BRANCH_ID, type BranchId } from '../branches'
import { customizationSurcharge, describeCustomizations, type PosCustomization } from '../admin/customizations'
import {
  DEFAULT_CLOSING_TIME,
  DEFAULT_MAX_RESERVATION_GUESTS,
  DEFAULT_OPENING_TIME,
  hasReservationTimePassed,
  hasReservationStarted,
  isWithinDefaultOperatingHours,
  defaultReservationEnd,
  reservationEnd,
  reservationRangeError,
  reservationRangesOverlap,
  RESERVATION_DEFAULT_LENGTH_MS,
  RESERVATION_NO_SHOW_GRACE_MS,
} from '../reservation-rules'

const TAX_RATE = 0.08

const DAY = 24 * 60 * 60 * 1000

function startOfDay(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return new Date(date.getTime() - offsetDays * DAY)
}

function createInitialTables(): FloorTable[] {
  const now = new Date()
  const firstBranch: Omit<FloorTable, 'branch'>[] = [
    { id: 1, name: 'Table 1', seats: 2, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1554118811-1e0d58224f24.jpg' },
    { id: 2, name: 'Table 2', seats: 4, zone: 'Main Floor', status: 'occupied', guestCount: 3, occupiedSince: new Date(Date.now() - 25 * 60000), updatedAt: now, imageUrl: '/images/catalog/photo-1521017432531-fbd92d768814.jpg' },
    { id: 3, name: 'Table 3', seats: 4, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1442512595331-e89e73853f31.jpg' },
    { id: 4, name: 'Table 4', seats: 2, zone: 'Main Floor', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1559925393-8be0ec4767c8.jpg' },
    { id: 5, name: 'Table 5', seats: 6, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1600093463592-8e36ae95ef56.jpg' },
    { id: 6, name: 'Table 6', seats: 4, zone: 'Main Floor', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1511920170033-f8396924c348.jpg' },
    { id: 7, name: 'Table 7', seats: 4, zone: 'Patio', status: 'occupied', guestCount: 4, occupiedSince: new Date(Date.now() - 40 * 60000), updatedAt: now, imageUrl: '/images/catalog/photo-1517248135467-4c7edcad34c4.jpg' },
    { id: 8, name: 'Table 8', seats: 2, zone: 'Patio', status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1525610553991-2bede1a236e2.jpg' },
    { id: 9, name: 'Table 9', seats: 4, zone: 'Patio', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1501339847302-ac426a4a7cbb.jpg' },
    { id: 10, name: 'Table 10', seats: 2, zone: 'Patio', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1508766917616-d22f3f1eea14.jpg' },
    { id: 11, name: 'Table 11', seats: 2, zone: 'Patio', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1447933601403-0c6688de566e.jpg' },
    { id: 12, name: 'Table 12', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1501386761578-eac5c94b800a.jpg' },
    { id: 13, name: 'Table 13', seats: 1, zone: 'Coffee Bar', status: 'occupied', guestCount: 1, occupiedSince: new Date(Date.now() - 10 * 60000), updatedAt: now, imageUrl: '/images/space/counter.jpg' },
    { id: 14, name: 'Table 14', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1498804103079-a6351b050096.jpg' },
    { id: 15, name: 'Table 15', seats: 1, zone: 'Coffee Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now, imageUrl: '/images/catalog/photo-1495474472287-4d71bcdd2085.jpg' },
  ]
  // 456 Bùi Thị Xuân: cùng sơ đồ bàn mà dữ liệu mẫu bên Java tạo cho chi nhánh đó
  // (InMemoryDatabase.branchTwoTables).
  const secondBranchImages = [
    '/images/catalog/photo-1517248135467-4c7edcad34c4.jpg',
    '/images/catalog/photo-1525610553991-2bede1a236e2.jpg',
    '/images/catalog/photo-1501339847302-ac426a4a7cbb.jpg',
    '/images/catalog/photo-1508766917616-d22f3f1eea14.jpg',
    '/images/catalog/photo-1497636577773-f1231844b336.jpg',
    '/images/catalog/photo-1521017432531-fbd92d768814.jpg',
    '/images/catalog/photo-1495474472287-4d71bcdd2085.jpg',
    '/images/catalog/photo-1554118811-1e0d58224f24.jpg',
  ]
  const secondBranch: Omit<FloorTable, 'branch'>[] = [
    ['Bàn 01', 2, 'Sân vườn'], ['Bàn 02', 4, 'Sân vườn'], ['Bàn 03', 4, 'Sân vườn'], ['Bàn 04', 6, 'Sân vườn'],
    ['Bàn 05', 2, 'Góc làm việc'], ['Bàn 06', 2, 'Góc làm việc'], ['Bàn 07', 4, 'Tầng 2'], ['Bàn 08', 4, 'Tầng 2'],
  ].map(([name, seats, zone], index) => ({
    id: 16 + index, name: name as string, seats: seats as number, zone: zone as string,
    status: 'available', guestCount: 0, occupiedSince: null, updatedAt: now,
    imageUrl: secondBranchImages[index],
  }))
  return [
    ...firstBranch.map((table) => ({ ...table, branch: DEFAULT_BRANCH_ID })),
    ...secondBranch.map((table) => ({ ...table, branch: 'bui-thi-xuan' as const })),
  ]
}

// Bàn quyết định chi nhánh của đơn và phiếu đặt trên bàn đó.
function branchOfTable(tables: FloorTable[], tableId: number | null | undefined): BranchId | undefined {
  return tableId == null ? undefined : tables.find((table) => table.id === tableId)?.branch
}

function createInitialMenuItems(): MenuItem[] {
  const now = new Date()
  return [
    {
      id: 1,
      name: 'Cà phê Muối Đặc Biệt',
      category: 'Cà phê',
      kind: 'menu',
      unit: 'ly',
      costPrice: 15000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy thơm ngon.',
      variations: [{ name: 'Nóng', price: 0 }, { name: 'Đá', price: 0 }],
      imageUrl: '/images/catalog/photo-1514432324607-a09d9b4aefdd.jpg',
      createdAt: now,
    },
    {
      id: 2,
      name: 'Cà phê Latte Vani Mịn',
      category: 'Cà phê',
      kind: 'menu',
      unit: 'ly',
      costPrice: 18000,
      sellPrice: 55000,
      inStock: true,
      recipe: 'Double shot espresso, siro vani ngọt thanh và sữa tươi thanh trùng đánh bông mịn.',
      variations: [{ name: 'Sữa tươi', price: 0 }, { name: 'Sữa yến mạch', price: 10000 }, { name: 'Sữa hạnh nhân', price: 10000 }],
      imageUrl: '/images/catalog/photo-1534778101976-62847782c213.jpg',
      createdAt: now,
    },
    {
      id: 3,
      name: 'Bạc Xỉu Sữa Tươi',
      category: 'Cà phê',
      kind: 'menu',
      unit: 'ly',
      costPrice: 16000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Nhiều sữa ít cà phê, béo ngậy thơm mát chuẩn vị Sài Gòn.',
      variations: [{ name: 'Nóng', price: 0 }, { name: 'Đá', price: 0 }],
      imageUrl: '/images/catalog/photo-1517256064527-09c73fc73e38.jpg',
      createdAt: now,
    },
    {
      id: 4,
      name: 'Cold Brew Cam Vàng',
      category: 'Cà phê ủ lạnh',
      kind: 'menu',
      unit: 'ly',
      costPrice: 20000,
      sellPrice: 55000,
      inStock: true,
      recipe: 'Cà phê ủ lạnh thanh mát kết hợp lát cam vàng mọng nước và mật ong hoa rừng.',
      variations: [{ name: 'Chuẩn vị', price: 0 }, { name: 'Ít ngọt', price: 0 }],
      imageUrl: '/images/catalog/photo-1517701550927-30cf4ba1dba5.jpg',
      createdAt: now,
    },
    {
      id: 5,
      name: 'Trà Đào Cam Sả',
      category: 'Trà & Bánh',
      kind: 'menu',
      unit: 'ly',
      costPrice: 18000,
      sellPrice: 50000,
      inStock: true,
      recipe: 'Trà đen thơm mát kết hợp miếng đào tươi giòn sần sật, sả đập dập và cam vàng.',
      variations: [],
      imageUrl: '/images/catalog/photo-1556679343-c7306c1976bc.jpg',
      createdAt: now,
    },
    {
      id: 6,
      name: 'Cà phê Ủ Lạnh Nitro',
      category: 'Cà phê ủ lạnh',
      kind: 'menu',
      unit: 'ly',
      costPrice: 22000,
      sellPrice: 58000,
      inStock: true,
      recipe: 'Ủ lạnh 20 tiếng rót sục khí Nitơ tạo lớp bọt kem bồng bềnh mịn màng.',
      variations: [{ name: 'Tiêu chuẩn', price: 0 }, { name: 'Kem béo ngọt', price: 10000 }],
      imageUrl: '/images/catalog/photo-1517701550927-30cf4ba1dba5.jpg',
      createdAt: now,
    },
    {
      id: 7,
      name: 'Cà phê Trứng Hà Nội',
      category: 'Cà phê',
      kind: 'menu',
      unit: 'ly',
      costPrice: 25000,
      sellPrice: 60000,
      inStock: true,
      recipe: 'Kem trứng đánh bông mịn sánh quyện cùng cà phê nguyên chất đậm đà.',
      variations: [],
      imageUrl: '/images/catalog/photo-1751569543716-70c5fb9a8298.jpg',
      createdAt: now,
    },
    {
      id: 8,
      name: 'Cà phê Pour Over Guji Ethiopia',
      category: 'Pha thủ công',
      kind: 'menu',
      unit: 'phần',
      costPrice: 28000,
      sellPrice: 65000,
      inStock: true,
      recipe: 'Pha thủ công V60, nốt hương hoa nhài hoang dã, đào chín và cam bergamot.',
      variations: [],
      imageUrl: '/images/catalog/photo-1514432324607-a09d9b4aefdd.jpg',
      createdAt: now,
    },
    {
      id: 9,
      name: 'Cà phê Geisha Tuyển Chọn',
      category: 'Pha thủ công',
      kind: 'menu',
      unit: 'phần',
      costPrice: 45000,
      sellPrice: 95000,
      inStock: true,
      recipe: 'Lô cà phê quý hiếm Panama Geisha. Hương hoa quả, bergamot và mật ngọt.',
      variations: [],
      imageUrl: '/images/catalog/photo-1610882648335-ced8fc8fa6b6.jpg',
      createdAt: now,
    },
    {
      id: 10,
      name: 'Bánh Croissant Bơ Pháp',
      category: 'Bánh ngọt',
      kind: 'menu',
      unit: 'chiếc',
      costPrice: 20000,
      sellPrice: 45000,
      inStock: true,
      recipe: 'Bánh sừng bò bơ Pháp ngàn lớp nướng giòn rụm với hạnh nhân lát thơm béo.',
      variations: [{ name: 'Nóng ấm', price: 0 }, { name: 'Bình thường', price: 0 }],
      imageUrl: '/images/catalog/photo-1555507036-ab1f4038808a.jpg',
      createdAt: now,
    },
    {
      id: 11,
      name: 'Bánh Pain au Chocolat Socola',
      category: 'Bánh ngọt',
      kind: 'menu',
      unit: 'chiếc',
      costPrice: 18000,
      sellPrice: 42000,
      inStock: true,
      recipe: 'Bánh pastry ngàn lớp bơ vàng giòn thơm cuộn hai thanh socola đen Valrhona.',
      variations: [],
      imageUrl: '/images/catalog/photo-1509440159596-0249088772ff.jpg',
      createdAt: now,
    },
    {
      id: 12,
      name: 'Bánh Chuối Óc Chó Thủ Công',
      category: 'Bánh ngọt',
      kind: 'menu',
      unit: 'lát',
      costPrice: 15000,
      sellPrice: 38000,
      inStock: true,
      recipe: 'Bánh chuối nướng mềm ẩm, giòn bùi hạt óc chó và phết bơ cà phê.',
      variations: [],
      imageUrl: '/images/catalog/photo-1607958996333-41aef7caefaa.jpg',
      createdAt: now,
    },
    {
      id: 13,
      name: 'Hạt Cà Phê Đà Lạt House Blend (250g)',
      category: 'Cà phê hạt',
      kind: 'menu',
      unit: 'gói',
      costPrice: 90000,
      sellPrice: 180000,
      inStock: true,
      recipe: 'Phối trộn Colombia & Ethiopia. Hương vị socola fudge, hạt phỉ và vỏ cam.',
      variations: [{ name: 'Nguyên hạt', price: 0 }, { name: 'Xay cho Pour Over', price: 0 }, { name: 'Xay cho Phin', price: 0 }],
      imageUrl: '/images/catalog/photo-1580933073521-dc49ac0d4e6a.jpg',
      createdAt: now,
    },
    {
      id: 14,
      name: 'Sữa tươi thanh trùng nguyên kem',
      category: 'Nguyên liệu',
      kind: 'ingredient',
      unit: 'lít',
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
      unit: 'hộp',
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
      unit: 'chai',
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
      unit: 'chai',
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
      unit: 'kg',
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
      branch: DEFAULT_BRANCH_ID,
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

  // Phiếu đang chạy hôm nay (màn hình pha chế và sơ đồ bàn)
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

  // Các đơn đã hoàn tất sớm hơn trong ngày
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

  // Các đơn hôm qua
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

  // Các đơn của 5 ngày trước đó (ngày 2..6)
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

export const reservationStatuses = ['Chờ xác nhận', 'Đã đặt', 'Hoàn thành', 'Đã hủy'] as const
export type ReservationStatusLabel = (typeof reservationStatuses)[number]

export type MockReservation = {
  userId?: number | null
  tableIds?: number[]
  code: string
  customer: string
  contact: string
  email: string | null
  note: string | null
  dateTime: Date
  // Giờ kết thúc; phiếu không có giữ bàn hai giờ (reservationEnd).
  endTime?: Date | null
  guests: number
  tableId: number | null
  tableName: string
  branch: BranchId
  status: ReservationStatusLabel
  preOrders: { name: string; qty: number; price: number }[]
}

function at(daysFromToday: number, hour: number, minute = 0) {
  // startOfDay đếm số ngày lùi về quá khứ, nên đổi dấu để tiến về tương lai.
  const date = startOfDay(-daysFromToday)
  date.setHours(hour, minute, 0, 0)
  return date
}

function createInitialReservations(): MockReservation[] {
  const seeded: Omit<MockReservation, 'branch'>[] = [
    {
      code: 'RES-001', customer: 'Nguyễn Hoàng Nam', contact: '0912 345 678', email: 'nam.nguyen@gmail.com',
      note: 'Yêu cầu bàn gần cửa sổ, chuẩn bị trước cà phê.', dateTime: at(0, 15), guests: 2, tableId: 4, tableName: 'Table 4',
      status: 'Đã đặt',
      preOrders: [
        { name: 'Cà phê Latte Vani Mịn', qty: 2, price: 55000 },
        { name: 'Bánh Croissant Bơ Pháp', qty: 2, price: 45000 },
      ],
    },
    {
      code: 'RES-002', customer: 'Trần Thu Hà', contact: '0987 654 321', email: 'ha.tran@outlook.com',
      note: 'Kỷ niệm ngày cưới, chuẩn bị nến nhỏ nếu có.', dateTime: at(0, 18), endTime: at(0, 19, 30), guests: 2, tableId: 11, tableName: 'Table 11',
      status: 'Đã đặt', preOrders: [{ name: 'Cold Brew Cam Vàng', qty: 2, price: 55000 }],
    },
    {
      code: 'RES-003', customer: 'Lê Minh Khôi', contact: '0903 111 222', email: 'khoi.le@corp.vn',
      note: 'Họp đối tác, cần không gian thật yên tĩnh.', dateTime: at(1, 9), guests: 6, tableId: 5, tableName: 'Table 5',
      status: 'Chờ xác nhận',
      preOrders: [
        { name: 'Cà phê Muối Đặc Biệt', qty: 4, price: 45000 },
        { name: 'Bạc Xỉu Sữa Tươi', qty: 2, price: 45000 },
      ],
    },
    {
      code: 'RES-004', customer: 'Phạm Thanh Thảo', contact: '0934 888 999', email: 'thao.pham@gmail.com',
      note: 'Bàn sinh nhật bạn bè.', dateTime: at(1, 14), guests: 3, tableId: 3, tableName: 'Table 3',
      status: 'Chờ xác nhận', preOrders: [],
    },
    {
      code: 'RES-005', customer: 'Hoàng Văn Dũng', contact: '0977 444 555', email: 'dung.hoang@gmail.com',
      note: 'Khách thanh toán thẻ Visa.', dateTime: at(-1, 10), guests: 4, tableId: 7, tableName: 'Table 7',
      status: 'Hoàn thành', preOrders: [],
    },
    {
      code: 'RES-006', customer: 'Đặng Ngọc Mai', contact: '0918 222 333', email: 'mai.dang@gmail.com',
      note: 'Khách quen chi nhánh.', dateTime: at(-2, 16, 30), guests: 2, tableId: 1, tableName: 'Table 1',
      status: 'Hoàn thành', preOrders: [],
    },
    {
      code: 'RES-007', customer: 'Bùi Anh Tuấn', contact: '0922 666 777', email: 'tuan.bui@gmail.com',
      note: 'Khách báo bận đột xuất.', dateTime: at(-3, 19), guests: 4, tableId: 8, tableName: 'Table 8',
      status: 'Đã hủy', preOrders: [],
    },
  ]
  return seeded.map((reservation) => ({ ...reservation, branch: DEFAULT_BRANCH_ID }))
}

type StoreState = {
  tables: FloorTable[]
  menuItems: MenuItem[]
  orders: Order[]
  reservations: MockReservation[]
}

const globalForMock = globalThis as unknown as { __daLatCafeStore?: StoreState }

function getStore(): StoreState {
  if (!globalForMock.__daLatCafeStore) {
    globalForMock.__daLatCafeStore = {
      tables: createInitialTables(),
      menuItems: createInitialMenuItems(),
      orders: createInitialOrders(),
      reservations: createInitialReservations(),
    }
  }
  // Store tạo bởi bản build cũ hơn trong cùng tiến trình dev chưa có danh sách phiếu đặt.
  globalForMock.__daLatCafeStore.reservations ??= createInitialReservations()
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
  expireMockNoShows()
  const store = getStore()
  return store.tables.filter(table => !table.deletedAt).sort((a, b) => a.id - b.id)
}

export function saveMockTable(
  { branch: requested, ...input }: { name: string; seats: number; zone: string; imageUrl: string | null; branch?: BranchId },
  id?: number,
): FloorTable {
  const store = getStore()
  let table = id === undefined ? undefined : store.tables.find(t => t.id === id && !t.deletedAt)
  if (id !== undefined && !table) throw new Error('Không tìm thấy bàn.')
  // Bàn đang sửa giữ nguyên chi nhánh; tên chỉ cần không trùng trong cùng một chi nhánh.
  const branch = table?.branch ?? requested ?? DEFAULT_BRANCH_ID
  if (store.tables.some(t => !t.deletedAt && t.id !== id && t.branch === branch && t.name.toLowerCase() === input.name.toLowerCase())) throw new Error('Tên bàn đã tồn tại.')
  if (table && input.seats < table.guestCount) throw new Error('Số chỗ nhỏ hơn số khách đang ngồi.')
  if (id !== undefined && store.reservations.some(r => {
    const ids = r.tableIds ?? [r.tableId]
    return ids.includes(id) && (r.status === 'Chờ xác nhận' || r.status === 'Đã đặt')
      && r.guests > ids.reduce<number>((sum, selected) => sum + (selected === id ? input.seats : store.tables.find(table => table.id === selected)?.seats ?? 0), 0)
  })) throw new Error('Số chỗ nhỏ hơn số khách đã đặt bàn.')
  if (!table) {
    table = { id: Math.max(0, ...store.tables.map(t => t.id)) + 1, ...input, branch, status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() }
    store.tables.push(table)
  } else Object.assign(table, input, { updatedAt: new Date() })
  return { ...table }
}

export function deleteMockTable(id: number): void {
  const store = getStore()
  const table = store.tables.find(t => t.id === id && !t.deletedAt)
  if (!table) throw new Error('Không tìm thấy bàn.')
  const openOrder = store.orders.some(order => (order.tableIds?.length ? order.tableIds : [order.tableId]).includes(id) && (order.status !== 'cancelled' && (order.status !== 'completed' || order.paymentStatus === 'unpaid')))
  const booking = store.reservations.some(reservation => (reservation.tableIds ?? [reservation.tableId]).includes(id) && ['Chờ xác nhận', 'Đã đặt'].includes(reservation.status))
  if (table.status === 'occupied' || table.status === 'reserved' || openOrder || booking) throw new Error('Bàn còn khách, đơn chưa kết thúc/thanh toán hoặc lịch đặt chưa xử lý. Vui lòng xử lý trước khi xóa.')
  table.deletedAt = new Date()
}

export function getMockActiveOrders(): Order[] {
  const store = getStore()
  return store.orders
    .filter((order) => order.status !== 'completed' && order.status !== 'cancelled')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function getMockOrdersSince(days: number): Order[] {
  const store = getStore()
  const cutoff = startOfDay(days).getTime()
  return store.orders
    .filter((order) => order.createdAt.getTime() >= cutoff)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getMockAllOrders(): Order[] {
  const store = getStore()
  return [...store.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getMockOrder(orderId: number): Order | undefined {
  return getStore().orders.find((o) => o.id === orderId)
}

export function getMockOrdersByCode(codes: string[]): Order[] {
  const wanted = new Set(codes)
  return getStore().orders.filter((o) => wanted.has(o.orderCode))
}

export function updateMockOrderStatus(orderId: number, status: OrderStatus): { ok: boolean; error?: string } {
  const store = getStore()
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.status === status) return { ok: true }
  const invalid = orderTransitionError(order, status)
  if (invalid) return { ok: false, error: invalid }
  order.status = status
  if (status === 'cancelled' && order.paymentStatus === 'paid') order.paymentStatus = 'refunded'
  if (status === 'cancelled') {
    const booking = store.reservations.find(reservation => reservation.code === order.orderCode)
    if (booking?.status === 'Hoàn thành') booking.status = 'Đã hủy'
  }
  order.completedAt = status === 'completed' ? new Date() : null
  // Cùng quy tắc với TableStatusSyncObserver bên Java: đơn ăn tại chỗ hoàn tất thì bàn được nhả để
  // dọn.
  if ((status === 'completed' || status === 'cancelled') && order.tableId) {
    for (const id of order.tableIds?.length ? order.tableIds : [order.tableId]) {
      const other = store.orders.some(other => other.id !== order.id && (other.tableIds?.length ? other.tableIds : [other.tableId]).includes(id) && other.status !== 'completed' && other.status !== 'cancelled')
      const table = store.tables.find((t) => t.id === id)
      if (table && !other) {
        table.status = 'cleaning'
        table.guestCount = 0
        table.occupiedSince = null
        table.updatedAt = new Date()
      }
    }
  }
  return { ok: true }
}

export function markMockOrderPaid(orderId: number): { ok: boolean; error?: string } {
  const store = getStore()
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.status === 'cancelled' || order.paymentStatus === 'refunded') return { ok: false, error: 'Không thể thu tiền đơn đã hủy.' }
  order.paymentStatus = 'paid'
  return { ok: true }
}

export function settleMockTables(tableIds: number[], method: PaymentMethod, tendered?: number, expectedTotal?: number) {
  const store = getStore()
  const orders = store.orders.filter(order => order.orderType === 'dine-in' && order.paymentStatus === 'unpaid' && order.status !== 'cancelled'
    && (order.tableIds?.length ? order.tableIds : [order.tableId]).some(id => id !== null && tableIds.includes(id)))
  if (tableIds.some(id => !orders.some(order => (order.tableIds?.length ? order.tableIds : [order.tableId]).includes(id)))) throw new Error('Một bàn không còn đơn chưa thanh toán.')
  if (orders.some(order => (order.tableIds?.length ? order.tableIds : [order.tableId]).some(id => id !== null && !tableIds.includes(id)))) throw new Error('Cần chọn đủ các bàn thuộc cùng một phiếu đặt bàn.')
  const total = orders.reduce((sum, order) => sum + order.total, 0)
  if (expectedTotal !== undefined && Math.abs(total - expectedTotal) > 0.01) throw new Error('Hóa đơn vừa thay đổi. Vui lòng kiểm tra lại.')
  if (method === 'cash' && (tendered === undefined || !Number.isFinite(tendered) || tendered < total)) throw new Error('Tiền khách đưa chưa đủ hóa đơn gộp.')
  for (const order of orders) { order.paymentMethod = method; order.paymentStatus = 'paid' }
  return { transactionId: `LOCAL-GROUP-${crypto.randomUUID()}`, tableIds, total, orders: orders.map(order => ({ orderCode: order.orderCode, status: order.status, paymentStatus: order.paymentStatus, total: order.total })) }
}

export function updateMockTableStatus(tableId: number, status: TableStatus, guestCount = 0): { ok: boolean; error?: string } {
  const store = getStore()
  const table = store.tables.find((t) => t.id === tableId && !t.deletedAt)
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
  lines: { menuItemId: number; qty: number; variation?: string; customizations?: PosCustomization[] }[]
  customer: string
  tableId: number | null
  orderType: OrderType
  paymentMethod: PaymentMethod
  paid: boolean
  // Có giá trị khi backend Java đã cấp mã đơn.
  orderCode?: string
  // Có giá trị khi backend Java đã tính giá đơn (giảm giá thành viên, đổi điểm).
  totals?: { subtotal: number; total: number }
  // Tiền mặt khách đưa; tùy chọn, nhưng nếu có thì đơn tiền mặt đã thanh toán phải đủ tổng tiền.
  tenderedAmount?: number
  // Chi nhánh của đơn đến lấy hoặc giao hàng; với đơn khác thì bàn quyết định.
  branch?: BranchId
}

// Bản thay thế cục bộ cho quy tắc của Facade bên Java: tiền mặt khách đưa ít hơn tổng tiền thì bị
// từ chối.
export function cashTenderError(input: Pick<NewMockOrderInput, 'paid' | 'paymentMethod' | 'tenderedAmount'>, total: number): string | null {
  if (!input.paid || input.paymentMethod !== 'cash' || input.tenderedAmount === undefined) return null
  if (input.tenderedAmount >= total) return null
  return `Cash tendered ${input.tenderedAmount.toLocaleString('vi-VN')} đ does not cover the total ${total.toLocaleString('vi-VN')} đ.`
}

export function createMockOrder(input: NewMockOrderInput): { ok: boolean; message?: string; error?: string } {
  const store = getStore()
  if (input.tableId != null && !store.tables.some(table => table.id === input.tableId && !table.deletedAt)) return { ok: false, error: 'Bàn không còn phục vụ.' }
  const byId = new Map(store.menuItems.map((item) => [item.id, item]))

  const items: OrderItem[] = []
  for (const line of input.lines) {
    const item = byId.get(line.menuItemId)
    if (!item || item.kind !== 'menu' || !item.inStock) {
      return { ok: false, error: 'One of the items is no longer available.' }
    }
    const variation = line.variation ? item.variations.find((v: Variation) => v.name === line.variation) : undefined
    const customizations = line.customizations ?? []
    items.push({
      name: item.name,
      qty: line.qty,
      price: item.sellPrice + (variation?.price ?? 0) + customizationSurcharge(customizations),
      variation: [variation?.name, describeCustomizations(customizations)].filter(Boolean).join(' · ') || undefined,
    })
  }

  const subtotal = input.totals?.subtotal ?? Math.round(items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
  const total = input.totals?.total ?? Math.round(subtotal * (1 + TAX_RATE) * 100) / 100 + shippingFee(input.orderType)
  const tenderError = cashTenderError(input, total)
  if (tenderError) return { ok: false, error: tenderError }
  const nextId = store.orders.reduce((max, o) => Math.max(max, o.id), 0) + 1

  const newOrder: Order = {
    id: nextId,
    orderCode: input.orderCode ?? `AC-${String(nextId).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
    customer: input.customer.trim().slice(0, 60) || 'Walk-in',
    tableId: input.tableId,
    branch: branchOfTable(store.tables, input.tableId) ?? input.branch ?? DEFAULT_BRANCH_ID,
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

export type NewMockReservationInput = Omit<MockReservation, 'code' | 'status' | 'tableName' | 'preOrders' | 'tableId' | 'branch'> & {
  tableId: number
  preOrders?: MockReservation['preOrders']
  // Nếu có truyền, mọi bàn được chọn phải thuộc chi nhánh này.
  branch?: BranchId
}

function releaseMockReservedTables(reservation: MockReservation, now = Date.now()): void {
  const store = getStore()
  for (const id of reservation.tableIds ?? (reservation.tableId ? [reservation.tableId] : [])) {
    const another = store.reservations.some(other => (other.tableIds ?? [other.tableId]).includes(id) && (other.status === 'Chờ xác nhận' || other.status === 'Đã đặt') && other.dateTime.getTime() < now + RESERVATION_DEFAULT_LENGTH_MS)
    const order = store.orders.some(order => (order.tableIds?.length ? order.tableIds : [order.tableId]).includes(id) && order.status !== 'completed' && order.status !== 'cancelled')
    const table = store.tables.find(table => table.id === id)
    if (table?.status === 'reserved' && !another && !order) updateMockTableStatus(id, 'available')
  }
}

export function expireMockNoShows(now = Date.now()): number {
  const store = getStore()
  let expired = 0
  for (const reservation of store.reservations) {
    if ((reservation.status !== 'Chờ xác nhận' && reservation.status !== 'Đã đặt') || now < reservation.dateTime.getTime() + RESERVATION_NO_SHOW_GRACE_MS) continue
    reservation.status = 'Đã hủy'
    expired++
    releaseMockReservedTables(reservation, now)
  }
  return expired
}

// Bản thay thế cục bộ cho POST /api/reservations khi backend Java offline. Nó lặp lại Chain of
// Responsibility bên Java (thời điểm, giờ mở cửa, số khách, bàn trống) với các giá trị mặc định của
// Java, nên phiếu lưu ở đây cũng sẽ qua được Java.
type BookingCheck =
  | { ok: true; ids: number[]; tables: FloorTable[]; branch: BranchId }
  | { ok: false; error: string }

// Chuỗi kiểm tra của Java với giá trị mặc định; `ignoreCode` là phiếu đang sửa, không bị tính là
// trùng với chính nó.
function checkMockBooking(input: NewMockReservationInput, ignoreCode?: string): BookingCheck {
  const store = getStore()
  if (hasReservationTimePassed(input.dateTime)) return { ok: false, error: 'Không thể đặt bàn cho thời điểm đã qua.' }
  if (!isWithinDefaultOperatingHours(input.dateTime)) {
    return { ok: false, error: `Quán chỉ nhận đặt bàn trong giờ mở cửa (${DEFAULT_OPENING_TIME} - ${DEFAULT_CLOSING_TIME}).` }
  }
  if (input.endTime) {
    const rangeError = reservationRangeError(input.dateTime, input.endTime)
    if (rangeError) return { ok: false, error: rangeError }
  }
  if (input.guests > DEFAULT_MAX_RESERVATION_GUESTS) {
    return { ok: false, error: `Mỗi phiếu nhận tối đa ${DEFAULT_MAX_RESERVATION_GUESTS} khách.` }
  }
  const ids = input.tableIds ?? [input.tableId]
  if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id < 1)) return { ok: false, error: 'Chọn từ 1 đến 10 bàn khác nhau.' }
  const tables = ids.map(id => store.tables.find(table => table.id === id && !table.deletedAt))
  if (tables.some(table => !table)) return { ok: false, error: 'Table not found.' }
  const branch = tables[0]!.branch
  if (tables.some(table => table!.branch !== branch)) return { ok: false, error: 'Các bàn ghép phải cùng một chi nhánh.' }
  if (input.branch && input.branch !== branch) return { ok: false, error: 'Bàn đã chọn không thuộc chi nhánh này.' }
  const capacity = tables.reduce((sum, table) => sum + table!.seats, 0)
  if (input.guests < 1 || input.guests > capacity) return { ok: false, error: 'Số khách vượt tổng số chỗ các bàn đã chọn.' }
  const taken = store.reservations.some(
    (r) => r.code !== ignoreCode && ids.some(id => (r.tableIds ?? [r.tableId]).includes(id)) && r.status !== 'Đã hủy'
      && reservationRangesOverlap(r.dateTime, reservationEnd(r), input.dateTime, reservationEnd(input)),
  )
  if (taken) return { ok: false, error: 'Bàn đã được đặt trong khung giờ này.' }
  return { ok: true, ids, tables: tables as FloorTable[], branch }
}

export function createMockReservation(input: NewMockReservationInput): { ok: boolean; code?: string; error?: string } {
  expireMockNoShows()
  const store = getStore()
  // Như Java: thiếu giờ kết thúc thì giữ bàn hai giờ, cắt về giờ đóng cửa.
  input = { ...input, endTime: input.endTime ?? defaultReservationEnd(input.dateTime) }
  const check = checkMockBooking(input)
  if (!check.ok) return { ok: false, error: check.error }
  const { ids, tables, branch } = check

  const localCount = store.reservations.filter((r) => r.code.startsWith('RES-L')).length
  // Chữ L đánh dấu phiếu cục bộ để không bao giờ bị nhầm với RES-0001 do backend cấp.
  const code = `RES-L${String(localCount + 1).padStart(4, '0')}`
  store.reservations.push({ ...input, branch, tableId: ids[0], tableIds: ids, code, tableName: tables.map(table => table!.name).join(', '), status: 'Chờ xác nhận', preOrders: input.preOrders ?? [] })
  return { ok: true, code }
}

// Sửa phiếu cục bộ đang chờ hoặc đã xác nhận; mã phiếu, trạng thái và món đặt trước giữ nguyên.
export function updateMockReservation(code: string, input: NewMockReservationInput): { ok: boolean; error?: string } {
  expireMockNoShows()
  const reservation = getStore().reservations.find((r) => r.code === code)
  if (!reservation) return { ok: false, error: 'Không tìm thấy phiếu đặt bàn.' }
  if (reservation.status !== 'Chờ xác nhận' && reservation.status !== 'Đã đặt') {
    return { ok: false, error: `Chỉ sửa được phiếu đang chờ hoặc đã xác nhận (${reservation.status}).` }
  }
  // Không gửi giờ kết thúc thì giữ nguyên thời lượng cũ, dời theo giờ bắt đầu mới; phiếu cũ chưa lưu
  // giờ kết thúc nhận mặc định như khi đặt (cắt về giờ đóng cửa), như ReservationHandler bên Java.
  const endTime = input.endTime ?? (reservation.endTime
    ? new Date(input.dateTime.getTime() + reservation.endTime.getTime() - reservation.dateTime.getTime())
    : defaultReservationEnd(input.dateTime))
  const check = checkMockBooking({ ...input, endTime, branch: input.branch ?? reservation.branch }, code)
  if (!check.ok) return { ok: false, error: check.error }
  Object.assign(reservation, {
    customer: input.customer,
    contact: input.contact,
    email: input.email,
    note: input.note,
    dateTime: input.dateTime,
    endTime,
    guests: input.guests,
    tableId: check.ids[0],
    tableIds: check.ids,
    tableName: check.tables.map((table) => table.name).join(', '),
    branch: check.branch,
  })
  return { ok: true }
}

export function updateMockReservationStatus(code: string, status: ReservationStatusLabel): { ok: boolean; error?: string } {
  expireMockNoShows()
  const reservation = getStore().reservations.find((r) => r.code === code)
  if (!reservation) return { ok: false, error: 'Reservation not found.' }
  if (reservation.status === status) return { ok: true }
  const allowed = (status === 'Đã đặt' && reservation.status === 'Chờ xác nhận')
    || (status === 'Đã hủy' && (reservation.status === 'Chờ xác nhận' || reservation.status === 'Đã đặt'))
  if (!allowed) return { ok: false, error: 'Không thể đổi trạng thái phiếu đã hủy hoặc đã nhận bàn. Nhận bàn qua thao tác Sang POS.' }
  reservation.status = status
  if (status === 'Đã hủy') releaseMockReservedTables(reservation)
  return { ok: true }
}

export function getMockReservations(): MockReservation[] {
  expireMockNoShows()
  return [...getStore().reservations].sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())
}

export type ExternalOrderInput = {
  tableIds?: number[]
  orderCode: string
  customer: string
  tableId: number | null
  items: OrderItem[]
  guests?: number
  branch?: BranchId
}

// Ghi một đơn có các dòng đã được tính giá ở nơi khác (Adapter bên Java, hoặc Adapter cục bộ bên
// dưới), để KDS và sơ đồ bàn hiển thị nó. Chưa thanh toán, ăn tại chỗ, đang chờ: đúng thứ mà một
// phiếu đã nhận bàn trở thành.
export function createMockOrderFromItems(input: ExternalOrderInput): { ok: boolean; message?: string; error?: string } {
  const store = getStore()
  const subtotal = Math.round(input.items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
  const nextId = store.orders.reduce((max, o) => Math.max(max, o.id), 0) + 1
  store.orders.unshift({
    id: nextId,
    orderCode: input.orderCode,
    customer: input.customer.trim().slice(0, 60) || 'Walk-in',
    tableId: input.tableId,
    tableIds: input.tableIds,
    branch: branchOfTable(store.tables, input.tableIds?.[0] ?? input.tableId) ?? input.branch ?? DEFAULT_BRANCH_ID,
    orderType: 'dine-in',
    items: input.items,
    subtotal,
    total: Math.round(subtotal * (1 + TAX_RATE) * 100) / 100,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    status: 'pending',
    createdAt: new Date(),
    completedAt: null,
  })
  for (const id of input.tableIds ?? (input.tableId ? [input.tableId] : [])) {
    const table = store.tables.find(table => table.id === id)
    updateMockTableStatus(id, 'occupied', Math.min(input.guests ?? 1, table?.seats ?? 1))
  }
  return { ok: true, message: `Order ${input.orderCode} opened for ${input.customer}.` }
}

// Bản sao phía frontend của ReservationToOrderAdapter.toPosOrder(): mã phiếu trở thành mã đơn và
// các món đặt trước được chép sang, nên bản thân phiếu không bị sửa gì ngoài trạng thái.
export function transferMockReservation(code: string): { ok: boolean; orderCode?: string; error?: string } {
  expireMockNoShows()
  const store = getStore()
  const reservation = store.reservations.find((r) => r.code === code)
  if (!reservation) return { ok: false, error: 'Reservation not found.' }
  if (reservation.status === 'Hoàn thành') return { ok: false, error: 'This reservation has already been seated.' }
  if (reservation.status === 'Đã hủy') return { ok: false, error: 'A cancelled reservation cannot be seated.' }
  if (!hasReservationStarted(reservation.dateTime)) return { ok: false, error: 'Chưa đến giờ đặt bàn. Chỉ được mở đơn POS khi đến giờ khách đã đặt.' }
  if (store.orders.some((o) => o.orderCode === reservation.code)) return { ok: false, error: 'An order already exists for this reservation.' }

  const res = createMockOrderFromItems({
    orderCode: reservation.code,
    customer: reservation.customer || reservation.contact,
    tableId: reservation.tableId,
    tableIds: reservation.tableIds,
    items: reservation.preOrders.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
    guests: reservation.guests,
    branch: reservation.branch,
  })
  if (!res.ok) return { ok: false, error: res.error }
  reservation.status = 'Hoàn thành'
  return { ok: true, orderCode: reservation.code }
}

export type NewMockItemInput = {
  name: string
  category: string
  kind: 'menu' | 'ingredient'
  unit: string
  costPrice: number
  sellPrice: number
  recipe: string
  imageUrl: string
  variations: Variation[]
}

// Tên món luôn duy nhất (không phân biệt hoa thường), như bên Java và trong database.
export function updateMockMenuItem(itemId: number, input: NewMockItemInput): { ok: boolean; error?: string } {
  const store = getStore()
  const item = store.menuItems.find((m) => m.id === itemId)
  if (!item) return { ok: false, error: 'Không tìm thấy món trong thực đơn.' }
  const name = input.name.trim().toLowerCase()
  if (store.menuItems.some((m) => m.id !== itemId && m.name.trim().toLowerCase() === name)) {
    return { ok: false, error: 'Tên món đã có trong thực đơn.' }
  }
  Object.assign(item, {
    ...input,
    unit: input.unit || 'pcs',
    recipe: input.recipe || null,
    imageUrl: input.imageUrl || null,
  })
  return { ok: true }
}

export function deleteMockMenuItem(itemId: number): { ok: boolean; error?: string } {
  const store = getStore()
  const index = store.menuItems.findIndex((m) => m.id === itemId)
  if (index < 0) return { ok: false, error: 'Không tìm thấy món trong thực đơn.' }
  store.menuItems.splice(index, 1)
  return { ok: true }
}

export function createMockMenuItem(input: NewMockItemInput): { ok: boolean; id?: number; message?: string; error?: string } {
  const store = getStore()
  const nextId = store.menuItems.reduce((max, m) => Math.max(max, m.id), 0) + 1
  const newItem: MenuItem = {
    id: nextId,
    name: input.name,
    category: input.category,
    kind: input.kind,
    unit: input.unit || 'pcs',
    costPrice: input.costPrice,
    sellPrice: input.sellPrice,
    inStock: true,
    recipe: input.recipe || null,
    variations: input.variations,
    imageUrl: input.imageUrl || null,
    createdAt: new Date(),
  }
  store.menuItems.push(newItem)
  return { ok: true, id: newItem.id, message: `${newItem.name} added.` }
}

