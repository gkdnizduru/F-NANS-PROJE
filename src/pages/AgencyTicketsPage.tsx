import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { AppLayout } from '../components/layout/AppLayout'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import {
  useCreateTicket,
  useCustomers,
  useDeleteTicket,
  useInvoiceTicket,
  useTicketsByDateRange,
  useUpdateTicketStatus,
  type TicketRow,
  type TicketStatus,
} from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import { cn } from '../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Calendar as CalendarIcon, CheckCircle2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { TicketForm } from '@/components/forms/TicketForm'

type DateRange = {
  from?: Date
  to?: Date
}

type TicketPrefill = Partial<{
  status: TicketStatus
  pnr_code: string
  issue_date: Date
  base_fare: number
  tax_amount: number
  service_fee: number
  passengers: Array<{ passenger_name: string; ticket_number: string; passenger_type: string }>
  segments: Array<{ airline: string; flight_no: string; origin: string; destination: string; flight_date: Date }>
}>

const tabLabels: Record<TicketStatus, string> = {
  sales: 'Bilet Listesi',
  void: 'Void Listesi',
  refund: 'İade Listesi',
}

const statusBadgeClasses: Record<TicketStatus, string> = {
  sales: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  void: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/20',
  refund: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

const statusLabels: Record<TicketStatus, string> = {
  sales: 'Satış',
  void: 'Void',
  refund: 'İade',
}

function parsePnrText(raw: string): TicketPrefill {
  const original = String(raw ?? '').trim()
  let remaining = ` ${original} `

  const monthMap: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  }

  const prefill: TicketPrefill = {
    status: 'sales',
    issue_date: new Date(),
    base_fare: 0,
    tax_amount: 0,
    service_fee: 0,
    passengers: [],
    segments: [],
  }

  const removeToken = (token: string) => {
    if (!token) return
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    remaining = remaining.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), ' ')
  }

  const takeAll = (re: RegExp) => {
    const upperNow = remaining.toUpperCase()
    return Array.from(upperNow.matchAll(re)).map((m) => m[0])
  }

  const takeFirst = (re: RegExp) => {
    const upperNow = remaining.toUpperCase()
    const m = upperNow.match(re)
    return m?.[0] ?? null
  }

  // 1) DATE FIRST
  const dateTokens = takeAll(/\b\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi)
  const parsedDates: Date[] = []
  for (const tok of dateTokens) {
    const mm = tok.match(/\b(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i)
    if (!mm) continue
    const day = Number(mm[1])
    const mon = monthMap[mm[2].toUpperCase()]
    const year = new Date().getFullYear()
    const d = new Date(year, mon, day)
    if (!Number.isNaN(d.getTime())) parsedDates.push(d)
    removeToken(tok)
  }

  // 2) TICKET NUMBER (prefer 13 digits, else longest)
  const ticket13 = takeFirst(/\b\d{13}\b/)
  let ticketNumber = ''
  if (ticket13) {
    ticketNumber = ticket13
    removeToken(ticket13)
  } else {
    const nums = takeAll(/\b\d+\b/g)
      .filter((x) => x.length >= 6)
      .sort((a, b) => b.length - a.length)
    if (nums.length) {
      ticketNumber = nums[0]
      removeToken(nums[0])
    }
  }

  // 3) ROUTE
  let origin = ''
  let destination = ''
  const routeDash = takeFirst(/\b[A-Z]{3}-[A-Z]{3}\b/)
  if (routeDash) {
    origin = routeDash.slice(0, 3)
    destination = routeDash.slice(4, 7)
    removeToken(routeDash)
  } else {
    const routeCompact = takeFirst(/\b[A-Z]{6}\b/)
    if (routeCompact) {
      origin = routeCompact.slice(0, 3)
      destination = routeCompact.slice(3, 6)
      removeToken(routeCompact)
    }
  }

  // 4) AIRLINE
  let airlineName = ''
  const airlineTok = takeFirst(/\b(THY|TK|PC|VF|AJET|TURKISH|PEGASUS)\b/)
  if (airlineTok) {
    const code = airlineTok.toUpperCase()
    if (code === 'THY' || code === 'TURKISH' || code === 'TK') airlineName = 'THY'
    else if (code === 'PEGASUS' || code === 'PC') airlineName = 'Pegasus'
    else if (code === 'AJET' || code === 'VF') airlineName = 'AJet'
    removeToken(airlineTok)
  }

  // (optional) flight no, remove before PNR so it doesn't get picked
  const flightNoTok = takeFirst(/\b[A-Z]{2}\s?\d{3,4}\b/)
  const flightNo = flightNoTok ? flightNoTok.replace(/\s+/g, '') : ''
  if (flightNoTok) removeToken(flightNoTok)

  // 5) PNR (now safe)
  const pnrTok = takeFirst(/\b[A-Z0-9]{4,6}\b/)
  if (pnrTok) {
    prefill.pnr_code = pnrTok.toUpperCase()
    removeToken(pnrTok)
  }

  // 6) NAME = remaining text
  remaining = remaining.replace(/\b\d+\b/g, ' ')
  const name = remaining.replace(/\s+/g, ' ').trim()

  prefill.passengers = [
    {
      passenger_name: name,
      ticket_number: ticketNumber,
      passenger_type: 'ADT',
    },
  ]

  prefill.segments = [
    {
      airline: airlineName,
      flight_no: flightNo,
      origin,
      destination,
      flight_date: parsedDates[0] ?? new Date(),
    },
  ]

  return prefill
}

export function AgencyTicketsPage() {
  const [activeTab, setActiveTab] = useState<TicketStatus>('sales')
  const [open, setOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketRow | null>(null)
  const [deletingTicket, setDeletingTicket] = useState<TicketRow | null>(null)

  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [prefill, setPrefill] = useState<TicketPrefill | undefined>(undefined)

  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const dateFromStr = useMemo(() => {
    return dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange?.from])

  const dateToStr = useMemo(() => {
    return dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange?.to])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Tarih Aralığı'
    const from = format(dateRange.from, 'd MMM', { locale: tr })
    const to = format(dateRange.to, 'd MMM', { locale: tr })
    return `${from} - ${to}`
  }, [dateRange?.from, dateRange?.to])

  const ticketsQuery = useTicketsByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const createTicket = useCreateTicket()
  const deleteTicket = useDeleteTicket()
  const invoiceTicket = useInvoiceTicket()
  const updateTicketStatus = useUpdateTicketStatus()

  const tickets: TicketRow[] = ticketsQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const stats = useMemo(() => {
    const byStatus: Record<TicketStatus, number> = { sales: 0, void: 0, refund: 0 }
    const invoiceCounts: { pending: number; invoiced: number } = { pending: 0, invoiced: 0 }

    let sellSum = 0
    let feeSum = 0

    for (const t of tickets) {
      const st = t.status
      if (st === 'sales' || st === 'void' || st === 'refund') {
        byStatus[st] += 1
      }

      if (st === 'sales') {
        const base = Number(t.base_fare ?? 0)
        const tax = Number(t.tax_amount ?? 0)
        const fee = Number(t.service_fee ?? 0)
        sellSum += base + tax + fee
        feeSum += fee
      }

      const inv = String(t.invoice_status ?? '')
      if (inv === 'pending') invoiceCounts.pending += 1
      else if (inv === 'invoiced') invoiceCounts.invoiced += 1
    }

    return { byStatus, sellSum, feeSum, invoiceCounts }
  }, [tickets])

  const filteredTickets = useMemo<TicketRow[]>(() => {
    const q = searchQuery.trim().toLowerCase()

    return tickets
      .filter((t) => t.status === activeTab)
      .filter((t) => {
        if (!q) return true
        const pnr = String(t.pnr_code ?? '').toLowerCase()
        const ticketNos = Array.isArray(t.ticket_passengers)
          ? t.ticket_passengers
              .map((p: any) => String(p?.ticket_number ?? ''))
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
          : ''
        const paxNames = Array.isArray(t.ticket_passengers)
          ? t.ticket_passengers
              .map((p: any) => String(p?.passenger_name ?? ''))
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
          : ''
        return pnr.includes(q) || ticketNos.includes(q) || paxNames.includes(q)
      })
  }, [activeTab, searchQuery, tickets])

  useEffect(() => {
    if (!open) {
      setEditingTicket(null)
    }
  }, [open])

  useEffect(() => {
    if (open && editingTicket) {
      setPrefill(undefined)
    }
  }, [editingTicket, open])

  const handleSave = async (payload: Parameters<typeof createTicket.mutateAsync>[0]) => {
    try {
      await createTicket.mutateAsync(payload)
      setOpen(false)
      toast({ title: editingTicket ? 'Bilet güncellendi' : 'Bilet oluşturuldu' })
      setEditingTicket(null)
    } catch (e: any) {
      toast({ title: 'İşlem başarısız', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <AppLayout title="Biletleme (PNR)">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Biletleme</h2>
          <p className="text-sm text-muted-foreground mt-1">Bilet kayıtlarını yönetin</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-500">Adetler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Satış</span>
                <span className="font-semibold tabular-nums">{stats.byStatus.sales}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">İade</span>
                <span className="font-semibold tabular-nums">{stats.byStatus.refund}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Void</span>
                <span className="font-semibold tabular-nums">{stats.byStatus.void}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-emerald-500">Finans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ciro</span>
                <span className="font-semibold tabular-nums">{formatCurrency(stats.sellSum)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kazanç</span>
                <span className="font-semibold tabular-nums">{formatCurrency(stats.feeSum)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-500">Fatura Durumu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bekleyen</span>
                <span className="font-semibold tabular-nums">{stats.invoiceCounts.pending}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kesilen</span>
                <span className="font-semibold tabular-nums">{stats.invoiceCounts.invoiced}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Liste</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Bilet Numarası veya PNR Ara..."
                  className="pl-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 bg-white dark:bg-background justify-start text-left font-normal border-border/50 shadow-sm',
                      !dateRange?.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Başlangıç</div>
                      <Calendar
                        selected={dateRange?.from}
                        locale={tr}
                        onSelect={(d) => {
                          if (!d) return
                          setDateRange((prev) => {
                            const to = prev?.to
                            if (to && d > to) return { from: to, to: d }
                            return { from: d, to: to ?? d }
                          })
                        }}
                      />
                    </div>
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Bitiş</div>
                      <Calendar
                        selected={dateRange?.to}
                        locale={tr}
                        onSelect={(d) => {
                          if (!d) return
                          setDateRange((prev) => {
                            const from = prev?.from
                            if (from && d < from) return { from: d, to: from }
                            return { from: from ?? d, to: d }
                          })
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                      Temizle
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Dialog open={open} onOpenChange={setOpen}>
                <Button
                  onClick={() => {
                    setEditingTicket(null)
                    setPrefill(undefined)
                    setOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni Bilet Ekle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPasteText('')
                    setPasteOpen(true)
                  }}
                >
                  PNR Yapıştır
                </Button>
                <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto flex flex-col">
                  <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <DialogTitle>{editingTicket ? 'Bileti Düzenle' : 'Yeni Bilet'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pb-24">
                    <TicketForm
                      formId="ticket-form"
                      initialTicket={editingTicket ?? undefined}
                      prefill={editingTicket ? undefined : prefill}
                      customers={customersQuery.data ?? []}
                      onSubmit={handleSave}
                      isSubmitting={createTicket.isPending}
                    />
                  </div>

                  <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-3">
                    <div className="flex justify-end">
                      <Button type="submit" form="ticket-form" disabled={createTicket.isPending}>
                        Kaydet
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
                <DialogContent className="sm:max-w-[720px]">
                  <DialogHeader>
                    <DialogTitle>PNR Yapıştır</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="PNR çıktısını buraya yapıştırın..."
                      className="min-h-[200px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>
                        Vazgeç
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          const parsed = parsePnrText(pasteText)
                          setPrefill(parsed)
                          setPasteOpen(false)
                          setEditingTicket(null)
                          setOpen(true)
                        }}
                        disabled={!pasteText.trim()}
                      >
                        Ayıkla ve Devam Et
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TicketStatus)}>
              <TabsList className="mb-4">
                <TabsTrigger value="sales">{tabLabels.sales}</TabsTrigger>
                <TabsTrigger value="void">{tabLabels.void}</TabsTrigger>
                <TabsTrigger value="refund">{tabLabels.refund}</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {ticketsQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : ticketsQuery.isError ? (
                  <p className="text-sm text-destructive">{(ticketsQuery.error as any)?.message || 'Biletler yüklenemedi'}</p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bilet No</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">PNR</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Yolcu</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Havayolu</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Parkur</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Net Tutar</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Satış Tutarı</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Kâr</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="h-32 text-center">
                              <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredTickets.map((t: TicketRow) => {
                            const customer = t.customer_id ? customersById.get(t.customer_id) : undefined
                            const isInvoiced = String(t.invoice_status ?? '') === 'invoiced'
                            const canInvoice = Boolean(t.customer_id) && !isInvoiced

                            const firstPax = Array.isArray(t.ticket_passengers) ? t.ticket_passengers[0] : undefined
                            const firstSeg = Array.isArray(t.ticket_segments) ? t.ticket_segments[0] : undefined

                            const base = Number(t.base_fare ?? 0)
                            const tax = Number(t.tax_amount ?? 0)
                            const fee = Number(t.service_fee ?? 0)
                            const netTotal = base + tax
                            const sellTotal = netTotal + fee

                            return (
                              <tr key={t.id} className="border-b last:border-b-0">
                                <td className="p-4">{t.issue_date ? formatShortDate(t.issue_date) : '-'}</td>
                                <td className="p-4">{String(firstPax?.ticket_number ?? '-') || '-'}</td>
                                <td className="p-4">{t.pnr_code || '-'}</td>
                                <td className="p-4">
                                  <div className="min-w-0">
                                    <div className="truncate">{String(firstPax?.passenger_name ?? '-') || '-'}</div>
                                    {customer?.name ? (
                                      <div className="truncate text-xs text-muted-foreground">{customer.name}</div>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="p-4">{String(firstSeg?.airline ?? '-') || '-'}</td>
                                <td className="p-4">
                                  {firstSeg?.origin && firstSeg?.destination
                                    ? `${firstSeg.origin}-${firstSeg.destination}`
                                    : '-'}
                                </td>
                                <td className="p-4 text-right tabular-nums">{formatCurrency(netTotal)}</td>
                                <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(sellTotal)}</td>
                                <td className="p-4 text-right tabular-nums">{formatCurrency(Number(t.service_fee ?? 0))}</td>
                                <td className="p-4">
                                  <Badge className={statusBadgeClasses[t.status]}>{statusLabels[t.status]}</Badge>
                                </td>
                                <td className="p-4 text-right">
                                  <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild>
                                      <Button variant="outline" size="sm">İşlem</Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                      <DropdownMenu.Content
                                        className="z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                        sideOffset={6}
                                        align="end"
                                      >
                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                          onSelect={() => {
                                            setEditingTicket(t)
                                            setOpen(true)
                                          }}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Düzenle
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                          disabled={!canInvoice || invoiceTicket.isPending}
                                          onSelect={async () => {
                                            if (!t.customer_id) {
                                              toast({
                                                title: 'Müşteri seçimi gerekli',
                                                description: 'Fatura oluşturmak için bilette müşteri seçili olmalı.',
                                                variant: 'destructive',
                                              })
                                              return
                                            }
                                            if (isInvoiced) return
                                            try {
                                              await invoiceTicket.mutateAsync({ ticketId: t.id })
                                              toast({ title: 'Fatura oluşturuldu ve listeye eklendi' })
                                            } catch (e: any) {
                                              toast({ title: 'Başarısız', description: e?.message, variant: 'destructive' })
                                            }
                                          }}
                                        >
                                          <CheckCircle2 className="mr-2 h-4 w-4" />
                                          {isInvoiced ? 'Fatura Kesildi' : 'Fatura Kes'}
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-muted" />

                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                          disabled={updateTicketStatus.isPending || t.status === 'sales'}
                                          onSelect={async () => {
                                            if (t.status === 'sales') return
                                            try {
                                              await updateTicketStatus.mutateAsync({ id: t.id, status: 'sales' })
                                              toast({ title: 'Durum: Satış' })
                                            } catch (e: any) {
                                              toast({ title: 'Başarısız', description: e?.message, variant: 'destructive' })
                                            }
                                          }}
                                        >
                                          Durumu Satış Yap
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                          disabled={updateTicketStatus.isPending || t.status === 'void'}
                                          onSelect={async () => {
                                            if (t.status === 'void') return
                                            try {
                                              await updateTicketStatus.mutateAsync({ id: t.id, status: 'void' })
                                              toast({ title: 'Durum: Void' })
                                            } catch (e: any) {
                                              toast({ title: 'Başarısız', description: e?.message, variant: 'destructive' })
                                            }
                                          }}
                                        >
                                          Durumu Void Yap
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                          disabled={updateTicketStatus.isPending || t.status === 'refund'}
                                          onSelect={async () => {
                                            if (t.status === 'refund') return
                                            try {
                                              await updateTicketStatus.mutateAsync({ id: t.id, status: 'refund' })
                                              toast({ title: 'Durum: İade' })
                                            } catch (e: any) {
                                              toast({ title: 'Başarısız', description: e?.message, variant: 'destructive' })
                                            }
                                          }}
                                        >
                                          Durumu İade Yap
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-muted" />

                                        <DropdownMenu.Item
                                          className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent text-destructive"
                                          onSelect={() => setDeletingTicket(t)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Sil
                                        </DropdownMenu.Item>
                                      </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                  </DropdownMenu.Root>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingTicket)}
          onOpenChange={(v) => {
            if (!v) setDeletingTicket(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingTicket(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTicket.isPending || !deletingTicket}
                onClick={async () => {
                  if (!deletingTicket) return
                  try {
                    await deleteTicket.mutateAsync({ id: deletingTicket.id })
                    toast({ title: 'Bilet silindi' })
                  } catch (e: any) {
                    toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
                  } finally {
                    setDeletingTicket(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
