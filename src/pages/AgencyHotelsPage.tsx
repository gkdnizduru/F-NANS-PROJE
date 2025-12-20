import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
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
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import {
  useCustomers,
  useDeleteHotelReservation,
  useHotelReservations,
  useUpsertHotelReservation,
  type HotelReservationRow,
  type HotelReservationStatus,
} from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { BedDouble, MapPin, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { HotelReservationForm } from '../components/forms/HotelReservationForm'
import { HotelVoucherModal } from '../components/hotels/HotelVoucherModal'

const boardLabels: Record<string, string> = {
  UAI: 'Ultra Her Şey Dahil',
  AI: 'Her Şey Dahil',
  NAI: 'Alkolsüz Her Şey Dahil',
  FB: 'Tam Pansiyon',
  HB: 'Yarım Pansiyon',
  BB: 'Oda Kahvaltı',
  RO: 'Sadece Oda',
}

const boardBadgeClasses: Record<string, string> = {
  RO: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/20',
  BB: 'border-transparent bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/20',
  HB: 'border-transparent bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20',
  FB: 'border-transparent bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20',
  NAI: 'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
  AI: 'border-transparent bg-indigo-100 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20',
  UAI: 'border-transparent bg-yellow-100 text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/20',
}

const reservationStatusLabels: Record<HotelReservationStatus, string> = {
  confirmed: 'Onaylı',
  pending: 'Beklemede',
  cancelled: 'İptal',
}

const reservationStatusBadgeClasses: Record<HotelReservationStatus, string> = {
  confirmed: 'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
  pending: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
  cancelled: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

function formatMoney(amount: number, currency?: string | null) {
  const cur = (currency || 'TRY').toUpperCase()
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur as any }).format(amount)
  } catch {
    return formatCurrency(amount)
  }
}

export function AgencyHotelsPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HotelReservationRow | null>(null)
  const [deleting, setDeleting] = useState<HotelReservationRow | null>(null)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [voucherReservation, setVoucherReservation] = useState<HotelReservationRow | null>(null)

  const hotelsQuery = useHotelReservations()
  const customersQuery = useCustomers()
  const upsert = useUpsertHotelReservation()
  const deleteReservation = useDeleteHotelReservation()

  const reservations: HotelReservationRow[] = hotelsQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    let upcoming = 0
    let profitSum = 0

    for (const r of reservations) {
      const checkIn = String(r.check_in_date ?? '')
      if (checkIn && checkIn >= todayStr) upcoming += 1

      const p = (r as any).profit
      if (typeof p === 'number') profitSum += p
      else {
        const net = Number(r.net_price ?? 0)
        const sell = Number(r.sell_price ?? 0)
        profitSum += sell - net
      }
    }

    return {
      total: reservations.length,
      upcoming,
      profitSum,
    }
  }, [reservations])

  useEffect(() => {
    if (!open) setEditing(null)
  }, [open])

  const handleSave = async (payload: Parameters<typeof upsert.mutateAsync>[0]) => {
    try {
      await upsert.mutateAsync(payload)
      toast({ title: editing ? 'Rezervasyon güncellendi' : 'Rezervasyon oluşturuldu' })
      setOpen(false)
      setEditing(null)
    } catch (e: any) {
      toast({ title: 'İşlem başarısız', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <AppLayout title="Otel Yönetimi">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Otel Yönetimi</h2>
          <p className="text-sm text-muted-foreground mt-1">Otel rezervasyonlarını yönetin</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-500">Toplam Rezervasyon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-500">Yaklaşan Girişler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{stats.upcoming}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-emerald-500">Toplam Kazanç</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(stats.profitSum)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Rezervasyonlar</CardTitle>

            <Dialog open={open} onOpenChange={setOpen}>
              <Button
                onClick={() => {
                  setEditing(null)
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Yeni Rezervasyon
              </Button>

              <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-y-auto flex flex-col">
                <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <DialogTitle>{editing ? 'Rezervasyonu Düzenle' : 'Yeni Rezervasyon'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pb-24">
                  <HotelReservationForm
                    formId="hotel-reservation-form"
                    initialReservation={editing ?? undefined}
                    customers={customersQuery.data ?? []}
                    onSubmit={handleSave}
                    isSubmitting={upsert.isPending}
                  />
                </div>

                <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-3">
                  <div className="flex justify-end">
                    <Button type="submit" form="hotel-reservation-form" disabled={upsert.isPending}>
                      Kaydet
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            {hotelsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : hotelsQuery.isError ? (
              <p className="text-sm text-destructive">{(hotelsQuery.error as any)?.message || 'Rezervasyonlar yüklenemedi'}</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Otel</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bölge</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Misafir</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Giriş-Çıkış</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Pansiyon</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Tutar</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Kâr</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
                        </td>
                      </tr>
                    ) : (
                      reservations.map((r) => {
                        const customer = r.customer_id ? customersById.get(r.customer_id) : undefined
                        const net = Number(r.net_price ?? 0)
                        const sell = Number(r.sell_price ?? 0)
                        const profit = typeof (r as any).profit === 'number' ? (r as any).profit : sell - net
                        const board = String(r.board_type ?? '')
                        const status = (r.status ?? 'pending') as HotelReservationStatus

                        return (
                          <tr key={r.id} className="border-b last:border-b-0">
                            <td className="p-4">
                              <div className="flex items-start gap-2">
                                <BedDouble className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{r.hotel_name || '-'}</div>
                                  {customer?.name ? (
                                    <div className="truncate text-xs text-muted-foreground">{customer.name}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{r.location || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="min-w-0">
                                <div className="truncate">{r.guest_name || '-'}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {Number(r.adult_count ?? 0)} Yetişkin · {Number(r.child_count ?? 0)} Çocuk
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm">
                                <div>{r.check_in_date ? formatShortDate(r.check_in_date) : '-'}</div>
                                <div className="text-muted-foreground">{r.check_out_date ? formatShortDate(r.check_out_date) : '-'}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge className={boardBadgeClasses[board] ?? boardBadgeClasses.RO}>
                                {boardLabels[board] ?? board}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums">{formatMoney(sell, r.currency)}</td>
                            <td className="p-4 text-right tabular-nums">{formatMoney(profit, r.currency)}</td>
                            <td className="p-4">
                              <Badge className={reservationStatusBadgeClasses[status]}>
                                {reservationStatusLabels[status]}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <Button variant="outline" size="sm">
                                    İşlem
                                  </Button>
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
                                        setEditing(r)
                                        setOpen(true)
                                      }}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Düzenle
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item
                                      className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                                      onSelect={() => {
                                        setVoucherReservation(r)
                                        setVoucherOpen(true)
                                      }}
                                    >
                                      <Printer className="mr-2 h-4 w-4" />
                                      Voucher Yazdır
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-muted" />

                                    <DropdownMenu.Item
                                      className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent text-destructive"
                                      onSelect={() => setDeleting(r)}
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
          </CardContent>
        </Card>

        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rezervasyon silinsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteReservation.isPending}
                onClick={async () => {
                  if (!deleting) return
                  try {
                    await deleteReservation.mutateAsync({ id: deleting.id })
                    toast({ title: 'Rezervasyon silindi' })
                    setDeleting(null)
                  } catch (e: any) {
                    toast({ title: 'Başarısız', description: e?.message, variant: 'destructive' })
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <HotelVoucherModal
          open={voucherOpen}
          onOpenChange={(v) => {
            setVoucherOpen(v)
            if (!v) setVoucherReservation(null)
          }}
          reservation={voucherReservation}
        />
      </div>
    </AppLayout>
  )
}
