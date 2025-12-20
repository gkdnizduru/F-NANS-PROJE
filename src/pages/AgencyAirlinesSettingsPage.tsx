import { useEffect, useMemo, useState } from 'react'

import { AppLayout } from '../components/layout/AppLayout'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import {
  type AirlineRow,
  useAirlines,
  useCreateAirline,
  useDeleteAirline,
  useUpdateAirline,
} from '../hooks/useSupabaseQuery'
import { Plane, Plus, Search, Pencil, Trash2 } from 'lucide-react'

function normalizeCode(v: string) {
  return v.trim().toUpperCase()
}

export function AgencyAirlinesSettingsPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AirlineRow | null>(null)
  const [deleting, setDeleting] = useState<AirlineRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const airlinesQuery = useAirlines()
  const createAirline = useCreateAirline()
  const updateAirline = useUpdateAirline()
  const deleteAirline = useDeleteAirline()

  const airlines = airlinesQuery.data ?? []

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return airlines

    return airlines.filter((a) => {
      const code = String(a.code ?? '').toLowerCase()
      const name = String(a.name ?? '').toLowerCase()
      return code.includes(q) || name.includes(q)
    })
  }, [airlines, searchQuery])

  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) {
      setEditing(null)
      setCode('')
      setName('')
      return
    }

    if (editing) {
      setCode(editing.code ?? '')
      setName(editing.name ?? '')
    } else {
      setCode('')
      setName('')
    }
  }, [editing, open])

  const canSave = normalizeCode(code).length >= 2 && name.trim().length > 1

  return (
    <AppLayout title="Havayolu Tanımları">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Liste</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kod veya isim ara..."
                  className="pl-9"
                />
              </div>

              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditing(null)
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditing(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Havayolu
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>{editing ? 'Havayolu Düzenle' : 'Yeni Havayolu'}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Kod</Label>
                        <Input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="Örn: TK"
                          autoCapitalize="characters"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ad</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Türk Hava Yolları" />
                      </div>
                    </div>

                    {(createAirline.error || updateAirline.error) ? (
                      <p className="text-sm text-destructive">
                        {((createAirline.error || updateAirline.error) as any)?.message || 'İşlem başarısız'}
                      </p>
                    ) : null}

                    <div className="flex justify-end">
                      <Button
                        disabled={!canSave || createAirline.isPending || updateAirline.isPending}
                        onClick={async () => {
                          try {
                            if (editing) {
                              await updateAirline.mutateAsync({
                                id: editing.id,
                                patch: { code: normalizeCode(code), name: name.trim() },
                              })
                              toast({ title: 'Havayolu güncellendi' })
                            } else {
                              await createAirline.mutateAsync({ code: normalizeCode(code), name: name.trim() })
                              toast({ title: 'Havayolu eklendi' })
                            }
                            setOpen(false)
                            setEditing(null)
                          } catch (e: any) {
                            toast({ title: 'İşlem başarısız', description: e?.message, variant: 'destructive' })
                          }
                        }}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {airlinesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : airlinesQuery.isError ? (
              <p className="text-sm text-destructive">{(airlinesQuery.error as any)?.message || 'Havayolları yüklenemedi'}</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Kod</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Ad</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Plane className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((a) => (
                        <tr key={a.id} className="border-b last:border-b-0">
                          <td className="p-4 font-medium">{a.code}</td>
                          <td className="p-4">{a.name}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditing(a)
                                  setOpen(true)
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Düzenle
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setDeleting(a)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(v) => {
            if (!v) setDeleting(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteAirline.isPending || !deleting}
                onClick={async () => {
                  if (!deleting) return
                  try {
                    await deleteAirline.mutateAsync({ id: deleting.id, itemName: `${deleting.code} - ${deleting.name}` })
                    toast({ title: 'Kayıt silindi' })
                  } catch (e: any) {
                    toast({ title: 'Silme işlemi başarısız', description: e?.message, variant: 'destructive' })
                  } finally {
                    setDeleting(null)
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
