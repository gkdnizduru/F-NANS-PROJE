import { useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateQuoteForm } from '../components/forms/CreateQuoteForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { Calendar } from '../components/ui/calendar'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { useCustomers, useDeleteQuote, useQuotesByDateRange, useConvertQuoteToInvoice } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { ArrowRightLeft, Calendar as CalendarIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type QuoteRow = Database['public']['Tables']['quotes']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

const quoteStatusLabels: Record<QuoteRow['status'], string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  accepted: 'Onaylandı',
  rejected: 'Reddedildi',
  converted: 'Faturaya Dönüştü',
}

const quoteBadgeVariants: Record<QuoteRow['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: {
    variant: 'secondary',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  },
  sent: {
    variant: 'outline',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  },
  accepted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
  rejected: {
    variant: 'destructive',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  },
  converted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
}

export function QuotesPage() {
  const navigate = useNavigate()
  const now = new Date()

  const [open, setOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<QuoteRow | null>(null)
  const [deletingQuote, setDeletingQuote] = useState<QuoteRow | null>(null)
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

  const quotesQuery = useQuotesByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const deleteQuote = useDeleteQuote()
  const convertToInvoice = useConvertQuoteToInvoice()

  const quotes = quotesQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return quotes

    return quotes.filter((row) => {
      const quoteNo = String(row.quote_number ?? '').toLowerCase()
      const customerName = String(customersById.get(row.customer_id)?.name ?? '').toLowerCase()
      return quoteNo.includes(q) || customerName.includes(q)
    })
  }, [customersById, quotes, searchQuery])

  return (
    <AppLayout title="Teklifler">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Teklifler</h2>
            <p className="text-sm text-muted-foreground mt-1">Tekliflerinizi oluşturun ve yönetin</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Teklif Listesi</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Teklif veya müşteri ara..."
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
                  <div className="flex flex-wrap gap-2 pb-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange({ from: now, to: now })}>
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                      Temizle
                    </Button>
                  </div>

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
                </PopoverContent>
              </Popover>

              <Sheet
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingQuote(null)
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingQuote(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Teklif
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[900px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{editingQuote ? 'Teklifi Düzenle' : 'Teklif Oluştur'}</SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    <CreateQuoteForm
                      initialQuote={editingQuote ?? undefined}
                      onSuccess={() => {
                        setOpen(false)
                        toast({
                          title: editingQuote ? 'Teklif güncellendi' : 'Teklif oluşturuldu',
                        })
                        setEditingQuote(null)
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {quotesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : quotesQuery.isError ? (
              <p className="text-sm text-destructive">
                {(quotesQuery.error as any)?.message || 'Teklifler yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Teklif No</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Müşteri</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tarih</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">Teklif listeniz boş.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredQuotes.map((q) => {
                        const customerName = customersById.get(q.customer_id)?.name ?? '-'
                        const badge = quoteBadgeVariants[q.status]

                        return (
                          <tr key={q.id} className="border-b">
                            <td className="p-4 font-medium">{q.quote_number}</td>
                            <td className="p-4">{customerName}</td>
                            <td className="p-4">{formatShortDate(q.issue_date)}</td>
                            <td className="p-4">
                              <Badge variant={badge.variant} className={badge.className}>
                                {quoteStatusLabels[q.status]}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums">{formatCurrency(Number(q.total_amount ?? 0))}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingQuote(q)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={q.status === 'converted' || convertToInvoice.isPending}
                                  onClick={async () => {
                                    try {
                                      const invoiceId = await convertToInvoice.mutateAsync({ quoteId: q.id })
                                      toast({ title: 'Faturaya dönüştürüldü' })
                                      navigate(`/faturalar?open=${invoiceId}`)
                                    } catch (e: any) {
                                      toast({
                                        title: 'Dönüştürme başarısız',
                                        description: e?.message || 'Bilinmeyen hata',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                >
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                  Faturaya Dönüştür
                                </Button>

                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingQuote(q)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingQuote)}
          onOpenChange={(v) => {
            if (!v) setDeletingQuote(null)
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
              <Button variant="outline" onClick={() => setDeletingQuote(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteQuote.isPending || !deletingQuote}
                onClick={async () => {
                  if (!deletingQuote) return
                  try {
                    await deleteQuote.mutateAsync({ id: deletingQuote.id, itemName: deletingQuote.quote_number })
                    toast({ title: 'Teklif silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingQuote(null)
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
