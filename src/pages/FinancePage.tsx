import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { TransactionForm } from '../components/forms/TransactionForm'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Calendar } from '../components/ui/calendar'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useAccounts, useCustomers, useDeleteTransaction, useTransactionsByDateRange } from '../hooks/useSupabaseQuery'
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
import { Calendar as CalendarIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

type TransactionRow = Database['public']['Tables']['transactions']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

export function FinancePage() {
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const editIdParam = searchParams.get('editId')
  const [open, setOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(null)
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

  const transactionsQuery = useTransactionsByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const accountsQuery = useAccounts()
  const deleteTransaction = useDeleteTransaction()

  const transactions = transactionsQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const accountsById = useMemo(() => {
    return new Map((accountsQuery.data ?? []).map((a) => [a.id, a]))
  }, [accountsQuery.data])

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return transactions

    return transactions.filter((t) => {
      const customer = t.customer_id ? customersById.get(t.customer_id) : undefined
      const account = t.bank_account ? accountsById.get(t.bank_account) : undefined

      const descriptionText = String((t as any)?.description ?? '').toLowerCase()
      const categoryText = String(t.category ?? '').toLowerCase()
      const accountText = String(account?.name ?? '').toLowerCase()
      const customerText = String(customer?.name ?? '').toLowerCase()

      return (
        descriptionText.includes(q) ||
        categoryText.includes(q) ||
        accountText.includes(q) ||
        customerText.includes(q)
      )
    })
  }, [accountsById, customersById, searchQuery, transactions])

  useEffect(() => {
    if (!editIdParam) return
    if (open && editingTransaction?.id === editIdParam) return

    const match = transactions.find((t) => t.id === editIdParam)
    if (match) {
      setEditingTransaction(match)
      setOpen(true)
      return
    }

    if (!transactionsQuery.isLoading && !transactionsQuery.isFetching) {
      toast({
        title: 'İşlem bulunamadı',
        description: 'Seçilen işlem bulunamadı veya erişiminiz yok.',
        variant: 'destructive',
      })
      const next = new URLSearchParams(searchParams)
      next.delete('editId')
      setSearchParams(next, { replace: true })
    }
  }, [editIdParam, editingTransaction?.id, open, searchParams, setSearchParams, transactions, transactionsQuery.isFetching, transactionsQuery.isLoading])

  return (
    <AppLayout title="Finans">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold">Finans</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gelir ve gider işlemlerinizi yönetin
          </p>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">İşlemler</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Açıklama, kategori veya hesap ara..."
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

              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) {
                    setEditingTransaction(null)
                    if (searchParams.get('editId')) {
                      const next = new URLSearchParams(searchParams)
                      next.delete('editId')
                      setSearchParams(next, { replace: true })
                    }
                  }
                }}
              >
                <Button
                  onClick={() => {
                    setEditingTransaction(null)
                    setOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni İşlem Ekle
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingTransaction ? 'İşlemi Düzenle' : 'Yeni İşlem'}</DialogTitle>
                  </DialogHeader>
                  <TransactionForm
                    initialTransaction={editingTransaction ?? undefined}
                    onSuccess={() => {
                      setOpen(false)
                      toast({
                        title: editingTransaction ? 'İşlem güncellendi' : 'İşlem oluşturuldu',
                      })
                      setEditingTransaction(null)
                      if (searchParams.get('editId')) {
                        const next = new URLSearchParams(searchParams)
                        next.delete('editId')
                        setSearchParams(next, { replace: true })
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {transactionsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : transactionsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(transactionsQuery.error as any)?.message || 'İşlemler yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tarih
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tür
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Kategori
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Hesap
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Müşteri
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        Tutar
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">
                            Henüz işlem bulunamadı.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((t) => {
                        const customer = t.customer_id ? customersById.get(t.customer_id) : undefined
                        const account = t.bank_account ? accountsById.get(t.bank_account) : undefined
                        return (
                          <tr key={t.id} className="border-b">
                            <td className="p-4">{formatShortDate(t.transaction_date)}</td>
                            <td className="p-4">
                              <Badge
                                variant={t.type === 'expense' ? 'destructive' : 'default'}
                                className={t.type === 'income' ? 'bg-emerald-500 hover:bg-emerald-500/90 text-white border-transparent' : undefined}
                              >
                                {t.type === 'income' ? 'Gelir' : 'Gider'}
                              </Badge>
                            </td>
                            <td className="p-4">{t.category}</td>
                            <td className="p-4">{account?.name || '-'}</td>
                            <td className="p-4">{customer?.name || '-'}</td>
                            <td className="p-4 text-right font-medium">{formatCurrency(Number(t.amount))}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTransaction(t)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingTransaction(t)}
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
          open={Boolean(deletingTransaction)}
          onOpenChange={(v) => {
            if (!v) setDeletingTransaction(null)
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
              <Button variant="outline" onClick={() => setDeletingTransaction(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTransaction.isPending || !deletingTransaction}
                onClick={async () => {
                  if (!deletingTransaction) return
                  try {
                    await deleteTransaction.mutateAsync({
                      id: deletingTransaction.id,
                      itemName: `${deletingTransaction.category} (${Number(deletingTransaction.amount).toLocaleString('tr-TR')} TL)`,
                    })
                    toast({ title: 'İşlem silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingTransaction(null)
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
