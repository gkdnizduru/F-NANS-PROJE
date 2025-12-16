import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { format } from 'date-fns'

import { useAuth } from '../../contexts/AuthContext'
import { useCreateDeal, useCustomers, useUpdateDeal } from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'

const dealSchema = z.object({
  title: z.string().min(1, 'Başlık zorunludur'),
  customerId: z.string().min(1, 'Müşteri zorunludur'),
  value: z.number().nonnegative('Tutar 0 veya büyük olmalı'),
  stage: z.enum(['new', 'meeting', 'proposal', 'negotiation', 'won', 'lost']),
  expectedCloseDate: z.date(),
})

type DealFormValues = z.infer<typeof dealSchema>

type DealRow = Database['public']['Tables']['deals']['Row']

type DealFormProps = {
  initialDeal?: DealRow
  onSuccess?: () => void
}

export function DealForm({ initialDeal, onSuccess }: DealFormProps) {
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()

  const isEditing = Boolean(initialDeal?.id)

  const defaultValues = useMemo<DealFormValues>(() => {
    if (isEditing && initialDeal) {
      return {
        title: initialDeal.title,
        customerId: initialDeal.customer_id,
        value: Number(initialDeal.value ?? 0),
        stage: initialDeal.stage,
        expectedCloseDate: new Date(initialDeal.expected_close_date),
      }
    }

    return {
      title: '',
      customerId: '',
      value: 0,
      stage: 'new',
      expectedCloseDate: new Date(),
    }
  }, [initialDeal, isEditing])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const onSubmit = async (values: DealFormValues) => {
    if (!user) return

    if (isEditing && initialDeal?.id) {
      await updateDeal.mutateAsync({
        id: initialDeal.id,
        patch: {
          title: values.title.trim(),
          customer_id: values.customerId,
          value: Number(values.value ?? 0),
          stage: values.stage,
          expected_close_date: format(values.expectedCloseDate, 'yyyy-MM-dd'),
        },
      })

      onSuccess?.()
      return
    }

    await createDeal.mutateAsync({
      user_id: user.id,
      customer_id: values.customerId,
      title: values.title.trim(),
      value: Number(values.value ?? 0),
      stage: values.stage,
      expected_close_date: format(values.expectedCloseDate, 'yyyy-MM-dd'),
    })

    onSuccess?.()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="title">Başlık</Label>
        <Input id="title" placeholder="Örn: Website Redesign Project" {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Müşteri</Label>
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Müşteri seç" />
              </SelectTrigger>
              <SelectContent>
                {(customersQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="value">Tutar</Label>
          <Input id="value" type="number" step="0.01" {...register('value', { valueAsNumber: true })} />
          {errors.value && <p className="text-sm text-destructive">{errors.value.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Aşama</Label>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Aşama seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Yeni Fırsat</SelectItem>
                  <SelectItem value="meeting">Toplantı</SelectItem>
                  <SelectItem value="proposal">Teklif</SelectItem>
                  <SelectItem value="negotiation">Pazarlık</SelectItem>
                  <SelectItem value="won">Kazanıldı</SelectItem>
                  <SelectItem value="lost">Kaybedildi</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <Controller
        control={control}
        name="expectedCloseDate"
        render={({ field }) => (
          <UnifiedDatePicker
            label="Tahmini Kapanış"
            value={field.value}
            onChange={(d) => field.onChange(d ?? new Date())}
          />
        )}
      />

      {(createDeal.error || updateDeal.error) && (
        <p className="text-sm text-destructive">
          {((createDeal.error || updateDeal.error) as any)?.message ||
            (isEditing ? 'Fırsat güncellenemedi' : 'Fırsat oluşturulamadı')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={createDeal.isPending || updateDeal.isPending || !user}>
          Kaydet
        </Button>
      </div>
    </form>
  )
}
