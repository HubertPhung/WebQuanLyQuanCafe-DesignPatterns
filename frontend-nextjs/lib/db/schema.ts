import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export type OrderItem = { name: string; qty: number; price: number; variation?: string }
export type Variation = { name: string; price: number }

export const tableStatuses = ['available', 'occupied', 'reserved', 'cleaning'] as const
export const orderStatuses = ['pending', 'brewing', 'ready', 'completed'] as const
export const paymentMethods = ['cash', 'qr', 'card'] as const
export const orderTypes = ['dine-in', 'pickup', 'delivery'] as const

export type TableStatus = (typeof tableStatuses)[number]
export type OrderStatus = (typeof orderStatuses)[number]
export type PaymentMethod = (typeof paymentMethods)[number]
export type OrderType = (typeof orderTypes)[number]

export const adminTables = pgTable('admin_tables', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  seats: integer('seats').notNull().default(2),
  zone: text('zone').notNull().default('Main'),
  status: text('status').$type<TableStatus>().notNull().default('available'),
  guestCount: integer('guest_count').notNull().default(0),
  occupiedSince: timestamp('occupied_since', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adminMenuItems = pgTable('admin_menu_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  kind: text('kind').$type<'menu' | 'ingredient'>().notNull().default('menu'),
  stockQty: numeric('stock_qty', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  unit: text('unit').notNull().default('pcs'),
  lowStockThreshold: numeric('low_stock_threshold', { precision: 10, scale: 2, mode: 'number' }).notNull().default(10),
  costPrice: numeric('cost_price', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  sellPrice: numeric('sell_price', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  inStock: boolean('in_stock').notNull().default(true),
  recipe: text('recipe'),
  variations: jsonb('variations').$type<Variation[]>().notNull().default([]),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adminOrders = pgTable('admin_orders', {
  id: serial('id').primaryKey(),
  orderCode: text('order_code').notNull().unique(),
  customer: text('customer').notNull().default('Walk-in'),
  tableId: integer('table_id'),
  orderType: text('order_type').$type<OrderType>().notNull().default('dine-in'),
  items: jsonb('items').$type<OrderItem[]>().notNull().default([]),
  subtotal: numeric('subtotal', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  paymentMethod: text('payment_method').$type<PaymentMethod>().notNull().default('cash'),
  paymentStatus: text('payment_status').$type<'paid' | 'unpaid' | 'refunded'>().notNull().default('unpaid'),
  status: text('status').$type<OrderStatus>().notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export type FloorTable = typeof adminTables.$inferSelect
export type MenuItem = typeof adminMenuItems.$inferSelect
export type Order = typeof adminOrders.$inferSelect
