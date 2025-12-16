import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import {
  useCreateQuote,
  useCustomers,
  useProducts,
  useQuoteItems,
  useUpdateQuote,
} from '../../hooks/useSupabaseQuery'
import type { Database } from '../../types/database'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { UnifiedDatePicker } from '../shared/UnifiedDatePicker'

const quoteItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Ürün/Hizmet zorunludur'),
  quantity: z.number().positive('Adet 0’dan büyük olmalı'),
  unitPrice: z.number().nonnegative('Fiyat 0 veya büyük olmalı'),
})

const quoteSchema = z.object({
  customerId: z.string().min(1, 'Müşteri zorunludur'),
  quoteNumber: z.string().min(1, 'Teklif no zorunludur'),
  issueDate: z.date(),
  expiryDate: z.date(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'converted']),
  taxRate: z.number().nonnegative(),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, 'En az 1 kalem ekleyin'),
})

type CreateQuoteValues = z.infer<typeof quoteSchema>

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']

type CreateQuoteFormProps = {
  initialQuote?: QuoteRow
  onSuccess?: () => void
}

function createDefaultQuoteNumber() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `QT-${yyyy}${rand}`
}

function productLabel(p: ProductRow) {
  const sku = p.sku ? ` (${p.sku})` : ''
  return `${p.name}${sku}`
}

export function CreateQuoteForm({ initialQuote, onSuccess }: CreateQuoteFormProps) {
  const { user } = useAuth()
  const customersQuery = useCustomers()
  const productsQuery = useProducts()

  const quoteItemsQuery = useQuoteItems(initialQuote?.id)

  const createQuote = useCreateQuote()
  const updateQuote = useUpdateQuote()

  const isEditing = Boolean(initialQuote?.id)

  const [productPickerOpenByIndex, setProductPickerOpenByIndex] = useState<Record<number, boolean>>({})
  const [productPickerQueryByIndex, setProductPickerQueryByIndex] = useState<Record<number, string>>({})

  const defaultValues = useMemo<CreateQuoteValues>(() => {
    if (isEditing && initialQuote) {
      const items: CreateQuoteValues['items'] = (quoteItemsQuery.data ?? []).length
        ? (quoteItemsQuery.data ?? []).map((it) => ({
            productId: it.product_id ?? undefined,
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
          }))
        : [{ productId: undefined, description: '', quantity: 1, unitPrice: 0 }]

      return {
        customerId: initialQuote.customer_id,
        quoteNumber: initialQuote.quote_number,
        issueDate: new Date(initialQuote.issue_date),
        expiryDate: new Date(initialQuote.expiry_date),
        status: initialQuote.status,
        taxRate: Number(initialQuote.tax_rate ?? 0),
        notes: initialQuote.notes ?? '',
        items,
      }
    }

    return {
      customerId: '',
      quoteNumber: createDefaultQuoteNumber(),
      issueDate: new Date(),
      expiryDate: new Date(),
      status: 'draft',
      taxRate: 20,
      notes: '',
      items: [{ productId: undefined, description: '', quantity: 1, unitPrice: 0 }],
    }
  }, [initialQuote, isEditing, quoteItemsQuery.data])

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateQuoteValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const items = watch('items')
  const taxRate = watch('taxRate')

  const productsById = useMemo(() => {
    return new Map((productsQuery.data ?? []).map((p) => [p.id, p]))
  }, [productsQuery.data])

  const subtotal = (items ?? []).reduce(
    (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  )
  const taxAmount = subtotal * (Number(taxRate || 0) / 100)
  const totalAmount = subtotal + taxAmount

  const onSubmit = async (values: CreateQuoteValues) => {
    if (!user) return

    const nextSubtotal = (values.items ?? []).reduce(
      (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
      0
    )
    const nextTaxAmount = nextSubtotal * (Number(values.taxRate || 0) / 100)
    const nextTotalAmount = nextSubtotal + nextTaxAmount

    const mappedItems: Array<Omit<Database['public']['Tables']['quote_items']['Insert'], 'quote_id'>> =
      values.items.map((it) => ({
        product_id: it.productId?.trim() ? it.productId.trim() : null,
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unitPrice),
        amount: Number(it.quantity) * Number(it.unitPrice),
      }))

    if (isEditing && initialQuote?.id) {
      await updateQuote.mutateAsync({
        id: initialQuote.id,
        quote: {
          customer_id: values.customerId,
          quote_number: values.quoteNumber,
          issue_date: format(values.issueDate, 'yyyy-MM-dd'),
          expiry_date: format(values.expiryDate, 'yyyy-MM-dd'),
          status: values.status,
          subtotal: nextSubtotal,
          tax_rate: Number(values.taxRate || 0),
          tax_amount: nextTaxAmount,
          total_amount: nextTotalAmount,
          notes: values.notes?.trim() || null,
        },
        items: mappedItems,
      })

      onSuccess?.()
      return
    }

    await createQuote.mutateAsync({
      quote: {
        user_id: user.id,
        customer_id: values.customerId,
        quote_number: values.quoteNumber,
        issue_date: format(values.issueDate, 'yyyy-MM-dd'),
        expiry_date: format(values.expiryDate, 'yyyy-MM-dd'),
        status: values.status,
        subtotal: nextSubtotal,
        tax_rate: Number(values.taxRate || 0),
        tax_amount: nextTaxAmount,
        total_amount: nextTotalAmount,
        notes: values.notes?.trim() || null,
      },
      items: mappedItems,
    })

    onSuccess?.()
  }

  const renderProductCombobox = (index: number) => {
    const row = items?.[index]
    const selectedProductId = row?.productId
    const selectedProduct = selectedProductId ? productsById.get(selectedProductId) : undefined

    const query = productPickerQueryByIndex[index] ?? ''
    const filtered = (productsQuery.data ?? []).filter((p) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return productLabel(p).toLowerCase().includes(q)
    })

    const open = Boolean(productPickerOpenByIndex[index])

    return (
      <Popover
        open={open}
        onOpenChange={(v) => setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: v }))}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', !selectedProduct && 'text-muted-foreground')}
            disabled={productsQuery.isLoading || productsQuery.isError}
          >
            <span className="truncate">
              {selectedProduct
                ? productLabel(selectedProduct)
                : productsQuery.isLoading
                  ? 'Yükleniyor...'
                  : 'Ürün/Hizmet Seç'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <Command
            value={query}
            onValueChange={(v) => setProductPickerQueryByIndex((prev) => ({ ...prev, [index]: v }))}
          >
            <CommandInput placeholder="Ürün ara..." />
            <CommandList>
              {filtered.length === 0 ? <CommandEmpty>Sonuç bulunamadı</CommandEmpty> : null}
              <CommandGroup>
                <CommandItem
                  selected={!selectedProductId}
                  onClick={() => {
                    setValue(`items.${index}.productId`, undefined)
                    setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: false }))
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('h-4 w-4', !selectedProductId ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">(Özel Kalem)</span>
                </CommandItem>

                {filtered.map((p) => {
                  const isSelected = p.id === selectedProductId
                  return (
                    <CommandItem
                      key={p.id}
                      selected={isSelected}
                      onClick={() => {
                        setValue(`items.${index}.productId`, p.id)
                        setValue(`items.${index}.description`, p.description ?? p.name)
                        setValue(`items.${index}.unitPrice`, Number(p.unit_price ?? 0))
                        setProductPickerOpenByIndex((prev) => ({ ...prev, [index]: false }))
                      }}
                      className="flex items-center gap-2"
                    >
                      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{productLabel(p)}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
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

          <div className="space-y-2">
            <Label htmlFor="quoteNumber">Teklif No</Label>
            <Input id="quoteNumber" {...register('quoteNumber')} />
            {errors.quoteNumber && <p className="text-sm text-destructive">{errors.quoteNumber.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Controller
            control={control}
            name="issueDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label="Düzenlenme Tarihi"
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
          <Controller
            control={control}
            name="expiryDate"
            render={({ field }) => (
              <UnifiedDatePicker
                label="Geçerlilik Tarihi"
                value={field.value}
                onChange={(d) => field.onChange(d ?? new Date())}
              />
            )}
          />
          <div className="space-y-2">
            <Label>Durum</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="sent">Gönderildi</SelectItem>
                    <SelectItem value="accepted">Onaylandı</SelectItem>
                    <SelectItem value="rejected">Reddedildi</SelectItem>
                    <SelectItem value="converted">Faturaya Dönüştü</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Kalemler</h3>
          <Button type="button" variant="outline" onClick={() => append({ productId: undefined, description: '', quantity: 1, unitPrice: 0 })}>
            <Plus className="mr-2 h-4 w-4" />
            Kalem Ekle
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const row = items?.[index]
            const rowTotal = Number(row?.quantity || 0) * Number(row?.unitPrice || 0)

            return (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-4 space-y-2">
                    <Label>Ürün</Label>
                    {renderProductCombobox(index)}
                  </div>

                  <div className="md:col-span-4 space-y-2">
                    <Label>Açıklama</Label>
                    <Input placeholder="Açıklama" {...register(`items.${index}.description` as const)} />
                    {errors.items?.[index]?.description && (
                      <p className="text-sm text-destructive">{errors.items[index]?.description?.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Adet</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Birim Fiyat</Label>
                    <Input type="number" step="0.01" {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                  </div>

                  <div className="md:col-span-12 flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">Satır Toplamı: <span className="font-medium text-foreground">₺{rowTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span></div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Kaldır
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {typeof errors.items?.message === 'string' ? (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        ) : null}
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="taxRate">KDV (%)</Label>
            <Input id="taxRate" type="number" step="0.01" {...register('taxRate', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea id="notes" placeholder="Opsiyonel" {...register('notes')} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span className="font-medium">₺{subtotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">KDV</span>
            <span className="font-medium">₺{taxAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Genel Toplam</span>
            <span className="text-lg font-bold">₺{totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {(createQuote.error || updateQuote.error) && (
        <p className="text-sm text-destructive">
          {((createQuote.error || updateQuote.error) as any)?.message ||
            (isEditing ? 'Teklif güncellenemedi' : 'Teklif oluşturulamadı')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={createQuote.isPending || updateQuote.isPending || !user}>
          {isEditing ? 'Teklifi Güncelle' : 'Teklif Oluştur'}
        </Button>
      </div>
    </form>
  )
}
