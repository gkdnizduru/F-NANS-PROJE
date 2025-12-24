import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../theme-provider'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  ShoppingBag,
  Kanban,
  Calendar,
  FileSignature,
  FileText,
  Users,
  Settings,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  headerRight?: React.ReactNode
}

type SidebarItem = {
  path?: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

type SidebarGroup = {
  id: 'finance' | 'other'
  title: string
  defaultOpen: boolean
  items: SidebarItem[]
}

const sidebarGroups: SidebarGroup[] = [
  {
    id: 'finance',
    title: 'FİNANS & MUHASEBE',
    defaultOpen: true,
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/kasa-banka', label: 'Kasa & Banka', icon: Wallet },
      { path: '/finans', label: 'Finans', icon: Banknote },
      { path: '/firsatlar', label: 'Fırsatlar', icon: Kanban },
      { path: '/teklifler', label: 'Teklifler', icon: FileSignature },
      { path: '/faturalar', label: 'Faturalar', icon: FileText },
      { path: '/musteriler', label: 'Müşteriler', icon: Users },
      { path: '/urun-hizmet', label: 'Ürün/Hizmet', icon: ShoppingBag },
    ],
  },
  {
    id: 'other',
    title: 'DİĞER',
    defaultOpen: true,
    items: [
      { path: '/aktiviteler', label: 'Aktiviteler', icon: Calendar },
      { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
    ],
  },
]

const getDefaultOpenGroups = (): Record<SidebarGroup['id'], boolean> => ({
  finance: sidebarGroups.find((g) => g.id === 'finance')?.defaultOpen ?? true,
  other: sidebarGroups.find((g) => g.id === 'other')?.defaultOpen ?? true,
})

export function AppLayout({ children, title = 'Dashboard', headerRight }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved ? (JSON.parse(saved) as boolean) : false
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroup['id'], boolean>>(() => {
    const defaults = getDefaultOpenGroups()

    try {
      const saved = localStorage.getItem('sidebar-open-groups')
      if (!saved) return defaults
      const parsed = JSON.parse(saved) as Partial<Record<SidebarGroup['id'], unknown>>

      return {
        finance: typeof parsed.finance === 'boolean' ? parsed.finance : defaults.finance,
        other: typeof parsed.other === 'boolean' ? parsed.other : defaults.other,
      }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed))
    } catch {
      // ignore
    }
  }, [isCollapsed])

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-open-groups', JSON.stringify(openGroups))
    } catch {
      // ignore
    }
  }, [openGroups])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
    const flatItems = sidebarGroups.flatMap((g) => g.items)

    const renderItem = (item: SidebarItem) => {
      const Icon = item.icon

      if (item.disabled) {
        return (
          <div
            key={item.label}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'h-10 justify-center px-2' : 'gap-3 px-3 py-2.5',
              'text-muted-foreground/60 cursor-not-allowed'
            )}
            title={collapsed ? item.label : 'Yakında'}
          >
            <Icon className="h-5 w-5" />
            {!collapsed && item.label}
          </div>
        )
      }

      return (
        <NavLink
          key={item.path}
          to={item.path as string}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'h-10 justify-center px-2' : 'gap-3 px-3 py-2.5',
              isActive
                ? collapsed
                  ? 'bg-primary/15 text-primary'
                  : 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
          title={collapsed ? item.label : undefined}
        >
          <Icon className="h-5 w-5" />
          {!collapsed && item.label}
        </NavLink>
      )
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            'flex h-16 items-center border-b border-border',
            collapsed ? 'justify-center px-2' : 'px-6'
          )}
        >
          <h1 className={cn('font-bold tracking-tight', collapsed ? 'text-lg' : 'text-xl')}>
            {collapsed ? 'ERP' : 'ERP Panel'}
          </h1>
        </div>

        <nav className={cn('flex-1 min-h-0 overflow-y-auto space-y-1', collapsed ? 'p-2' : 'p-4')}>
          {collapsed ? (
            flatItems.map(renderItem)
          ) : (
            <div className="space-y-2">
              {sidebarGroups.map((group) => {
                const isOpen = openGroups[group.id]

                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-semibold tracking-wider text-muted-foreground transition-colors',
                        'hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          isOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </button>

                    {isOpen && <div className="space-y-1 pt-1">{group.items.map(renderItem)}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </nav>

        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.full_name || 'Kullanıcı'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          )}

          <div className={cn('flex gap-2', collapsed ? 'flex-col' : 'flex-row')}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn(
                collapsed ? 'h-10 w-10' : 'flex-1 justify-start',
                'text-muted-foreground'
              )}
              onClick={toggleTheme}
              title="Tema Değiştir"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span className="ml-2">Tema</span>}
            </Button>

            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn(
                collapsed ? 'h-10 w-10' : 'flex-1 justify-start',
                'text-muted-foreground'
              )}
              onClick={handleLogout}
              title="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Çıkış Yap</span>}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen border-r border-border bg-background transition-all duration-300 md:block',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent collapsed={isCollapsed} />
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300',
          isCollapsed ? 'md:pl-16' : 'md:pl-64'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2">
              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menü</span>
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SidebarContent
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              {/* Desktop collapse */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setIsCollapsed((v) => !v)}
                title={isCollapsed ? 'Sidebar Aç' : 'Sidebar Kapat'}
              >
                <ChevronLeft
                  className={cn(
                    'h-5 w-5 transition-transform duration-300',
                    isCollapsed ? 'rotate-180' : 'rotate-0'
                  )}
                />
              </Button>

              <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
              {headerRight}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
