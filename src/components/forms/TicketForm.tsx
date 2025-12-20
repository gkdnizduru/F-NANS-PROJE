import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { format } from 'date-fns'

import { useAuth } from '../../contexts/AuthContext'
import type { Database } from '../../types/database'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { formatCurrency } from '../../lib/format'
import { cn } from '../../lib/utils'
import type {
  AirlineRow,
  TicketRow,
  TicketStatus,
  TicketUpsertPayload,
  TicketPassengerRow,
  TicketSegmentRow,
} from '../../hooks/useSupabaseQuery'
import { useAirlines } from '../../hooks/useSupabaseQuery'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const ticketSchema = z.object({
  status: z.enum(['sales', 'void', 'refund']),
  pnr_code: z.string().min(1, 'PNR zorunludur'),
  issue_date: z.date(),
  base_fare: z.number().min(0, 'Baz fiyat 0 veya daha büyük olmalı'),
  tax_amount: z.number().min(0, 'Vergi 0 veya daha büyük olmalı'),
  service_fee: z.number().min(0, 'Hizmet bedeli 0 veya daha büyük olmalı'),
  customer_id: z.string().min(1, 'Müşteri seçimi zorunludur'),
  passengers: z
    .array(
      z.object({
        passenger_name: z.string().min(1, 'Yolcu adı zorunludur'),
        ticket_number: z.string().min(1, 'Bilet no zorunludur'),
        passenger_type: z.string().min(1, 'Tip zorunludur'),
      })
    )
    .min(1, 'En az 1 yolcu girilmelidir'),
  segments: z
    .array(
      z.object({
        airline: z.string().min(1, 'Havayolu zorunludur'),
        flight_no: z.string().min(1, 'Uçuş no zorunludur'),
        origin: z.string().min(3, 'Kalkış zorunludur'),
        destination: z.string().min(3, 'Varış zorunludur'),
        flight_date: z.date(),
      })
    )
    .min(1, 'En az 1 segment girilmelidir'),
})

type TicketFormValues = z.infer<typeof ticketSchema>

type TicketPrefill = Partial<TicketFormValues>

type Props = {
  initialTicket?: TicketRow
  prefill?: TicketPrefill
  formId?: string
  customers: Database['public']['Tables']['customers']['Row'][]
  onSubmit: (payload: TicketUpsertPayload) => Promise<void>
  isSubmitting: boolean
}

function PassengersSection({ control, register, errors }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Yolcular</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ passenger_name: '', ticket_number: '', passenger_type: 'ADT' })}
        >
          Ekle
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((f: any, idx: number) => (
          <div key={f.id} className="rounded-md border p-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Yolcu</Label>
                <Input {...register(`passengers.${idx}.passenger_name`)} />
                {errors?.passengers?.[idx]?.passenger_name ? (
                  <p className="text-sm text-destructive">{errors.passengers[idx].passenger_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Bilet No</Label>
                <Input {...register(`passengers.${idx}.ticket_number`)} />
                {errors?.passengers?.[idx]?.ticket_number ? (
                  <p className="text-sm text-destructive">{errors.passengers[idx].ticket_number.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Tip</Label>
                <Input {...register(`passengers.${idx}.passenger_type`)} />
                {errors?.passengers?.[idx]?.passenger_type ? (
                  <p className="text-sm text-destructive">{errors.passengers[idx].passenger_type.message}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} disabled={fields.length <= 1}>
                Sil
              </Button>
            </div>
          </div>
        ))}
      </div>

      {errors?.passengers?.message ? <p className="text-sm text-destructive">{errors.passengers.message}</p> : null}
    </div>
  )
}

function SegmentsSection({ control, register, setValue, errors }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: 'segments' })

  const airlinesQuery = useAirlines()
  const airlines = airlinesQuery.data ?? []

  const [openByIndex, setOpenByIndex] = useState<Record<number, boolean>>({})
  const [queryByIndex, setQueryByIndex] = useState<Record<number, string>>({})

  const airlineLabel = (a: AirlineRow) => `${a.code} - ${a.name}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Uçuş Segmentleri</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ airline: '', flight_no: '', origin: '', destination: '', flight_date: new Date() })}
        >
          Ekle
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((f: any, idx: number) => (
          <div key={f.id} className="rounded-md border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Havayolu</Label>
                <Controller
                  control={control}
                  name={`segments.${idx}.airline`}
                  render={({ field }) => {
                    const value = String(field.value ?? '')
                    const selected = airlines.find((a) => a.code === value)
                    const query = queryByIndex[idx] ?? ''
                    const filtered = airlines.filter((a) => {
                      const q = query.trim().toLowerCase()
                      if (!q) return true
                      return airlineLabel(a).toLowerCase().includes(q)
                    })
                    const open = Boolean(openByIndex[idx])

                    return (
                      <Popover
                        open={open}
                        onOpenChange={(v) => setOpenByIndex((prev) => ({ ...prev, [idx]: v }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn('w-full justify-between', !selected && 'text-muted-foreground')}
                            disabled={airlinesQuery.isLoading || airlinesQuery.isError}
                          >
                            <span className="truncate">
                              {selected
                                ? airlineLabel(selected)
                                : airlinesQuery.isLoading
                                  ? 'Yükleniyor...'
                                  : 'Havayolu seç'}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                          <Command
                            value={query}
                            onValueChange={(v) => setQueryByIndex((prev) => ({ ...prev, [idx]: v }))}
                          >
                            <CommandInput placeholder="Havayolu ara..." />
                            <CommandList>
                              {filtered.length === 0 ? <CommandEmpty>Sonuç bulunamadı</CommandEmpty> : null}
                              <CommandGroup>
                                {filtered.map((a) => {
                                  const isSelected = a.code === value
                                  return (
                                    <CommandItem
                                      key={a.id}
                                      selected={isSelected}
                                      onClick={() => {
                                        setValue(`segments.${idx}.airline`, a.code, {
                                          shouldDirty: true,
                                          shouldValidate: true,
                                        })
                                        setOpenByIndex((prev) => ({ ...prev, [idx]: false }))
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                      <span className="truncate">{airlineLabel(a)}</span>
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )
                  }}
                />
                {errors?.segments?.[idx]?.airline ? (
                  <p className="text-sm text-destructive">{errors.segments[idx].airline.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Uçuş No</Label>
                <Input {...register(`segments.${idx}.flight_no`)} />
                {errors?.segments?.[idx]?.flight_no ? (
                  <p className="text-sm text-destructive">{errors.segments[idx].flight_no.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Kalkış</Label>
                <Input {...register(`segments.${idx}.origin`)} />
                {errors?.segments?.[idx]?.origin ? (
                  <p className="text-sm text-destructive">{errors.segments[idx].origin.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Varış</Label>
                <Input {...register(`segments.${idx}.destination`)} />
                {errors?.segments?.[idx]?.destination ? (
                  <p className="text-sm text-destructive">{errors.segments[idx].destination.message}</p>
                ) : null}
              </div>

              <Controller
                control={control}
                name={`segments.${idx}.flight_date`}
                render={({ field }) => (
                  <UnifiedDatePicker
                    label="Uçuş Tarihi"
                    value={field.value}
                    onChange={(d) => field.onChange(d ?? new Date())}
                  />
                )}
              />
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} disabled={fields.length <= 1}>
                Sil
              </Button>
            </div>
          </div>
        ))}
      </div>

      {errors?.segments?.message ? <p className="text-sm text-destructive">{errors.segments.message}</p> : null}
    </div>
  )
}

export function TicketForm({ initialTicket, prefill, formId, customers, onSubmit, isSubmitting }: Props) {
  const { user } = useAuth()

  const defaultValues = useMemo<TicketFormValues>(() => {
    if (initialTicket) {
      const issueDt = initialTicket.issue_date ? new Date(initialTicket.issue_date) : new Date()

      const pax: TicketPassengerRow[] = Array.isArray(initialTicket.ticket_passengers)
        ? (initialTicket.ticket_passengers as TicketPassengerRow[])
        : []

      const segs: TicketSegmentRow[] = Array.isArray(initialTicket.ticket_segments)
        ? (initialTicket.ticket_segments as TicketSegmentRow[])
        : []

      return {
        status: (initialTicket.status ?? 'sales') as TicketStatus,
        pnr_code: String(initialTicket.pnr_code ?? ''),
        issue_date: issueDt,
        base_fare: Number(initialTicket.base_fare ?? 0),
        tax_amount: Number(initialTicket.tax_amount ?? 0),
        service_fee: Number(initialTicket.service_fee ?? 0),
        customer_id: String(initialTicket.customer_id ?? ''),
        passengers: (pax.length ? pax : [{ ticket_id: initialTicket.id, passenger_name: '', ticket_number: '', passenger_type: 'ADT' }]).map(
          (p) => ({
            passenger_name: String(p.passenger_name ?? ''),
            ticket_number: String(p.ticket_number ?? ''),
            passenger_type: String(p.passenger_type ?? 'ADT'),
          })
        ),
        segments: (segs.length
          ? segs
          : [
              {
                ticket_id: initialTicket.id,
                airline: '',
                flight_no: '',
                origin: '',
                destination: '',
                flight_date: new Date().toISOString().slice(0, 10),
              } as any,
            ]
        ).map((s) => ({
          airline: String(s.airline ?? ''),
          flight_no: String(s.flight_no ?? ''),
          origin: String(s.origin ?? ''),
          destination: String(s.destination ?? ''),
          flight_date: s.flight_date ? new Date(s.flight_date) : new Date(),
        })),
      }
    }

    const base: TicketFormValues = {
      status: 'sales',
      pnr_code: '',
      issue_date: new Date(),
      base_fare: 0,
      tax_amount: 0,
      service_fee: 0,
      customer_id: '',
      passengers: [{ passenger_name: '', ticket_number: '', passenger_type: 'ADT' }],
      segments: [{ airline: '', flight_no: '', origin: '', destination: '', flight_date: new Date() }],
    }

    return {
      ...base,
      ...(prefill ?? {}),
    }
  }, [initialTicket, prefill])

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const baseFare = watch('base_fare')
  const tax = watch('tax_amount')
  const fee = watch('service_fee')

  const netPrice = Number(baseFare ?? 0) + Number(tax ?? 0)
  const sellPrice = netPrice + Number(fee ?? 0)

  const submit = async (values: TicketFormValues) => {
    if (!user) return

    const basePayload: TicketUpsertPayload = {
      pnr_code: values.pnr_code.trim(),
      issue_date: format(values.issue_date, 'yyyy-MM-dd'),
      user_id: user.id,
      customer_id: values.customer_id,
      status: values.status as TicketStatus,
      invoice_status: initialTicket?.invoice_status ?? 'pending',
      base_fare: values.base_fare,
      tax_amount: values.tax_amount,
      service_fee: values.service_fee,
      passengers: (values.passengers ?? []).map((p) => ({
        passenger_name: p.passenger_name.trim(),
        ticket_number: p.ticket_number.trim(),
        passenger_type: p.passenger_type.trim(),
      })),
      segments: (values.segments ?? []).map((s) => ({
        airline: s.airline.trim(),
        flight_no: s.flight_no.trim(),
        origin: s.origin.trim(),
        destination: s.destination.trim(),
        flight_date: format(s.flight_date, 'yyyy-MM-dd'),
      })),
    }

    const payload: TicketUpsertPayload = initialTicket?.id
      ? { ...basePayload, id: initialTicket.id }
      : basePayload

    await onSubmit(payload)
  }

  return (
    <form
      id={formId}
      className="space-y-4"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit(submit)}
    >
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
                  <SelectItem value="sales">Satış</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="refund">İade</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pnr_code">PNR</Label>
          <Input id="pnr_code" {...register('pnr_code')} />
          {errors.pnr_code && <p className="text-sm text-destructive">{errors.pnr_code.message}</p>}
        </div>

        <Controller
          control={control}
          name="issue_date"
          render={({ field }) => (
            <UnifiedDatePicker
              label="Kesim Tarihi"
              value={field.value}
              onChange={(d) => field.onChange(d ?? new Date())}
            />
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="base_fare">Baz Fiyat</Label>
          <Input
            id="base_fare"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register('base_fare', { valueAsNumber: true })}
          />
          {errors.base_fare && <p className="text-sm text-destructive">{errors.base_fare.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_amount">Vergi</Label>
          <Input
            id="tax_amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register('tax_amount', { valueAsNumber: true })}
          />
          {errors.tax_amount && <p className="text-sm text-destructive">{errors.tax_amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="service_fee">Hizmet Bedeli</Label>
          <Input
            id="service_fee"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register('service_fee', { valueAsNumber: true })}
          />
          {errors.service_fee && <p className="text-sm text-destructive">{errors.service_fee.message}</p>}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Net Tutar</span>
          <span className="font-semibold tabular-nums">{formatCurrency(netPrice)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-muted-foreground">Toplam Satış</span>
          <span className="font-semibold tabular-nums">{formatCurrency(sellPrice)}</span>
        </div>
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

      <PassengersSection control={control} register={register} errors={errors} />

      <SegmentsSection control={control} register={register} setValue={setValue} errors={errors} />
    </form>
  )
}
