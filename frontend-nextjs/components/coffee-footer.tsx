import { ArrowUpRight, Coffee, MapPin } from 'lucide-react'

export function CoffeeFooter({ storeDomain }: { storeDomain?: string }) {
  return (
    <footer id="locations" className="bg-[#ede6db] border-t border-stone-200/80 text-stone-800">
      <div className="footer-top section-shell">
        <div>
          <a className="brand" href="#">
            <Coffee size={27} />
            <span>
              Đà Lạt Cafe<small>CÀ PHÊ & CỘNG ĐỒNG</small>
            </span>
          </a>
          <p>
            Dành trọn tình yêu cho cà phê.
            <br />
            Cho những điều giản dị trong cuộc sống.
          </p>
        </div>

        <div>
          <h3>
            Đến vì hương cà phê.
            <br />
            Ở lại vì sự gắn kết.
          </h3>
          <p>Khám phá văn hóa cà phê đặc sản Đà Lạt & Tây Nguyên.</p>
          <a
            className="footer-map font-semibold text-[#3E2723] hover:underline"
            href="https://www.google.com/maps/search/specialty+coffee+Da+Lat+Vietnam"
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={18} /> Khám phá vùng cà phê Đà Lạt <ArrowUpRight size={16} />
          </a>
          <small className="text-stone-500">Thông tin chi nhánh mới sẽ sớm được cập nhật.</small>
        </div>

        <div>
          <h3>Nhận bản tin cà phê sớm nhất.</h3>
          <p>Mẻ rang mới, những phút giây lắng đọng và chuyện kể từ quầy bar.</p>
          {storeDomain && (
            <form
              className="newsletter-form"
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
                placeholder="Nhập địa chỉ email của bạn..."
              />
              <button type="submit" aria-label="Đăng ký nhận bản tin">
                <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          <small className="text-stone-500">
            Khi đăng ký, bạn đồng ý nhận bản tin cập nhật định kỳ từ Đà Lạt Cafe.
          </small>
        </div>
      </div>

      <div className="footer-bottom section-shell">
        <span>© {new Date().getFullYear()} Đà Lạt Cafe</span>
        <span>Tận tâm chế tác. Thưởng thức chậm rãi.</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="#story" className="hover:text-stone-900 transition-colors">
            Câu chuyện của chúng tôi <ArrowUpRight size={12} />
          </a>
          <a href="/admin" className="hover:text-stone-900 transition-colors" title="Staff portal">
            Dành cho nhân viên <span className="sr-only">Staff portal</span> <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </footer>
  )
}
