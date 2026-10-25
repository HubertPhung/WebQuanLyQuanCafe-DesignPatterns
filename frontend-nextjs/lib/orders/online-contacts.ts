import 'server-only'
import { pool } from '@/lib/db'

// Ai đã đặt một đơn storefront và giao tới đâu. Lưu cạnh admin_orders, khóa theo mã đơn, để các
// dòng đơn (dùng chung với POS và mock store) giữ nguyên cấu trúc. Được tạo ở lần dùng đầu;
// migration tạo sẵn bảng này với RLS bật, vì nó chứa số điện thoại. Không có database thì dùng bản
// sao trong bộ nhớ cùng vòng đời với mock store.

export type Fulfilment = 'delivery' | 'pickup'

export type OrderContact = {
  orderCode: string
  // Tài khoản đã đặt đơn (đặt món cần đăng nhập); null với đơn có từ trước quy tắc đó.
  userId: number | null
  phone: string
  email: string | null
  address: string | null
  fulfilment: Fulfilment
  note: string | null
  createdAt: Date
}

const globalForContacts = globalThis as unknown as { orderContacts?: Map<string, OrderContact> }
const memory = (globalForContacts.orderContacts ??= new Map<string, OrderContact>())

let ready: Promise<boolean> | null = null

function tableReady(): Promise<boolean> {
  if (!pool) return Promise.resolve(false)
  ready ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS admin_order_contacts (
        order_code text PRIMARY KEY,
        phone text NOT NULL,
        email text,
        address text,
        fulfilment text NOT NULL CHECK (fulfilment IN ('delivery', 'pickup')),
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE admin_order_contacts ADD COLUMN IF NOT EXISTS user_id integer;
      CREATE INDEX IF NOT EXISTS admin_order_contacts_user_idx ON admin_order_contacts (user_id, created_at DESC);
    `)
    .then(
      () => true,
      (error: unknown) => {
        console.warn('Could not create admin_order_contacts, keeping contacts in memory:', error)
        ready = null
        return false
      },
    )
  return ready
}

export async function saveOrderContact(contact: Omit<OrderContact, 'createdAt'>): Promise<void> {
  if (await tableReady()) {
    try {
      await pool!.query(
        `INSERT INTO admin_order_contacts (order_code, user_id, phone, email, address, fulfilment, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (order_code) DO NOTHING`,
        [contact.orderCode, contact.userId, contact.phone, contact.email, contact.address, contact.fulfilment, contact.note],
      )
      return
    } catch (error) {
      console.warn('Saving the order contact failed, using memory:', error)
    }
  }
  memory.set(contact.orderCode, { ...contact, createdAt: new Date() })
}

type ContactRow = {
  order_code: string
  user_id: number | null
  phone: string
  email: string | null
  address: string | null
  fulfilment: Fulfilment
  note: string | null
  created_at: Date
}

export async function listOrderContacts(limit = 200): Promise<OrderContact[]> {
  return readContacts(null, limit)
}

/** Các đơn online mà một tài khoản đã đặt, mới nhất trước: lịch sử đơn của họ trên /account. */
export async function listContactsForUser(userId: number, limit = 50): Promise<OrderContact[]> {
  return readContacts(userId, limit)
}

/** Kiểm tra quyền ưu đãi không bao giờ được âm thầm coi lỗi database là lịch sử trống. */
export async function hasOnlineOrderForUser(userId: number): Promise<boolean> {
  if ([...memory.values()].some(contact => contact.userId === userId)) return true
  if (!pool) return false
  if (!(await tableReady())) throw new Error('Chưa kiểm tra được lịch sử đơn hàng. Vui lòng thử lại sau.')
  const result = await pool.query('SELECT 1 FROM admin_order_contacts WHERE user_id = $1 LIMIT 1', [userId])
  return Boolean(result.rowCount)
}

async function readContacts(userId: number | null, limit: number): Promise<OrderContact[]> {
  if (await tableReady()) {
    try {
      const result = userId === null
        ? await pool!.query<ContactRow>('SELECT * FROM admin_order_contacts ORDER BY created_at DESC LIMIT $1', [limit])
        : await pool!.query<ContactRow>(
            'SELECT * FROM admin_order_contacts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit],
          )
      return result.rows.map((row) => ({
        orderCode: row.order_code,
        userId: row.user_id,
        phone: row.phone,
        email: row.email,
        address: row.address,
        fulfilment: row.fulfilment,
        note: row.note,
        createdAt: row.created_at,
      }))
    } catch (error) {
      console.warn('Reading order contacts failed, using memory:', error)
    }
  }
  return [...memory.values()]
    .filter((contact) => userId === null || contact.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}
