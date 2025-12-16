import { AppLayout } from '../components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  FileText,
  Users,
  Briefcase,
} from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfDay,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { useAccounts, useCustomers, useDeals } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

type DateRange = {
  from?: Date
  to?: Date
}

type TransactionRow = Database['public']['Tables']['transactions']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type DealRow = Database['public']['Tables']['deals']['Row']

export function DashboardPage() {
  const navigate = useNavigate()
  const now = new Date()

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [accountFilterOpen, setAccountFilterOpen] = useState(false)
  const [accountFilterQuery, setAccountFilterQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfMonth(now),
    to: endOfMonth(now),
  }))

  const accountsQuery = useAccounts()
  const customersQuery = useCustomers()
  const dealsQuery = useDeals()
  const accounts = accountsQuery.data ?? []
  const customers = customersQuery.data ?? []
  const deals = dealsQuery.data ?? []

  const dateFromStr = useMemo(() => {
    return dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange.from])

  const dateToStr = useMemo(() => {
    return dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange.to])

  const selectedAccountKey = useMemo(() => {
    if (selectedAccountIds.length === 0) return 'all'
    return selectedAccountIds.slice().sort().join(',')
  }, [selectedAccountIds])

  const transactionsQuery = useQuery<TransactionRow[]>({
    queryKey: ['dashboard_transactions', selectedAccountKey, dateFromStr, dateToStr],
    enabled: Boolean(dateFromStr && dateToStr),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (selectedAccountIds.length > 0) {
        q = q.in('bank_account', selectedAccountIds)
      }

      if (dateFromStr) {
        q = q.gte('transaction_date', dateFromStr)
      }

      if (dateToStr) {
        q = q.lte('transaction_date', dateToStr)
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const invoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ['dashboard_invoices', dateFromStr, dateToStr],
    enabled: Boolean(dateFromStr && dateToStr),
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })

      if (dateFromStr) {
        q = q.gte('invoice_date', dateFromStr)
      }

      if (dateToStr) {
        q = q.lte('invoice_date', dateToStr)
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const transactions = transactionsQuery.data ?? []
  const invoices = invoicesQuery.data ?? []

  const actionInvoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ['dashboard_action_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(25)

      if (error) throw error
      return data ?? []
    },
  })

  const accountsById = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]))
  }, [accounts])

  const customersById = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]))
  }, [customers])

  const stageLabels: Record<DealRow['stage'], string> = {
    new: 'Yeni Fırsat',
    meeting: 'Toplantı',
    proposal: 'Teklif',
    negotiation: 'Pazarlık',
    won: 'Kazanıldı',
    lost: 'Kaybedildi',
  }

  const activeStages: DealRow['stage'][] = ['new', 'meeting', 'proposal', 'negotiation']

  const pipelineSummary = useMemo(() => {
    const map = new Map<DealRow['stage'], { stage: DealRow['stage']; count: number; total: number }>()
    for (const s of activeStages) {
      map.set(s, { stage: s, count: 0, total: 0 })
    }

    for (const d of deals) {
      if (!activeStages.includes(d.stage)) continue
      const curr = map.get(d.stage) ?? { stage: d.stage, count: 0, total: 0 }
      curr.count += 1
      curr.total += Number(d.value ?? 0)
      map.set(d.stage, curr)
    }

    const rows = activeStages.map((s) => map.get(s)!).filter(Boolean)
    const pipelineTotal = rows.reduce((acc, r) => acc + r.total, 0)
    const maxStageTotal = Math.max(1, ...rows.map((r) => r.total))
    return { rows, pipelineTotal, maxStageTotal }
  }, [deals])

  const actionInvoices = actionInvoicesQuery.data ?? []
  const { overdueInvoices, upcomingInvoices } = useMemo(() => {
    const today = startOfDay(new Date())
    const upcomingLimit = addDays(today, 7)

    const overdue: InvoiceRow[] = []
    const upcoming: InvoiceRow[] = []

    for (const inv of actionInvoices) {
      if (inv.status === 'paid') continue
      const due = parseISO(inv.due_date)
      if (due < today) overdue.push(inv)
      else if (due <= upcomingLimit) upcoming.push(inv)
    }

    return {
      overdueInvoices: overdue.slice(0, 8),
      upcomingInvoices: upcoming.slice(0, 8),
    }
  }, [actionInvoices])

  const filteredAccounts = useMemo(() => {
    const q = accountFilterQuery.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => a.name.toLowerCase().includes(q))
  }, [accountFilterQuery, accounts])

  const accountFilterLabel = useMemo(() => {
    if (selectedAccountIds.length === 0) return 'Tüm Hesaplar'
    if (selectedAccountIds.length === 1) {
      const id = selectedAccountIds[0]
      return accountsById.get(id)?.name ?? '1 Hesap Seçildi'
    }
    return `${selectedAccountIds.length} Hesap Seçildi`
  }, [accountsById, selectedAccountIds])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 'Tarih Aralığı'
    const from = format(dateRange.from, 'd MMM', { locale: tr })
    const to = format(dateRange.to, 'd MMM', { locale: tr })
    return `${from} - ${to}`
  }, [dateRange.from, dateRange.to])

  const headerRight = (
    <div className="flex items-center gap-2">
      <div className="w-[200px]">
        <Popover open={accountFilterOpen} onOpenChange={setAccountFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={accountFilterOpen}
              disabled={accountsQuery.isLoading || accountsQuery.isError}
              className={cn('h-9 w-full bg-white dark:bg-background justify-between border-border/50 shadow-sm', selectedAccountIds.length === 0 && 'text-muted-foreground')}
            >
              <span className="truncate">{accountsQuery.isLoading ? 'Yükleniyor...' : accountFilterLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
            <Command value={accountFilterQuery} onValueChange={setAccountFilterQuery}>
              <CommandInput placeholder="Hesap ara..." />
              <CommandList>
                {filteredAccounts.length === 0 ? (
                  <CommandEmpty>Sonuç bulunamadı</CommandEmpty>
                ) : null}
                <CommandGroup>
                  <CommandItem
                    selected={selectedAccountIds.length === 0}
                    onClick={() => setSelectedAccountIds([])}
                    className="flex items-center gap-2"
                  >
                    <Check className={cn('h-4 w-4', selectedAccountIds.length === 0 ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">Tüm Hesaplar</span>
                  </CommandItem>

                  {filteredAccounts.map((a) => {
                    const isSelected = selectedAccountIds.includes(a.id)
                    return (
                      <CommandItem
                        key={a.id}
                        selected={isSelected}
                        onClick={() =>
                          setSelectedAccountIds((prev) =>
                            prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                          )
                        }
                        className="flex items-center gap-2"
                      >
                        <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{a.name}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('h-9 bg-white dark:bg-background justify-start text-left font-normal border-border/50 shadow-sm', !dateRange.from && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRangeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <div className="flex flex-wrap gap-2 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ from: now, to: now })}
            >
              Bugün
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setDateRange({
                  from: startOfWeek(now, { weekStartsOn: 1 }),
                  to: endOfWeek(now, { weekStartsOn: 1 }),
                })
              }
            >
              Bu Hafta
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
            >
              Bu Ay
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const prev = subMonths(now, 1)
                setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) })
              }}
            >
              Geçen Ay
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
            >
              Bu Yıl
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Başlangıç</div>
              <Calendar
                selected={dateRange.from}
                locale={tr}
                onSelect={(d) => {
                  if (!d) return
                  setDateRange((prev) => {
                    const to = prev.to
                    if (to && d > to) {
                      return { from: to, to: d }
                    }
                    return { from: d, to: to ?? d }
                  })
                }}
              />
            </div>
            <div>
              <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Bitiş</div>
              <Calendar
                selected={dateRange.to}
                locale={tr}
                onSelect={(d) => {
                  if (!d) return
                  setDateRange((prev) => {
                    const from = prev.from
                    if (from && d < from) {
                      return { from: d, to: from }
                    }
                    return { from: from ?? d, to: d }
                  })
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Fatura Kes"
          aria-label="Fatura Kes"
          onClick={() => navigate('/invoices/new')}
          className="h-9 w-9"
        >
          <FileText className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Müşteri Ekle"
          aria-label="Müşteri Ekle"
          onClick={() => navigate('/musteriler', { state: { openNew: true } })}
          className="h-9 w-9"
        >
          <Users className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Fırsat Ekle"
          aria-label="Fırsat Ekle"
          onClick={() => navigate('/firsatlar', { state: { openNew: true } })}
          className="h-9 w-9"
        >
          <Briefcase className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const { totalIncome, totalExpense, netProfit } = useMemo(() => {
    let income = 0
    let expense = 0

    for (const t of transactions) {
      const amount = Number(t.amount ?? 0)
      if (t.type === 'income') income += amount
      if (t.type === 'expense') expense += amount
    }

    return {
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
    }
  }, [transactions])

  const pendingDebt = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== 'paid')
      .reduce((acc, inv) => acc + Number(inv.total_amount ?? 0), 0)
  }, [invoices])

  const incomeExpenseData = useMemo(() => {
    const byMonth = new Map<string, { gelir: number; gider: number }>()

    for (const t of transactions) {
      const d = new Date(t.transaction_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prev = byMonth.get(key) ?? { gelir: 0, gider: 0 }
      const amount = Number(t.amount ?? 0)
      if (t.type === 'income') prev.gelir += amount
      if (t.type === 'expense') prev.gider += amount
      byMonth.set(key, prev)
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, v]) => ({ month, gelir: v.gelir, gider: v.gider }))
  }, [transactions])

  const expenseCategoryData = useMemo(() => {
    const totals = new Map<string, number>()

    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const key = t.category || 'Diğer'
      totals.set(key, (totals.get(key) ?? 0) + Number(t.amount ?? 0))
    }

    const palette = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#64748b',
    ]

    return Array.from(totals.entries())
      .map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions])

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 10)
  }, [transactions])

  return (
    <AppLayout title="Dashboard" headerRight={headerRight}>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Toplam Gelir
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Toplam
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Toplam Gider
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalExpense)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Toplam
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Kar
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(netProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Toplam
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bekleyen Borç
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pendingDebt)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Toplam
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Income vs Expense Chart */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Gelir vs Gider</CardTitle>
            </CardHeader>
            <CardContent>
              {incomeExpenseData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">Görüntülenecek veri yok</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={incomeExpenseData}>
                    <defs>
                      <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="gelir" stroke="#10b981" fillOpacity={1} fill="url(#colorGelir)" />
                    <Area type="monotone" dataKey="gider" stroke="#ef4444" fillOpacity={1} fill="url(#colorGider)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Sales Pipeline Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Satış Hunisi</CardTitle>
            </CardHeader>
            <CardContent>
              {dealsQuery.isLoading ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">Yükleniyor...</p>
                </div>
              ) : pipelineSummary.rows.every((r) => r.count === 0) ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">Aktif fırsat bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Toplam Pipeline</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">
                      {formatCurrency(pipelineSummary.pipelineTotal)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {pipelineSummary.rows.map((r) => {
                      const barPct = Math.round((r.total / pipelineSummary.maxStageTotal) * 100)
                      return (
                        <div key={r.stage} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {stageLabels[r.stage]}
                                <span className="text-xs text-muted-foreground"> • {r.count} fırsat</span>
                              </div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {formatCurrency(r.total)}
                              </div>
                            </div>
                            <div className="w-24 shrink-0">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-primary/70"
                                  style={{ width: `${Math.max(4, barPct)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gider Kategorileri</CardTitle>
            </CardHeader>
            <CardContent>
              {expenseCategoryData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">Görüntülenecek veri yok</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        strokeWidth={0}
                      >
                        {expenseCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {expenseCategoryData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium">₺{item.value.toLocaleString('tr-TR')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="transactions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="whitespace-nowrap">Hareketler</CardTitle>
                <TabsList className="h-9">
                  <TabsTrigger value="transactions" className="h-8">
                    Son İşlemler
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="h-8">
                    Tahsilat Alarmı
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="transactions" className="mt-0">
                  {recentTransactions.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">Henüz işlem bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentTransactions.map((t) => {
                        const accountName = t.bank_account ? accountsById.get(t.bank_account)?.name : undefined
                        const amount = Number(t.amount ?? 0)
                        const isIncome = t.type === 'income'

                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {t.category}
                                {accountName ? ` • ${accountName}` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatShortDate(t.transaction_date)}</p>
                            </div>
                            <div
                              className={cn(
                                'text-sm font-semibold tabular-nums',
                                isIncome ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {isIncome ? '+' : '-'} {formatCurrency(amount)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-0">
                  {actionInvoicesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">Yükleniyor...</p>
                    </div>
                  ) : overdueInvoices.length === 0 && upcomingInvoices.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">Kritik tahsilat bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {overdueInvoices.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-red-600">Gecikmiş</div>
                          {overdueInvoices.map((inv) => {
                            const customerName = customersById.get(inv.customer_id)?.name ?? 'Müşteri'
                            const due = parseISO(inv.due_date)
                            const days = Math.max(1, differenceInCalendarDays(startOfDay(new Date()), due))
                            return (
                              <div key={inv.id} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{customerName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Vade: {formatShortDate(inv.due_date)} • {days} gün gecikti
                                  </div>
                                </div>
                                <div className="text-sm font-semibold tabular-nums text-red-600">
                                  {formatCurrency(Number(inv.total_amount ?? 0))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {upcomingInvoices.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-orange-600">Yaklaşan (7 gün)</div>
                          {upcomingInvoices.map((inv) => {
                            const customerName = customersById.get(inv.customer_id)?.name ?? 'Müşteri'
                            const due = parseISO(inv.due_date)
                            const daysLeft = Math.max(0, differenceInCalendarDays(due, startOfDay(new Date())))
                            return (
                              <div key={inv.id} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{customerName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Vade: {formatShortDate(inv.due_date)} • {daysLeft} gün kaldı
                                  </div>
                                </div>
                                <div className="text-sm font-semibold tabular-nums text-orange-600">
                                  {formatCurrency(Number(inv.total_amount ?? 0))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}
