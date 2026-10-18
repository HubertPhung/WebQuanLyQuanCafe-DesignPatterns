// Shop branches shown on the storefront footer and the sign-in panel. One place to edit.
export type Branch = {
  id: 'phan-dinh-phung' | 'bui-thi-xuan'
  name: string
  street: string
  ward: string
  city: string
  hours: string
  note: string
}

export const HOTLINE = { display: '0988 752 291', tel: '0988752291' }
export const CONTACT_EMAIL = '2312585@dlu.edu.vn'

export const branches: Branch[] = [
  {
    id: 'phan-dinh-phung',
    name: 'Đà Lạt Cafe Phan Đình Phùng',
    street: '123 Phan Đình Phùng',
    ward: 'Phường Xuân Hương – Đà Lạt',
    city: 'Lâm Đồng',
    hours: '07:00 – 22:00',
    note: 'Quầy bar thủ công, khu ngồi nhìn ra phố',
  },
  {
    id: 'bui-thi-xuan',
    name: 'Đà Lạt Cafe Bùi Thị Xuân',
    street: '456 Bùi Thị Xuân',
    ward: 'Phường Xuân Hương – Đà Lạt',
    city: 'Lâm Đồng',
    hours: '07:00 – 22:00',
    note: 'Sân vườn rộng, góc làm việc yên tĩnh',
  },
]

// Tables, orders and bookings belong to one branch; the menu, customers and accounts are shared.
// The ids are the ones the Java backend stores (com.dalatcafe.model.Branches).
export type BranchId = 'phan-dinh-phung' | 'bui-thi-xuan'
export const DEFAULT_BRANCH_ID: BranchId = 'phan-dinh-phung'

export function isBranchId(value: unknown): value is BranchId {
  return branches.some((branch) => branch.id === value)
}

export function branchById(id: string | null | undefined): Branch {
  return branches.find((branch) => branch.id === id) ?? branches[0]
}

export function branchAddress(branch: Branch) {
  return `${branch.street}, ${branch.ward}, ${branch.city}`
}

export function mapsUrl(branch: Branch) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchAddress(branch))}`
}
