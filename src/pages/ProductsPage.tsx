import { useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { ProductForm } from '../components/forms/ProductForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useDeleteProduct, useProducts } from '../hooks/useSupabaseQuery'
import { formatCurrency } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'

type ProductRow = Database['public']['Tables']['products']['Row']

export function ProductsPage() {
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const productsQuery = useProducts()
  const deleteProduct = useDeleteProduct()

  const products = productsQuery.data ?? []

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products

    return products.filter((p) => {
      const name = String(p.name ?? '').toLowerCase()
      const sku = String(p.sku ?? '').toLowerCase()
      return name.includes(q) || sku.includes(q)
    })
  }, [products, searchQuery])

  return (
    <AppLayout title="Ürün ve Hizmetler">
      <div className="space-y-6">
        <div>
          <div>
            <h2 className="text-2xl font-semibold">Ürün ve Hizmetler</h2>
            <p className="text-sm text-muted-foreground mt-1">Kataloğunuzu yönetin</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Liste</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ürün adı veya SKU ara..."
                  className="pl-9"
                />
              </div>

              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingProduct(null)
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingProduct(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Ürün Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? 'Ürün/Hizmet Düzenle' : 'Yeni Ürün/Hizmet'}
                    </DialogTitle>
                  </DialogHeader>
                  <ProductForm
                    initialProduct={editingProduct ?? undefined}
                    onSuccess={() => {
                      setOpen(false)
                      toast({
                        title: editingProduct ? 'Kayıt güncellendi' : 'Kayıt oluşturuldu',
                      })
                      setEditingProduct(null)
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : productsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(productsQuery.error as any)?.message || 'Ürünler yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Ad</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">SKU</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tip</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Fiyat</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Stok</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Kataloğunuz boş.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isProduct = p.type === 'product'
                        const badgeClass = isProduct
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'

                        return (
                          <tr key={p.id} className="border-b">
                            <td className="p-4">
                              <div className="font-medium">{p.name}</div>
                              {p.description ? (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {p.description}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-4">{p.sku || '-'}</td>
                            <td className="p-4">
                              <Badge variant="outline" className={cn('capitalize', badgeClass)}>
                                {isProduct ? 'Ürün' : 'Hizmet'}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums">{formatCurrency(Number(p.unit_price ?? 0))}</td>
                            <td className="p-4 text-right tabular-nums">
                              {isProduct ? (p.stock_quantity ?? 0).toLocaleString('tr-TR') : '-'}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingProduct(p)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Düzenle
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeletingProduct(p)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </Button>
                              </div>
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

        <AlertDialog
          open={Boolean(deletingProduct)}
          onOpenChange={(v) => {
            if (!v) setDeletingProduct(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingProduct(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteProduct.isPending || !deletingProduct}
                onClick={async () => {
                  if (!deletingProduct) return
                  try {
                    await deleteProduct.mutateAsync({
                      id: deletingProduct.id,
                      itemName: deletingProduct.name,
                    })
                    toast({ title: 'Kayıt silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: (e as any)?.message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingProduct(null)
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
