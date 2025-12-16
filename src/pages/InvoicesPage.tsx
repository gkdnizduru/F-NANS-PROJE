import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateInvoiceForm } from '../components/forms/CreateInvoiceForm'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { InvoicePrintView } from '../components/invoices/InvoicePrintView'
import { useCustomers, useDeleteInvoice, useInvoiceItems, useInvoicesByDateRange } from '../hooks/useSupabaseQuery'
import { INVOICE_STATUS_LABELS } from '../lib/constants'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { cn } from '../lib/utils'
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
import { Calendar as CalendarIcon, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/input'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

const statusVariants: Record<InvoiceRow['status'], 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  cancelled: 'destructive',
}

const statusBadgeClasses: Record<InvoiceRow['status'], string> = {
  draft: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  sent: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  paid: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  cancelled: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

export function InvoicesPage() {
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const openInvoiceId = searchParams.get('open')
  const [autoOpenAttempts, setAutoOpenAttempts] = useState(0)

  const [open, setOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRow | null>(null)
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

  const invoicesQuery = useInvoicesByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const deleteInvoice = useDeleteInvoice()

  const invoiceItemsQuery = useInvoiceItems(editingInvoice?.id)

  const invoices = invoicesQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return invoices

    return invoices.filter((inv) => {
      const invNo = String(inv.invoice_number ?? '').toLowerCase()
      const customerName = String(
        (inv as any)?.customer?.name ?? customersById.get(inv.customer_id)?.name ?? ''
      ).toLowerCase()
      const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
      const itemsText = items
        .map((it) => String(it.description ?? ''))
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return invNo.includes(q) || customerName.includes(q) || itemsText.includes(q)
    })
  }, [customersById, invoices, searchQuery])

  useEffect(() => {
    if (!openInvoiceId) return

    const invoices = invoicesQuery.data ?? []
    const match = invoices.find((inv) => inv.id === openInvoiceId)

    if (match) {
      setEditingInvoice(match)
      setOpen(true)
      setSearchParams({}, { replace: true })
      return
    }

    if (!invoicesQuery.isFetching && autoOpenAttempts < 2) {
      setAutoOpenAttempts((n) => n + 1)
      invoicesQuery.refetch()
    }
  }, [autoOpenAttempts, invoicesQuery, openInvoiceId, setSearchParams])

  return (
    <AppLayout title="Faturalar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Faturalar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Faturalarınızı oluşturun ve yönetin
            </p>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Fatura Listesi</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Fatura, müşteri veya hizmet ara..."
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
                          setDateRange((prev) => {
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

              <Sheet
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingInvoice(null)
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingInvoice(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Fatura
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[800px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{editingInvoice ? 'Faturayı Düzenle' : 'Fatura Oluştur'}</SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    <CreateInvoiceForm
                      initialInvoice={editingInvoice ?? undefined}
                      initialItems={invoiceItemsQuery.data ?? undefined}
                      onSuccess={() => {
                        setOpen(false)
                        toast({
                          title: editingInvoice ? 'Fatura güncellendi' : 'Fatura oluşturuldu',
                        })
                        setEditingInvoice(null)
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {invoicesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoicesQuery.isError ? (
              <p className="text-sm text-destructive">
                {(invoicesQuery.error as any)?.message || 'Faturalar yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Fatura No
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tarih
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Müşteri
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Hizmet/Ürün
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Durum
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        Toplam
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">
                            Henüz fatura oluşturulmadı.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const customer = (inv as any)?.customer ?? customersById.get(inv.customer_id)
                        const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
                        const first = items[0]?.description ?? ''
                        const itemsLabel =
                          items.length === 0
                            ? '-'
                            : items.length === 1
                              ? String(first)
                              : `${String(first)} (+${items.length - 1} kalem)`

                        return (
                          <tr key={inv.id} className="border-b">
                            <td className="p-4 font-medium">{inv.invoice_number}</td>
                            <td className="p-4">{formatShortDate(inv.invoice_date)}</td>
                            <td className="p-4">{customer?.name || '-'}</td>
                            <td className="p-4 max-w-[320px]">
                              <div className="truncate" title={itemsLabel}>
                                {itemsLabel}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={statusVariants[inv.status]} className={statusBadgeClasses[inv.status]}>
                                {INVOICE_STATUS_LABELS[inv.status]}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium">
                              {formatCurrency(Number(inv.total_amount))}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setPrintingInvoice(inv)}
                                  title="Yazdır"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingInvoice(inv)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingInvoice(inv)}
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
          open={Boolean(deletingInvoice)}
          onOpenChange={(v) => {
            if (!v) setDeletingInvoice(null)
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
              <Button variant="outline" onClick={() => setDeletingInvoice(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteInvoice.isPending || !deletingInvoice}
                onClick={async () => {
                  if (!deletingInvoice) return
                  try {
                    await deleteInvoice.mutateAsync({
                      id: deletingInvoice.id,
                      itemName: deletingInvoice.invoice_number,
                    })
                    toast({ title: 'Fatura silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingInvoice(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog
        open={Boolean(printingInvoice)}
        onOpenChange={(v) => {
          if (!v) setPrintingInvoice(null)
        }}
      >
        <DialogContent className="max-w-[980px] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Fatura Önizleme</DialogTitle>
          </DialogHeader>

          <div className="max-h-[80vh] overflow-y-auto">
            {printingInvoice ? <InvoicePrintView invoiceId={printingInvoice.id} /> : null}
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              type="button"
              onClick={() => {
                window.print()
              }}
              disabled={!printingInvoice}
            >
              Yazdır / PDF İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
