import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '../components/layout/AppLayout'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { toast } from '../components/ui/use-toast'
import { useTheme } from '../components/theme-provider'
import { useAuth } from '../contexts/AuthContext'
import { useCategories, useCreateCategory, useDeleteCategory } from '../hooks/useSupabaseQuery'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { LogOut, Pencil, Plus, Trash2, Upload } from 'lucide-react'

type CategoryRow = Database['public']['Tables']['categories']['Row']

type CompanyProfileRow = {
  user_id: string
  company_name: string | null
  logo_url: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  website: string | null
}

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [notifications, setNotifications] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [newIncomeCategory, setNewIncomeCategory] = useState('')
  const [newExpenseCategory, setNewExpenseCategory] = useState('')

  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false)

  const incomeCategoriesQuery = useCategories('income')
  const expenseCategoriesQuery = useCategories('expense')
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()

  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileInitialized, setProfileInitialized] = useState(false)

  const companyProfileQuery = useQuery<CompanyProfileRow | null>({
    queryKey: ['company_profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const userId = user?.id
      if (!userId) return null

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      console.log('Fetched Profile:', data, error)

      if (error && (error as any)?.code !== 'PGRST116') throw error

      return (data ?? null) as any
    },
  })

  useEffect(() => {
    if (profileInitialized) return

    if (companyProfileQuery.isLoading || companyProfileQuery.isFetching) return
    if (companyProfileQuery.isError) return

    const p = companyProfileQuery.data
    if (!user) return

    setFullName(p?.contact_name ?? '')
    setCompanyName(p?.company_name ?? '')
    setContactEmail(p?.contact_email ?? user.email ?? '')
    setPhone(p?.contact_phone ?? '')
    setAddress(p?.address ?? '')
    setWebsite(p?.website ?? '')
    setLogoUrl(p?.logo_url ?? '')

    setProfileInitialized(true)
  }, [companyProfileQuery.data, companyProfileQuery.isFetching, companyProfileQuery.isLoading, profileInitialized, user])

  const canSaveCategoryEdit = useMemo(() => {
    return Boolean(editingCategory) && editingName.trim().length > 0 && !isUpdatingCategory
  }, [editingCategory, editingName, isUpdatingCategory])

  const handleUpdateCategory = async () => {
    if (!editingCategory) return
    const name = editingName.trim()
    if (!name) return

    try {
      setIsUpdatingCategory(true)
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', editingCategory.id)

      if (error) throw error

      toast({ title: 'Kategori güncellendi' })
      setEditingCategory(null)
      setEditingName('')

      await Promise.all([incomeCategoriesQuery.refetch(), expenseCategoriesQuery.refetch()])
    } catch (e: any) {
      toast({
        title: 'Kategori güncellenemedi',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingCategory(false)
    }
  }

  const isDark = resolvedTheme === 'dark'

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      setIsSavingProfile(true)

      const payload: CompanyProfileRow = {
        user_id: user.id,
        company_name: companyName.trim() || null,
        logo_url: logoUrl.trim() || null,
        contact_name: fullName.trim() || null,
        contact_email: contactEmail.trim() || user.email || null,
        contact_phone: phone.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
      }

      const { error } = await supabase.from('company_profiles').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error

      toast({ title: 'Şirket profili kaydedildi' })
      setProfileInitialized(false)
      await companyProfileQuery.refetch()
    } catch (e: any) {
      toast({
        title: 'Kayıt başarısız',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (!user) return
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase
        .storage
        .from('company-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
      const publicUrl = data.publicUrl
      setLogoUrl(publicUrl)

      toast({ title: 'Logo yüklendi' })
    } catch (e: any) {
      toast({
        title: 'Logo yüklenemedi',
        description: e?.message,
        variant: 'destructive',
      })
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleUpdatePassword = async () => {
    const password = newPassword
    const confirm = confirmPassword

    if (!password || !confirm) {
      toast({
        title: 'Şifre güncellenemedi',
        description: 'Lütfen tüm alanları doldurun',
        variant: 'destructive',
      })
      return
    }

    if (password !== confirm) {
      toast({
        title: 'Şifre güncellenemedi',
        description: 'Şifreler eşleşmiyor',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsUpdatingPassword(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast({ title: 'Şifreniz başarıyla güncellendi' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      toast({
        title: 'Şifre güncellenemedi',
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <AppLayout title="Ayarlar">
      <div className="space-y-6 max-w-4xl">
        {/* Profile & Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profil & Şirket Bilgileri</CardTitle>
            <CardDescription>
              Kişisel ve şirket bilgilerinizi güncelleyin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full border border-border overflow-hidden bg-muted flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs text-muted-foreground">Logo</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Logo</div>
                  <div className="text-xs text-muted-foreground">PNG/JPG • önerilen 512x512</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    void handleLogoUpload(f)
                    e.currentTarget.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!user}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {logoUrl ? 'Değiştir' : 'Logo Yükle'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input
                  id="fullName"
                  placeholder="Adınız Soyadınız"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Şirket Adı</Label>
                <Input
                  id="companyName"
                  placeholder="Şirket adınız"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">İletişim E-posta</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="info@sirket.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  placeholder="+90 (5XX) XXX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://sirket.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <textarea
                id="address"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Şirket adresiniz"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isSavingProfile || companyProfileQuery.isFetching}>
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Kategoriler</CardTitle>
            <CardDescription>
              Gelir ve gider kategorilerinizi yönetin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="income" className="w-full">
              <TabsList className="w-full rounded-xl bg-muted/60 p-1">
                <TabsTrigger className="flex-1 rounded-lg" value="income">
                  Gelir Kategorileri
                </TabsTrigger>
                <TabsTrigger className="flex-1 rounded-lg" value="expense">
                  Gider Kategorileri
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income" className="mt-4 transition-all duration-200">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
                  <div className="flex items-center gap-2 border-b border-border/50 p-4">
                    <Input
                      placeholder="Yeni gelir kategorisi"
                      value={newIncomeCategory}
                      onChange={(e) => setNewIncomeCategory(e.target.value)}
                      className="bg-muted/60 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!user || createCategory.isPending}
                      onClick={async () => {
                        const name = newIncomeCategory.trim()
                        if (!user || !name) return
                        try {
                          await createCategory.mutateAsync({
                            user_id: user.id,
                            name,
                            type: 'income',
                          })
                          setNewIncomeCategory('')
                          toast({ title: 'Kategori eklendi' })
                        } catch (e: any) {
                          toast({
                            title: 'Kategori eklenemedi',
                            description: e?.message,
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Ekle
                    </Button>
                  </div>

                  {(incomeCategoriesQuery.data ?? []).length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Henüz kategori yok</div>
                  ) : (
                    <div>
                      {(incomeCategoriesQuery.data ?? []).map((c, idx, arr) => (
                        <div
                          key={c.id}
                          className={
                            'flex items-center justify-between p-4' +
                            (idx !== arr.length - 1 ? ' border-b border-border/50' : '')
                          }
                        >
                          <span className="text-sm font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                setEditingCategory(c as any)
                                setEditingName(c.name ?? '')
                              }}
                              title="Düzenle"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await deleteCategory.mutateAsync({ id: c.id, itemName: c.name })
                                  toast({ title: 'Kategori silindi' })
                                } catch (e: any) {
                                  toast({
                                    title: 'Silme işlemi başarısız',
                                    description: e?.message,
                                    variant: 'destructive',
                                  })
                                }
                              }}
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="expense" className="mt-4 transition-all duration-200">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
                  <div className="flex items-center gap-2 border-b border-border/50 p-4">
                    <Input
                      placeholder="Yeni gider kategorisi"
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      className="bg-muted/60 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!user || createCategory.isPending}
                      onClick={async () => {
                        const name = newExpenseCategory.trim()
                        if (!user || !name) return
                        try {
                          await createCategory.mutateAsync({
                            user_id: user.id,
                            name,
                            type: 'expense',
                          })
                          setNewExpenseCategory('')
                          toast({ title: 'Kategori eklendi' })
                        } catch (e: any) {
                          toast({
                            title: 'Kategori eklenemedi',
                            description: e?.message,
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Ekle
                    </Button>
                  </div>

                  {(expenseCategoriesQuery.data ?? []).length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Henüz kategori yok</div>
                  ) : (
                    <div>
                      {(expenseCategoriesQuery.data ?? []).map((c, idx, arr) => (
                        <div
                          key={c.id}
                          className={
                            'flex items-center justify-between p-4' +
                            (idx !== arr.length - 1 ? ' border-b border-border/50' : '')
                          }
                        >
                          <span className="text-sm font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                setEditingCategory(c as any)
                                setEditingName(c.name ?? '')
                              }}
                              title="Düzenle"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await deleteCategory.mutateAsync({ id: c.id, itemName: c.name })
                                  toast({ title: 'Kategori silindi' })
                                } catch (e: any) {
                                  toast({
                                    title: 'Silme işlemi başarısız',
                                    description: e?.message,
                                    variant: 'destructive',
                                  })
                                }
                              }}
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Dialog
              open={Boolean(editingCategory)}
              onOpenChange={(v) => {
                if (!v) {
                  setEditingCategory(null)
                  setEditingName('')
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Kategoriyi Düzenle</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="editCategoryName">Kategori Adı</Label>
                  <Input
                    id="editCategoryName"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Kategori adı"
                    disabled={isUpdatingCategory}
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(null)
                      setEditingName('')
                    }}
                    disabled={isUpdatingCategory}
                  >
                    İptal
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateCategory}
                    disabled={!canSaveCategoryEdit}
                  >
                    Kaydet
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Uygulama Ayarları</CardTitle>
            <CardDescription>
              Görünüm ve bildirim tercihlerinizi yönetin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="darkMode">Karanlık Mod</Label>
                <p className="text-sm text-muted-foreground">
                  Koyu tema kullan
                </p>
              </div>
              <button
                id="darkMode"
                role="switch"
                aria-checked={isDark}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDark ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Bildirimleri Aç</Label>
                <p className="text-sm text-muted-foreground">
                  Önemli güncellemelerden haberdar olun
                </p>
              </div>
              <button
                id="notifications"
                role="switch"
                aria-checked={notifications}
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Güvenlik</CardTitle>
            <CardDescription>Hesap şifrenizi güncelleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Yeni şifreniz"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Şifreyi onaylayın"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
                Şifreyi Güncelle
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Oturum</CardTitle>
            <CardDescription>
              Hesabınızdan çıkış yapın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Çıkış Yap
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
