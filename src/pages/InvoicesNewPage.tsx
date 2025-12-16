import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { CreateInvoiceForm } from '../components/forms/CreateInvoiceForm'
import { toast } from '../components/ui/use-toast'

type InvoicePrefillItem = {
  description: string
  quantity: number
  unitPrice: number
}

type InvoicePrefill = {
  customerId?: string
  items?: InvoicePrefillItem[]
  notes?: string
  taxRate?: number
}

export function InvoicesNewPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const prefill = useMemo(() => {
    const state = location.state as any
    return (state?.prefill ?? undefined) as InvoicePrefill | undefined
  }, [location.state])

  return (
    <AppLayout title="Yeni Fatura">
      <div className="max-w-4xl">
        <CreateInvoiceForm
          prefill={prefill}
          onSuccess={() => {
            toast({ title: 'Fatura başarıyla oluşturuldu!' })
            navigate('/faturalar')
          }}
        />
      </div>
    </AppLayout>
  )
}
