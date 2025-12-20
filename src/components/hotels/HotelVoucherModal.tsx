import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { Dialog, DialogContent } from '../ui/dialog'
import { Button } from '../ui/button'
import type { HotelReservationRow } from '../../hooks/useSupabaseQuery'
import { formatShortDate } from '../../lib/format'
import type { Database } from '../../types/database'

const boardTypeLabelsTr: Record<string, string> = {
  UAI: 'Ultra Her Şey Dahil',
  AI: 'Her Şey Dahil',
  NAI: 'Alkolsüz Her Şey Dahil',
  FB: 'Tam Pansiyon',
  HB: 'Yarım Pansiyon',
  BB: 'Oda Kahvaltı',
  RO: 'Sadece Oda',
}

const boardTypeLabelsEn: Record<string, string> = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  NAI: 'Non-Alcoholic All Inclusive',
  AI: 'All Inclusive',
  UAI: 'Ultra All Inclusive',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: HotelReservationRow | null
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

type CompanyProfileRow = {
  user_id: string
  company_name: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  website: string | null
}

export function HotelVoucherModal({ open, onOpenChange, reservation }: Props) {
  const [lang, setLang] = useState<'tr' | 'en'>('tr')

  const companyProfileQuery = useQuery<CompanyProfileRow | null>({
    queryKey: ['hotel_voucher', 'company_profile'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return null

      const { data, error } = await supabase.from('company_profiles').select('*').eq('user_id', userId).single()
      if (error) return null
      return (data ?? null) as any
    },
  })

  const profileQuery = useQuery<ProfileRow | null>({
    queryKey: ['hotel_voucher', 'profile'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return null

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) return null
      return data ?? null
    },
  })

  const checkIn = reservation?.check_in_date ? new Date(reservation.check_in_date) : null
  const checkOut = reservation?.check_out_date ? new Date(reservation.check_out_date) : null
  const nights =
    checkIn && checkOut ? Math.max(0, differenceInCalendarDays(checkOut, checkIn)) : null

  const t = useMemo(() => {
    const dict = {
      tr: {
        title: 'HOTEL VOUCHER',
        guestName: 'Misafir Adı',
        pax: 'Kişi',
        hotelName: 'Otel Adı',
        destination: 'Bölge',
        dates: 'Giriş / Çıkış',
        nights: 'Gece',
        roomType: 'Oda Tipi',
        boardType: 'Pansiyon',
        confirmation: 'Onay / Referans No',
        emergency: 'Acil Durum İletişim',
        print: 'Yazdır / PDF İndir',
        close: 'Kapat',
        preview: 'Voucher Önizleme',
        adults: 'Yetişkin',
        children: 'Çocuk',
        agencyContact: 'Acenta İletişim',
        hotline: '7/24 Hat: +90 555 000 00 00',
        emergencyEmail: 'E-posta: emergency@acente.com',
      },
      en: {
        title: 'HOTEL VOUCHER',
        guestName: 'Guest Name',
        pax: 'Pax',
        hotelName: 'Hotel Name',
        destination: 'Destination',
        dates: 'Check-in / Check-out',
        nights: 'Nights',
        roomType: 'Room Type',
        boardType: 'Board Type',
        confirmation: 'Confirmation / Ref No',
        emergency: 'Emergency Contact',
        print: 'Print / Save as PDF',
        close: 'Close',
        preview: 'Voucher Preview',
        adults: 'Adults',
        children: 'Children',
        agencyContact: 'Agency Contact',
        hotline: '24/7 Hotline: +90 555 000 00 00',
        emergencyEmail: 'Email: emergency@acente.com',
      },
    } as const

    return dict[lang]
  }, [lang])

  const companyProfile = companyProfileQuery.data
  const profile = profileQuery.data
  const companyName = companyProfile?.company_name || (profile as any)?.company_name || 'Şirket'
  const senderEmail = companyProfile?.contact_email || profile?.email || ''
  const senderPhone = companyProfile?.contact_phone || ''
  const senderAddress = companyProfile?.address || ''
  const logoUrl = companyProfile?.logo_url || ''

  const pax = `${Number(reservation?.adult_count ?? 0)} ${t.adults}, ${Number(reservation?.child_count ?? 0)} ${t.children}`
  const boardLabels = lang === 'tr' ? boardTypeLabelsTr : boardTypeLabelsEn
  const board = reservation?.board_type
    ? boardLabels[String(reservation.board_type)] ?? String(reservation.board_type)
    : '-'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[980px] p-0 top-[5vh] translate-y-0 max-h-[90vh] overflow-hidden flex flex-col gap-0 [&>button.absolute]:hidden">
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="font-medium">{t.preview}</div>
          <div className="flex gap-2">
            <div className="inline-flex rounded-md border p-1 mr-2">
              <Button
                type="button"
                size="sm"
                variant={lang === 'tr' ? 'default' : 'ghost'}
                onClick={() => setLang('tr')}
              >
                TR
              </Button>
              <Button
                type="button"
                size="sm"
                variant={lang === 'en' ? 'default' : 'ghost'}
                onClick={() => setLang('en')}
              >
                EN
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.print()
              }}
            >
              {t.print}
            </Button>
          </div>
        </div>

        <div className="bg-muted/30 p-4 overflow-auto min-h-0">
          <div
            id="printable-voucher"
            className="mx-auto w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-sm border origin-top scale-[0.9]"
          >
            <div className="p-[14mm]">
              <div className="flex items-start justify-between gap-6">
                <div>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-12 w-auto max-w-[200px] object-contain"
                    />
                  ) : (
                    <div>
                      <div className="text-sm font-semibold">ACENTE LOGO</div>
                      <div className="text-xs text-slate-600 mt-1">(Logo placeholder)</div>
                    </div>
                  )}
                </div>
                <div className="text-right text-xs leading-5 text-slate-700">
                  <div className="font-semibold">{companyName}</div>
                  {senderAddress ? <div>{senderAddress}</div> : null}
                  {senderEmail ? <div>{senderEmail}</div> : null}
                  {senderPhone ? <div>{senderPhone}</div> : null}
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-2xl font-bold tracking-wide invisible">{t.title}</div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{t.guestName}</div>
                  <div className="font-semibold">{reservation?.guest_name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.pax}</div>
                  <div className="font-semibold">{pax}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-slate-500">{t.hotelName}</div>
                  <div className="text-xl font-bold">{reservation?.hotel_name || '-'}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{t.destination}</div>
                  <div className="font-semibold">{reservation?.location || '-'}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{t.dates}</div>
                  <div className="font-semibold">
                    {reservation?.check_in_date ? formatShortDate(reservation.check_in_date) : '-'}
                    {'  '}–{'  '}
                    {reservation?.check_out_date ? formatShortDate(reservation.check_out_date) : '-'}
                    {typeof nights === 'number' ? ` (${nights} ${t.nights})` : ''}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{t.roomType}</div>
                  <div className="font-semibold">{reservation?.room_type || '-'}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{t.boardType}</div>
                  <div className="font-semibold">{board}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-slate-500">{t.confirmation}</div>
                  <div className="font-semibold">{reservation?.confirmation_number || '-'}</div>
                </div>
              </div>

              <div className="mt-10 border-t pt-6">
                <div>
                  <div className="text-sm font-semibold">{t.emergency}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-700">
                    {senderPhone ? <div>{senderPhone}</div> : null}
                    {senderEmail ? <div>{senderEmail}</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
