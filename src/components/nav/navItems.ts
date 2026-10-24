import { BookOpen, Brush, GalleryVerticalEnd, Home, MessageCircle, Shapes, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  key: string
  icon: LucideIcon
  mobile?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', key: 'home', icon: Home },
  { to: '/practice', key: 'practice', icon: Shapes, mobile: true },
  { to: '/free-draw', key: 'freeDraw', icon: Brush, mobile: true },
  { to: '/learn', key: 'learn', icon: BookOpen, mobile: true },
  { to: '/chat', key: 'chat', icon: MessageCircle, mobile: true },
  { to: '/collection', key: 'collection', icon: GalleryVerticalEnd, mobile: true },
]
