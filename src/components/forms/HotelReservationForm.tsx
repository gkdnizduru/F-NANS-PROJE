import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { format } from 'date-fns'

import { useAuth } from '../../contexts/AuthContext'
import type { Database } from '../../types/database'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type {
  HotelBoardType,
  HotelCurrency,
  HotelReservationInvoiceStatus,
  HotelReservationRow,
  HotelReservationStatus,
  HotelReservationUpsertPayload,
  HotelPricingMethod,
} from '../../hooks/useSupabaseQuery'

const boardTypes: HotelBoardType[] = ['UAI', 'AI', 'NAI', 'FB', 'HB', 'BB', 'RO']

const boardTypeLabels: Record<HotelBoardType, string> = {
  UAI: 'Ultra Her Şey Dahil',
  AI: 'Her Şey Dahil',
  NAI: 'Alkolsüz Her Şey Dahil',
  FB: 'Tam Pansiyon',
  HB: 'Yarım Pansiyon',
  BB: 'Oda Kahvaltı',
  RO: 'Sadece Oda',
}
const currencies: HotelCurrency[] = ['TRY', 'USD', 'EUR']
const reservationStatuses: HotelReservationStatus[] = ['confirmed', 'pending', 'cancelled']
const invoiceStatuses: HotelReservationInvoiceStatus[] = ['pending', 'invoiced']

const reservationStatusLabels: Record<HotelReservationStatus, string> = {
  confirmed: 'Onaylı',
  pending: 'Beklemede',
  cancelled: 'İptal',
}

const invoiceStatusLabels: Record<HotelReservationInvoiceStatus, string> = {
  pending: 'Fatura Kesilmedi',
  invoiced: 'Fatura Kesildi',
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency as any }).format(amount)
  } catch {
    return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  }
}

const reservationSchema = z
  .object({
    hotel_name: z.string().min(1, 'Otel adı zorunludur'),
    location: z.string().min(1, 'Bölge zorunludur'),
    supplier_name: z.string().min(1, 'Tedarikçi zorunludur'),
    confirmation_number: z.string().min(1, 'Onay no zorunludur'),

    check_in_date: z.date(),
    check_out_date: z.date(),

  guest_name: z.string().min(1, 'Misafir adı zorunludur'),
  adult_count: z.number().int().min(0),
  child_count: z.number().int().min(0),

  room_type: z.string().min(1, 'Oda tipi zorunludur'),
  board_type: z.enum(['UAI', 'AI', 'NAI', 'FB', 'HB', 'BB', 'RO']),

  net_price: z.number().min(0),
  sell_price: z.number().min(0),

  pricing_method: z.enum(['markup', 'commission']),
  commission_rate: z.number().min(0),

  currency: z.enum(['TRY', 'USD', 'EUR']),

  customer_id: z.string().min(1, 'Müşteri seçimi zorunludur'),
  status: z.enum(['confirmed', 'pending', 'cancelled']),
  invoice_status: z.enum(['pending', 'invoiced']),
})
  .superRefine((val, ctx) => {
    if (val.pricing_method === 'commission') {
      if (!val.sell_price || val.sell_price <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sell_price'], message: 'Satış tutarı zorunludur' })
      }
      if (!val.commission_rate || val.commission_rate <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commission_rate'],
          message: 'Komisyon oranı zorunludur',
        })
      }
    }
  })

type FormValues = z.infer<typeof reservationSchema>

type Props = {
  formId?: string
  initialReservation?: HotelReservationRow
  customers: Database['public']['Tables']['customers']['Row'][]
  onSubmit: (payload: HotelReservationUpsertPayload) => Promise<void>
  isSubmitting: boolean
}

export function HotelReservationForm({ formId, initialReservation, customers, onSubmit, isSubmitting }: Props) {
  const { user } = useAuth()

  const defaultValues = useMemo<FormValues>(() => {
    if (initialReservation) {
      return {
        hotel_name: String(initialReservation.hotel_name ?? ''),
        location: String(initialReservation.location ?? ''),
        supplier_name: String(initialReservation.supplier_name ?? ''),
        confirmation_number: String(initialReservation.confirmation_number ?? ''),
        check_in_date: initialReservation.check_in_date ? new Date(initialReservation.check_in_date) : new Date(),
        check_out_date: initialReservation.check_out_date ? new Date(initialReservation.check_out_date) : new Date(),
        guest_name: String(initialReservation.guest_name ?? ''),
        adult_count: Number(initialReservation.adult_count ?? 0),
        child_count: Number(initialReservation.child_count ?? 0),
        room_type: String(initialReservation.room_type ?? ''),
        board_type: (initialReservation.board_type ?? 'RO') as HotelBoardType,
        net_price: Number(initialReservation.net_price ?? 0),
        sell_price: Number(initialReservation.sell_price ?? 0),
        pricing_method: (initialReservation.pricing_method ?? 'markup') as HotelPricingMethod,
        commission_rate: Number(initialReservation.commission_rate ?? 0),
        currency: (initialReservation.currency ?? 'TRY') as HotelCurrency,
        customer_id: String(initialReservation.customer_id ?? ''),
        status: (initialReservation.status ?? 'confirmed') as HotelReservationStatus,
        invoice_status: (initialReservation.invoice_status ?? 'pending') as HotelReservationInvoiceStatus,
      }
    }

    return {
      hotel_name: '',
      location: '',
      supplier_name: '',
      confirmation_number: '',
      check_in_date: new Date(),
      check_out_date: new Date(),
      guest_name: '',
      adult_count: 2,
      child_count: 0,
      room_type: '',
      board_type: 'RO',
      net_price: 0,
      sell_price: 0,
      pricing_method: 'markup',
      commission_rate: 0,
      currency: 'TRY',
      customer_id: '',
      status: 'confirmed',
      invoice_status: 'pending',
    }
  }, [initialReservation])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues,
  })

  const pricingMethod = watch('pricing_method') as HotelPricingMethod
  const sellPrice = watch('sell_price')
  const commissionRate = watch('commission_rate')
  const currency = watch('currency')

  const computed = useMemo(() => {
    const sp = Number(sellPrice ?? 0)
    const rate = Number(commissionRate ?? 0)
    const profit = round2(sp * (rate / 100))
    const net = round2(sp - profit)
    return { profit, net }
  }, [commissionRate, sellPrice])

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  useEffect(() => {
    if (pricingMethod !== 'commission') return

    const nextNet = computed.net
    if (!Number.isFinite(nextNet) || nextNet < 0) return

    const currentNet = Number(watch('net_price') ?? 0)
    if (round2(currentNet) !== round2(nextNet)) {
      setValue('net_price', nextNet, { shouldDirty: true, shouldValidate: true })
    }
  }, [computed.net, pricingMethod, setValue, watch])

  const submit = async (values: FormValues) => {
    if (!user) return

    const payload: HotelReservationUpsertPayload = {
      ...(initialReservation?.id ? { id: initialReservation.id } : {}),
      hotel_name: values.hotel_name.trim(),
      location: values.location.trim(),
      supplier_name: values.supplier_name.trim(),
      confirmation_number: values.confirmation_number.trim(),
      check_in_date: format(values.check_in_date, 'yyyy-MM-dd'),
      check_out_date: format(values.check_out_date, 'yyyy-MM-dd'),
      guest_name: values.guest_name.trim(),
      adult_count: values.adult_count,
      child_count: values.child_count,
      room_type: values.room_type.trim(),
      board_type: values.board_type as HotelBoardType,
      net_price: values.net_price,
      sell_price: values.sell_price,
      pricing_method: values.pricing_method as HotelPricingMethod,
      commission_rate: values.commission_rate,
      currency: values.currency as HotelCurrency,
      customer_id: values.customer_id,
      user_id: user.id,
      status: values.status as HotelReservationStatus,
      invoice_status: values.invoice_status as HotelReservationInvoiceStatus,
    }

    await onSubmit(payload)
  }

  return (
    <form id={formId} className="space-y-4" aria-busy={isSubmitting} onSubmit={handleSubmit(submit)}>
      <input type="hidden" {...register('pricing_method')} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hotel_name">Otel</Label>
          <Input id="hotel_name" {...register('hotel_name')} />
          {errors.hotel_name && <p className="text-sm text-destructive">{errors.hotel_name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Bölge</Label>
          <Input id="location" {...register('location')} />
          {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_name">Tedarikçi</Label>
          <Input id="supplier_name" {...register('supplier_name')} />
          {errors.supplier_name && <p className="text-sm text-destructive">{errors.supplier_name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmation_number">Onay No</Label>
          <Input id="confirmation_number" {...register('confirmation_number')} />
          {errors.confirmation_number && <p className="text-sm text-destructive">{errors.confirmation_number.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          control={control}
          name="check_in_date"
          render={({ field }) => (
            <UnifiedDatePicker
              label="Giriş Tarihi"
              value={field.value}
              onChange={(d) => field.onChange(d ?? new Date())}
            />
          )}
        />
        <Controller
          control={control}
          name="check_out_date"
          render={({ field }) => (
            <UnifiedDatePicker
              label="Çıkış Tarihi"
              value={field.value}
              onChange={(d) => field.onChange(d ?? new Date())}
            />
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="guest_name">Misafir</Label>
          <Input id="guest_name" {...register('guest_name')} />
          {errors.guest_name && <p className="text-sm text-destructive">{errors.guest_name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="adult_count">Yetişkin</Label>
          <Input id="adult_count" type="number" inputMode="numeric" {...register('adult_count', { valueAsNumber: true })} />
          {errors.adult_count && <p className="text-sm text-destructive">{errors.adult_count.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="child_count">Çocuk</Label>
          <Input id="child_count" type="number" inputMode="numeric" {...register('child_count', { valueAsNumber: true })} />
          {errors.child_count && <p className="text-sm text-destructive">{errors.child_count.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="room_type">Oda Tipi</Label>
          <Input id="room_type" {...register('room_type')} />
          {errors.room_type && <p className="text-sm text-destructive">{errors.room_type.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Pansiyon</Label>
          <Controller
            control={control}
            name="board_type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pansiyon seç" />
                </SelectTrigger>
                <SelectContent>
                  {boardTypes.map((b) => (
                    <SelectItem key={b} value={b}>
                      {boardTypeLabels[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.board_type && <p className="text-sm text-destructive">{errors.board_type.message}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Kazanç Yöntemi</Label>
            <div className="inline-flex rounded-md border p-1 ml-1">
            <Button
              type="button"
              size="sm"
              variant={pricingMethod === 'markup' ? 'default' : 'ghost'}
              onClick={() => {
                setValue('pricing_method', 'markup', { shouldDirty: true, shouldValidate: true })
              }}
            >
              Tutar Bazlı (Markup)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pricingMethod === 'commission' ? 'default' : 'ghost'}
              onClick={() => {
                setValue('pricing_method', 'commission', { shouldDirty: true, shouldValidate: true })
              }}
            >
              Komisyonlu (Commission)
            </Button>
            </div>
          </div>
          {errors.pricing_method && <p className="text-sm text-destructive">{errors.pricing_method.message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pricingMethod === 'commission' ? (
            <div className="space-y-2">
              <Label htmlFor="net_price">Net (Otomatik)</Label>
              <input type="hidden" {...register('net_price', { valueAsNumber: true })} />
              <Input
                id="net_price"
                type="number"
                step="0.01"
                inputMode="decimal"
                disabled
                value={computed.net}
                readOnly
              />
              {errors.net_price && <p className="text-sm text-destructive">{errors.net_price.message}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="net_price">Net</Label>
              <Input
                id="net_price"
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register('net_price', { valueAsNumber: true })}
              />
              {errors.net_price && <p className="text-sm text-destructive">{errors.net_price.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sell_price">Satış</Label>
            <Input id="sell_price" type="number" step="0.01" inputMode="decimal" {...register('sell_price', { valueAsNumber: true })} />
            {errors.sell_price && <p className="text-sm text-destructive">{errors.sell_price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Para Birimi</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Para birimi" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
          </div>
        </div>

        {pricingMethod === 'commission' ? (
          <div className="space-y-2">
            <Label htmlFor="commission_rate">Komisyon Oranı (%)</Label>

            <div className="flex flex-wrap gap-2">
              {[5, 8, 10, 12, 15].map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setValue('commission_rate', r, { shouldDirty: true, shouldValidate: true })
                  }}
                >
                  %{r}
                </Button>
              ))}
            </div>

            <Input
              id="commission_rate"
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register('commission_rate', { valueAsNumber: true })}
            />
            {errors.commission_rate && <p className="text-sm text-destructive">{errors.commission_rate.message}</p>}

            <p className="text-xs text-muted-foreground">
              {formatMoney(Number(sellPrice ?? 0), String(currency))} satıştan %{Number(commissionRate ?? 0)} komisyon ile{' '}
              {formatMoney(computed.profit, String(currency))} kazanılacak. Otele Net Ödeme:{' '}
              {formatMoney(computed.net, String(currency))}
            </p>
          </div>
        ) : (
          <input type="hidden" {...register('commission_rate', { valueAsNumber: true })} />
        )}
      </div>

      <div className="space-y-2">
        <Label>Müşteri</Label>
        <Controller
          control={control}
          name="customer_id"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Müşteri seç" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Durum</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Durum seç" />
                </SelectTrigger>
                <SelectContent>
                  {reservationStatuses.map((st) => (
                    <SelectItem key={st} value={st}>
                      {reservationStatusLabels[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Fatura Durumu</Label>
          <Controller
            control={control}
            name="invoice_status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Fatura durumu" />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStatuses.map((st) => (
                    <SelectItem key={st} value={st}>
                      {invoiceStatusLabels[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.invoice_status && <p className="text-sm text-destructive">{errors.invoice_status.message}</p>}
        </div>
      </div>
    </form>
  )
}
