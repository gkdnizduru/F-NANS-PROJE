import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type GeminiFlightPayload = {
  airline: string
  pnr: string
  flight_date: string // YYYY-MM-DD
  flight_time: string // HH:MM
  origin: string
  destination: string
  passenger_name: string
}

function extractJson(text: string): string {
  const t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) return fenced[1].trim()
  return t
}

function parseGeminiJson(text: string): GeminiFlightPayload {
  const raw = extractJson(text)
  const parsed = JSON.parse(raw) as Partial<GeminiFlightPayload>

  const airline = String(parsed.airline ?? '').trim()
  const pnr = String(parsed.pnr ?? '').trim()
  const flight_date = String(parsed.flight_date ?? '').trim()
  const flight_time = String(parsed.flight_time ?? '').trim()
  const origin = String(parsed.origin ?? '').trim()
  const destination = String(parsed.destination ?? '').trim()
  const passenger_name = String(parsed.passenger_name ?? '').trim()

  if (!pnr || !flight_date || !origin || !destination || !passenger_name) {
    throw new Error('Gemini yanıtı eksik alan içeriyor.')
  }

  return {
    airline,
    pnr,
    flight_date,
    flight_time: flight_time || '00:00',
    origin,
    destination,
    passenger_name,
  }
}

function computeCheckInOpenAt(flightDate: string, flightTime: string): string {
  const safeTime = flightTime && /^\d{2}:\d{2}$/.test(flightTime) ? flightTime : '00:00'
  const flightDt = new Date(`${flightDate}T${safeTime}:00`)
  if (Number.isNaN(flightDt.getTime())) {
    throw new Error('Uçuş tarihi/saat formatı geçersiz.')
  }

  const checkInOpenAt = new Date(flightDt.getTime() - 24 * 60 * 60 * 1000)
  return checkInOpenAt.toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    if (!supabaseUrl) throw new Error('SUPABASE_URL env var yok')
    if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY env var yok')
    if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var yok')
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY env var yok')

    const { emailText } = (await req.json().catch(() => ({}))) as { emailText?: string }
    if (!emailText || !String(emailText).trim()) {
      return new Response(JSON.stringify({ error: 'emailText zorunludur' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization') ?? ''

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
      auth: {
        persistSession: false,
      },
    })

    const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser()
    if (userErr) throw userErr
    const userId = userData.user?.id
    if (!userId) throw new Error('Oturum bulunamadı (Authorization header gerekli).')

    const prompt =
      "Aşağıdaki metinden uçuş bilgilerini JSON formatında çıkar: airline, pnr, flight_date (YYYY-MM-DD), flight_time (HH:MM), origin, destination, passenger_name. Sadece JSON döndür.\n\n" +
      emailText

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
          },
        }),
      },
    )

    if (!geminiResp.ok) {
      const errText = await geminiResp.text().catch(() => '')
      throw new Error(`Gemini API hata: ${geminiResp.status} ${errText}`)
    }

    const geminiJson = (await geminiResp.json()) as any
    const modelText = String(
      geminiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '',
    ).trim()

    if (!modelText) throw new Error('Gemini boş yanıt döndürdü.')

    const flight = parseGeminiJson(modelText)
    const check_in_open_at = computeCheckInOpenAt(flight.flight_date, flight.flight_time)

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    // NOTE: Codebase'te uçuş detayları tickets yerine ticket_segments/ticket_passengers tablolarında tutuluyor.
    const { data: ticketRow, error: ticketErr } = await supabaseAdmin
      .from('tickets')
      .insert({
        user_id: userId,
        customer_id: null,
        pnr_code: flight.pnr,
        issue_date: flight.flight_date,
        base_fare: 0,
        tax_amount: 0,
        service_fee: 0,
        status: 'sales',
        invoice_status: 'pending',
      })
      .select('id')
      .single()

    if (ticketErr) throw ticketErr
    const ticketId = String(ticketRow?.id)

    const { error: paxErr } = await supabaseAdmin.from('ticket_passengers').insert({
      ticket_id: ticketId,
      passenger_name: flight.passenger_name,
      ticket_number: null,
      passenger_type: null,
    })
    if (paxErr) throw paxErr

    const { error: segErr } = await supabaseAdmin.from('ticket_segments').insert({
      ticket_id: ticketId,
      airline: flight.airline || null,
      flight_no: null,
      origin: flight.origin,
      destination: flight.destination,
      flight_date: flight.flight_date,
    })
    if (segErr) throw segErr

    return new Response(
      JSON.stringify({
        ok: true,
        ticket_id: ticketId,
        extracted: flight,
        check_in_open_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
