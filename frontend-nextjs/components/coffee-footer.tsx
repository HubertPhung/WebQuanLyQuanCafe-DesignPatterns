import { ArrowUpRight, Clock, Compass, Mail, MapPin, Phone, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { branchAddress, branches, CONTACT_EMAIL, HOTLINE, mapsUrl } from '@/lib/branches'

const body = 'text-sm leading-relaxed text-stone-600'
const link = 'font-medium text-[#3E2723] underline-offset-4 transition-colors hover:text-[#B45309] hover:underline'

const exploreLinks = [
  { href: '#menu', label: 'Thực đơn' },
  { href: '#story', label: 'Câu chuyện' },
  { href: '#journal', label: 'Góc cà phê' },
  { href: '/register', label: 'Tạo tài khoản tích điểm' },
]

function BranchCard({ branch, index }: { branch: (typeof branches)[number]; index: number }) {
  return (
    <article className="flex flex-col">
      {/* Index & Working Hours */}
      <div className="flex items-center gap-2.5 text-xs font-medium text-[#89684F]">
        <span className="font-bold tabular-nums text-stone-900" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="h-px w-6 bg-[#89684F]/40" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5 tabular-nums text-stone-600">
          <Clock size={12} className="text-[#B45309]" aria-hidden="true" />
          Mở cửa {branch.hours}
        </span>
      </div>

      {/* Street Name in Playfair Display font */}
      <h4 className="font-display mt-2.5 text-xl font-bold tracking-tight text-stone-900">
        {branch.street.replace(/^\d+\s*/, '')}
      </h4>

      {/* Address with MapPin */}
      <div className="mt-2 flex items-start gap-2 text-sm text-stone-600">
        <MapPin size={15} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
        <address className="not-italic leading-relaxed">
          <span className="font-semibold text-stone-800">{branch.street}</span>
          <br />
          <span>{branch.ward}, {branch.city}</span>
        </address>
      </div>

      {/* Ambiance Note */}
      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[#7C5A3E]">
        <Sparkles size={13} className="shrink-0 text-[#B45309]" aria-hidden="true" />
        <span>{branch.note}</span>
      </p>

      {/* Directions Link */}
      <a
        href={mapsUrl(branch)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Chỉ đường tới ${branchAddress(branch)}`}
        className="group/directions mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#3E2723] transition-colors hover:text-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#EDE6DB]"
      >
        <Compass size={14} className="text-[#B45309] transition-transform duration-300 group-hover/directions:rotate-45" aria-hidden="true" />
        <span className="underline decoration-[#3E2723]/30 decoration-1 underline-offset-4 transition-colors group-hover/directions:decoration-[#B45309]">
          Chỉ đường
        </span>
        <ArrowUpRight
          size={14}
          className="transition-transform duration-200 group-hover/directions:-translate-y-0.5 group-hover/directions:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </a>
    </article>
  )
}

export function CoffeeFooter({ storeDomain }: { storeDomain?: string }) {
  const year = new Date().getFullYear()
  return (
    <footer id="locations" className="border-t border-stone-300/60 bg-[#EDE6DB] text-stone-800 scroll-mt-24">
      <div className="section-shell grid gap-12 py-14 lg:grid-cols-12">
        {/* Brand and contact */}
        <div className="space-y-5 lg:col-span-4">
          <a href="#" aria-label="Đà Lạt Cafe – về đầu trang" className="inline-block">
            <Logo tagline="Cà phê & cộng đồng" />
          </a>
          <p className={`${body} max-w-sm`}>
            Đến vì hương cà phê, ở lại vì sự gắn kết. Hai không gian ấm áp giữa lòng Đà Lạt, mở cửa mỗi ngày.
          </p>
          <ul className="space-y-2.5 text-sm" aria-label="Liên hệ">
            <li>
              <a href={`tel:${HOTLINE.tel}`} className={`inline-flex items-center gap-2.5 ${link}`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-stone-300/70">
                  <Phone size={15} className="text-[#B45309]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-normal text-stone-500">Hotline</span>
                  <span className="tabular-nums">{HOTLINE.display}</span>
                </span>
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className={`inline-flex items-center gap-2.5 ${link}`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-stone-300/70">
                  <Mail size={15} className="text-[#B45309]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-normal text-stone-500">Email</span>
                  <span className="break-all">{CONTACT_EMAIL}</span>
                </span>
              </a>
            </li>
          </ul>
          {storeDomain && (
            <form
              className="flex h-11 max-w-sm items-center overflow-hidden rounded-full border border-stone-300 bg-white focus-within:ring-2 focus-within:ring-amber-600/40"
              action={`https://${storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/contact#contact_form`}
              method="post"
              target="_blank"
            >
              <input type="hidden" name="form_type" value="customer" />
              <input type="hidden" name="utf8" value="✓" />
              <input type="hidden" name="contact[tags]" value="newsletter" />
              <label className="sr-only" htmlFor="newsletter-email">
                Địa chỉ email nhận bản tin
              </label>
              <input
                id="newsletter-email"
                name="contact[email]"
                type="email"
                required
                placeholder="Nhận bản tin qua email"
                className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-stone-400"
              />
              <button
                type="submit"
                aria-label="Đăng ký nhận bản tin"
                className="mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#3E2723] text-white transition-colors hover:bg-[#5A3E2B]"
              >
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>

        {/* Branches */}
        <div className="lg:col-span-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#89684F]">Hệ thống chi nhánh</p>
            <h3 className="font-display mt-2 text-2xl font-semibold text-stone-900">Ghé quán gần bạn nhất</h3>
          </div>
          <div className="mt-6 grid gap-x-12 gap-y-10 border-t border-stone-300/70 pt-6 sm:grid-cols-2">
            {branches.map((branch, index) => (
              <BranchCard key={branch.id} branch={branch} index={index} />
            ))}
          </div>
        </div>
      </div>

      <div className="section-shell flex flex-col gap-4 border-t border-stone-300/60 py-6 text-xs text-stone-500 md:flex-row md:items-center md:justify-between">
        <span>© {year} Đà Lạt Cafe. Tận tâm chế tác, thưởng thức chậm rãi.</span>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {exploreLinks.map((item) => (
            <a key={item.href} href={item.href} className={`${link} text-xs`}>
              {item.label}
            </a>
          ))}
          <a href="/admin" className={`inline-flex items-center gap-1 ${link} text-xs`} title="Staff portal">
            Dành cho nhân viên <span className="sr-only">Staff portal</span> <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  )
}
