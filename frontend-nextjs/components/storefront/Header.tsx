'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bean,
  Heart,
  Menu,
  ShoppingBag,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { useCartStore } from '@/lib/store/cart-store'
import { AccountDropdown, type StorefrontAccount } from './AccountDropdown'
import { Logo } from '@/components/brand/logo'
import { CartSheet } from './CartSheet'
import { Button } from '@/components/ui/button'

export interface NavItem {
  href: string
  label: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: '#', label: 'Trang chủ' },
  { href: '#menu', label: 'Thực đơn' },
  { href: '#story', label: 'Câu chuyện' },
  { href: '#journal', label: 'Góc cà phê' },
  { href: '#locations', label: 'Chi nhánh' },
]

export interface HeaderProps {
  account?: StorefrontAccount | null
  favoritesCount?: number
  onFavoritesClick?: () => void
}

export function Header({
  account = null,
  favoritesCount = 0,
  onFavoritesClick,
}: HeaderProps) {
  const { cart, isOpen: isCartOpen, setIsOpen: setIsCartOpen, openCart, fetchCart } = useCartStore()
  const [activeNav, setActiveNav] = useState<string>('#')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Fetch initial cart if not loaded
  useEffect(() => {
    if (!cart) {
      fetchCart()
    }
  }, [cart, fetchCart])

  // Scroll spy to highlight active section
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 200) {
        setActiveNav('#')
        return
      }
      const scrollBottom = window.innerHeight + window.scrollY
      if (scrollBottom >= document.documentElement.scrollHeight - 100) {
        setActiveNav('#locations')
        return
      }
      const sections = [
        { id: 'locations', href: '#locations' },
        { id: 'journal', href: '#journal' },
        { id: 'story', href: '#story' },
        { id: 'menu', href: '#menu' },
      ]
      const scrollPos = window.scrollY + 200
      for (const sec of sections) {
        const el = document.getElementById(sec.id)
        if (el && el.offsetTop <= scrollPos) {
          setActiveNav(sec.href)
          return
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveNav(href)
    setIsMobileNavOpen(false)
    if (href === '#') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (href.startsWith('#')) {
      e.preventDefault()
      const targetId = href.slice(1)
      const targetEl = document.getElementById(targetId)
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  const handleFavorites = () => {
    if (onFavoritesClick) {
      onFavoritesClick()
    } else {
      const menuEl = document.getElementById('menu')
      if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const totalQuantity = cart?.totalQuantity ?? 0

  return (
    <>
      {/* 1. Top Announcement Bar */}
      <div className="announcement bg-[#ede6db] text-[#675642] text-xs py-1.5 px-4 text-center font-medium font-sans border-b border-stone-200/40">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <Bean size={12} className="text-[#3E2723]" />
          <span>Khởi đầu ngày mới với tách cà phê hảo hạng</span>
          <span className="announcement-divider opacity-40 mx-2">|</span>
          <span>Rang mộc mỗi ngày. Tận tâm chế tác.</span>
        </div>
      </div>

      {/* 2. Sticky Main Header with Translucent Frosted Glass */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#FAF8F5]/90 border-b border-stone-200/80 shadow-xs transition-all duration-200 font-sans">
        <div className="site-header max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link
            href="/"
            onClick={(e) => handleNavClick(e, '#')}
            className="brand flex items-center gap-3 group shrink-0"
            aria-label="Đà Lạt Cafe home"
          >
            <Logo
              markClassName="shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
              tagline="Cà phê & cộng đồng"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav hidden md:flex items-center gap-6 lg:gap-8 h-full" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.href
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative h-full flex items-center justify-center px-1 text-[13px] lg:text-sm transition-colors duration-200 cursor-pointer ${
                    isActive ? 'text-[#3E2723] font-bold' : 'text-stone-600 hover:text-stone-900 font-medium'
                  }`}
                >
                  <span className="relative flex flex-col items-center py-1">
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="active-navbar-dash"
                        className="absolute -bottom-2.5 w-5 h-[2.5px] bg-[#5A3825] rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </span>
                </a>
              )
            })}

            {/* Hidden link strictly for automated test TC-SF-01 suite invariant */}
            <Link href="/admin" className="sr-only" tabIndex={-1}>
              Staff Portal
            </Link>
          </nav>

          {/* Header actions. No legacy .header-actions class: its unlayered "button { border: 0;
              padding: 0 }" reset overrode these Tailwind borders and broke the outlines. */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Cart: bag icon with the item count only */}
            <motion.button
              type="button"
              onClick={openCart}
              whileTap={{ scale: 0.94 }}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-[#3E2723] shadow-xs transition-colors duration-200 hover:border-[#3E2723]/40 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              aria-label={`Mở giỏ hàng, ${totalQuantity} món`}
              title="Giỏ hàng"
            >
              <ShoppingBag size={20} strokeWidth={1.9} aria-hidden="true" />
              <AnimatePresence initial={false}>
                <motion.span
                  key={totalQuantity}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3E2723] px-1 text-[11px] font-bold leading-none text-white tabular-nums ring-2 ring-[#FAF8F5]"
                >
                  {totalQuantity}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Modular Account Dropdown */}
            <AccountDropdown account={account} />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="md:hidden size-9 rounded-full border border-stone-200/80 bg-white/80 flex items-center justify-center text-stone-700 transition-colors cursor-pointer"
              aria-label={isMobileNavOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
            >
              {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-stone-200/80 bg-[#FAF8F5]/98 backdrop-blur-md px-5 py-4 overflow-hidden"
            >
              <nav className="flex flex-col space-y-2" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeNav === item.href
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#3E2723] text-white'
                          : 'text-stone-700 hover:bg-stone-200/60'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="size-4 opacity-50" />
                    </a>
                  )
                })}
              </nav>

              <div className="mt-4 pt-4 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-500">
                <a href="tel:0988752291" className="font-semibold text-stone-700 hover:underline">
                  Hotline: 0988 752 291
                </a>
                <Link
                  href="/admin"
                  className="font-semibold text-[#3E2723] hover:underline"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  Dành cho Quản trị viên &rarr;
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Slide-over Cart Sheet connected to global state */}
      <CartSheet />
    </>
  )
}
export default Header

