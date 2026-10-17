import { ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

// One type scale for the whole footer: Playfair titles (text-lg), 14px body, 12px fine print.
// Only Tailwind classes here: the legacy unlayered .footer-top / .footer-bottom rules in
// globals.css would override them, so those class names are not used any more.
const title = 'font-display text-lg font-semibold text-stone-900'
const body = 'text-sm leading-relaxed text-stone-600'
const link = 'font-medium text-[#3E2723] underline-offset-4 transition-colors hover:text-[#B45309] hover:underline'

function Row({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

export function CoffeeFooter({ storeDomain }: { storeDomain?: string }) {
  const year = new Date().getFullYear()
  return (
    <footer id="locations" className="border-t border-stone-300/60 bg-[#ede6db] text-stone-800">
      <div className="section-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-12">
        {/* Brand */}
        <div className="space-y-4">
          <a href="#" aria-label="Đà Lạt Cafe – về đầu trang" className="inline-block">
            <Logo tagline="Cà phê & cộng đồng" />
          </a>
          <p className={`${body} max-w-xs`}>
            Dành trọn tình yêu cho cà phê, cho những điều giản dị trong cuộc sống. Đến vì hương cà phê, ở lại vì sự gắn kết.
          </p>
        </div>

        {/* Visit */}
        <div className="space-y-4">
          <h3 className={title}>Ghé quán</h3>
          <ul className={`${body} space-y-3`}>
            <Row icon={MapPin}>Phường Cam Ly, TP. Đà Lạt, Lâm Đồng</Row>
            <Row icon={Clock}>
              Mở cửa mỗi ngày
              <br />
              <span className="font-medium text-stone-800">07:00 – 22:00</span>
            </Row>
          </ul>
          <a
            href="https://www.google.com/maps/search/specialty+coffee+Da+Lat+Vietnam"
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 text-sm ${link}`}
          >
            Xem bản đồ <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className={title}>Liên hệ</h3>
          <ul className={`${body} space-y-3`} aria-label="Liên hệ chi nhánh">
            <Row icon={Phone}>
              <span className="block text-xs uppercase tracking-wider text-stone-500">Hotline</span>
              <a href="tel:0988752291" className={`${link} tabular-nums`}>
                0988 752 291
              </a>
            </Row>
            <Row icon={Mail}>
              <span className="block text-xs uppercase tracking-wider text-stone-500">Email</span>
              <a href="mailto:2312585@dlu.edu.vn" className={`${link} break-all`}>
                2312585@dlu.edu.vn
              </a>
            </Row>
          </ul>
        </div>

        {/* Explore, or the newsletter when a Shopify store is connected */}
        <div className="space-y-4">
          {storeDomain ? (
            <>
              <h3 className={title}>Nhận bản tin</h3>
              <p className={body}>Mẻ rang mới và chuyện kể từ quầy bar, gửi tới hộp thư của bạn.</p>
              <form
                className="flex h-11 items-center overflow-hidden rounded-full border border-stone-300 bg-white focus-within:ring-2 focus-within:ring-amber-600/40"
                action={`https://${storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/contact#contact_form`}
                method="post"
                target="_blank"
              >
                <input type="hidden" name="form_type" value="customer" />
                <input type="hidden" name="utf8" value="✓" />
                <input type="hidden" name="contact[tags]" value="newsletter" />
                <label className="sr-only" htmlFor="newsletter-email">
                  Địa chỉ email
                </label>
                <input
                  id="newsletter-email"
                  name="contact[email]"
                  type="email"
                  required
                  placeholder="Email của bạn"
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
              <p className="text-xs text-stone-500">Khi đăng ký, bạn đồng ý nhận bản tin định kỳ từ Đà Lạt Cafe.</p>
            </>
          ) : (
            <>
              <h3 className={title}>Khám phá</h3>
              <ul className={`${body} space-y-2.5`}>
                <li>
                  <a href="#menu" className={link}>Thực đơn</a>
                </li>
                <li>
                  <a href="#story" className={link}>Câu chuyện của chúng tôi</a>
                </li>
                <li>
                  <a href="#journal" className={link}>Góc cà phê</a>
                </li>
                <li>
                  <a href="/register" className={link}>Tạo tài khoản tích điểm</a>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="section-shell flex flex-col gap-3 border-t border-stone-300/60 py-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
        <span>© {year} Đà Lạt Cafe. Tận tâm chế tác, thưởng thức chậm rãi.</span>
        <a href="/admin" className={`inline-flex items-center gap-1 ${link} text-xs`} title="Staff portal">
          Dành cho nhân viên <span className="sr-only">Staff portal</span> <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      </div>
    </footer>
  )
}
