import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CalendarIcon, Plane } from 'lucide-react'

import { AppLayout } from '../components/layout/AppLayout'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Skeleton } from '../components/ui/skeleton'
import { formatCurrency } from '../lib/format'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAirlines } from '../hooks/useSupabaseQuery'

type DateRange = {
  from?: Date
  to?: Date
}

type TicketReportRow = {
  id: string
  sell_price: number | null
  service_fee: number | null
  issue_date: string | null
  status: 'sales' | 'void' | 'refund' | string
  ticket_segments?: Array<{ airline: string | null }>
}

type AirlineAgg = {
  airline: string
  ticketIds: Set<string>
  revenue: number
  profit: number
}

function formatMoney(amount: number) {
  return formatCurrency(amount)
}

export function AgencyAirlinesReportPage() {
  const now = new Date()

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: now, to: now })
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>({ from: now, to: now })

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Tarih Aralığı'
    const from = format(dateRange.from, 'd MMM', { locale: tr })
    const to = format(dateRange.to, 'd MMM', { locale: tr })
    return `${from} - ${to}`
  }, [dateRange?.from, dateRange?.to])

  const fromStr = useMemo(() => {
    return appliedRange?.from ? format(appliedRange.from, 'yyyy-MM-dd') : undefined
  }, [appliedRange?.from])

  const toStr = useMemo(() => {
    return appliedRange?.to ? format(appliedRange.to, 'yyyy-MM-dd') : undefined
  }, [appliedRange?.to])

  const airlinesQuery = useAirlines()
  const airlinesByCode = useMemo(() => {
    return new Map((airlinesQuery.data ?? []).map((a) => [a.code, a]))
  }, [airlinesQuery.data])

  const reportQuery = useQuery<{ rows: TicketReportRow[] }>({
    queryKey: ['reports', 'airlines', fromStr ?? 'none', toStr ?? 'none'],
    enabled: Boolean(fromStr && toStr),
    queryFn: async () => {
      let q = (supabase as any)
        .from('tickets')
        .select('id, sell_price, service_fee, issue_date, status, ticket_segments(airline)')
        .eq('status', 'sales')
        .order('issue_date', { ascending: false })

      if (fromStr) q = q.gte('issue_date', fromStr)
      if (toStr) q = q.lte('issue_date', toStr)

      const { data, error } = await q
      if (error) throw error
      return { rows: (data ?? []) as TicketReportRow[] }
    },
  })

  const computed = useMemo(() => {
    const rows = reportQuery.data?.rows ?? []

    const byAirline = new Map<string, AirlineAgg>()
    let totalRevenue = 0
    let totalProfit = 0

    for (const t of rows) {
      const revenue = Number(t.sell_price ?? 0)
      const profit = Number(t.service_fee ?? 0)
      totalRevenue += revenue
      totalProfit += profit

      const codes = new Set(
        (t.ticket_segments ?? [])
          .map((s) => String(s?.airline ?? '').trim())
          .filter(Boolean)
      )

      for (const code of codes) {
        const agg = byAirline.get(code) ?? {
          airline: code,
          ticketIds: new Set<string>(),
          revenue: 0,
          profit: 0,
        }

        if (!agg.ticketIds.has(t.id)) {
          agg.ticketIds.add(t.id)
          agg.revenue += revenue
          agg.profit += profit
        }

        byAirline.set(code, agg)
      }
    }

    const list = Array.from(byAirline.values())
      .map((a) => ({
        airline: a.airline,
        ticket_count: a.ticketIds.size,
        revenue: a.revenue,
        profit: a.profit,
      }))
      .sort((a, b) => b.profit - a.profit)

    const mostProfitable = list[0]

    return {
      rows,
      list,
      totalRevenue,
      totalProfit,
      mostProfitable,
    }
  }, [reportQuery.data?.rows])

  const mostProfitableLabel = useMemo(() => {
    const a = computed.mostProfitable
    if (!a?.airline) return '-'
    const found = airlinesByCode.get(a.airline)
    return found ? `${found.code} - ${found.name}` : a.airline
  }, [airlinesByCode, computed.mostProfitable])

  return (
    <AppLayout title="Havayolu Performans Raporu">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Filtre</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
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
                    {rangeLabel}
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
                          setDateRange((prev: DateRange | undefined) => {
                            const to = prev?.to
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
                        selected={dateRange?.to}
                        locale={tr}
                        onSelect={(d) => {
                          if (!d) return
                          setDateRange((prev: DateRange | undefined) => {
                            const from = prev?.from
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

              <Button
                type="button"
                onClick={() => {
                  if (!dateRange?.from || !dateRange?.to) return
                  setAppliedRange(dateRange)
                }}
                disabled={!dateRange?.from || !dateRange?.to}
              >
                Raporla
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Toplam Ciro</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportQuery.isLoading ? (
                    <Skeleton className="h-7 w-32" />
                  ) : (
                    <div className="text-2xl font-semibold tabular-nums">{formatMoney(computed.totalRevenue)}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Toplam Kâr</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportQuery.isLoading ? (
                    <Skeleton className="h-7 w-32" />
                  ) : (
                    <div className="text-2xl font-semibold tabular-nums">{formatMoney(computed.totalProfit)}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">En Kârlı Havayolu</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportQuery.isLoading ? (
                    <Skeleton className="h-7 w-48" />
                  ) : (
                    <div className="text-sm font-semibold truncate">{mostProfitableLabel}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              {reportQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : reportQuery.isError ? (
                <p className="text-sm text-destructive">{(reportQuery.error as any)?.message || 'Rapor yüklenemedi'}</p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Havayolu</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Bilet Adedi</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam Ciro</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam Kâr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.list.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="h-32 text-center">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <Plane className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        computed.list.map((r) => {
                          const a = airlinesByCode.get(r.airline)
                          const label = a ? `${a.code} - ${a.name}` : r.airline
                          return (
                            <tr key={r.airline} className="border-b last:border-b-0">
                              <td className="p-4">
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                                  {label}
                                </Badge>
                              </td>
                              <td className="p-4 text-right tabular-nums">{r.ticket_count.toLocaleString('tr-TR')}</td>
                              <td className="p-4 text-right tabular-nums">{formatMoney(r.revenue)}</td>
                              <td className="p-4 text-right tabular-nums font-medium">{formatMoney(r.profit)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
