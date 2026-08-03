"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Edit3, Trash2, Check, ArrowLeft, Upload, X, Package } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import Image from "next/image";

export default function ProductosAdmin() {
  const [products, setProducts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null); // null=lista, "new"=nuevo, obj=editando

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = () => fetch("/api/admin/products").then((r) => r.json()).then(setProducts);

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await fetch("/api/admin/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    loadProducts();
  };

  if (editing) return (
    <ProductForm product={editing === "new" ? null : editing}
      onCancel={() => setEditing(null)}
      onSaved={() => { setEditing(null); loadProducts(); }} />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold">Productos</h1>
        <button onClick={() => setEditing("new")}
          className="bg-copper text-white font-semibold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-copper-bright transition-colors">
          <Plus size={15} /> Nuevo producto
        </button>
      </div>
      <div className="font-mono text-xs text-muted mb-3">{products.length} productos en catálogo</div>
      <div className="bg-card border border-hair rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-hair">
            <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">Producto</th>
            <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">SKU</th>
            <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">Precio</th>
            <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody>
            {products.map((p: any) => {
              const minPrice = p.variants?.length ? Math.min(...p.variants.map((v: any) => Number(v.price))) : Number(p.price) || 0;
              return (
                <tr key={p.id} className="border-b border-hair hover:bg-paper/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-paper flex items-center justify-center overflow-hidden shrink-0">
                        {p.images?.[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-copper" />}
                      </div>
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted">{p.brand?.name} · {p.variants?.length ? `${p.variants.length} variantes` : "único"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 font-display font-semibold">{formatCOP(minPrice)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === "PUBLISHED" ? "bg-green-50 text-green" : "bg-paper text-muted"}`}>
                      {p.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 hover:text-copper transition-colors"><Edit3 size={15} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-alert hover:text-red-700 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({ product, onCancel, onSaved }: { product: any | null; onCancel: () => void; onSaved: () => void }) {
  const isNew = !product;
  const [f, setF] = useState({
    name: product?.name || "", sku: product?.sku || "WT-", slug: product?.slug || "",
    description: product?.description || "", unit: product?.unit || "unidad",
    featured: product?.featured || false, status: product?.status || "PUBLISHED",
    price: product?.price ? Number(product.price) : 0, stock: product?.stock || 0,
    categoryId: product?.categoryId || "", subcategoryId: product?.subcategoryId || "",
    brandId: product?.brandId || "",
  });
  const [variants, setVariants] = useState<any[]>(product?.variants || []);
  const [specs, setSpecs] = useState<any[]>(product?.specs || []);
  const [images, setImages] = useState<any[]>(product?.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setF((prev) => ({ ...prev, [k]: v }));

  // Auto-slug
  useEffect(() => {
    if (isNew) set("slug", f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  }, [f.name]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sku", f.sku);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setImages((prev) => [...prev, { url: data.url, alt: f.name }]);
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const body = {
      ...f,
      ...(isNew ? {} : { id: product.id }),
      variants: variants.map(({ id, productId, createdAt, updatedAt, ...v }: any) => v),
      specs: specs.map(({ id, productId, ...s }: any) => s),
      images: images.map(({ id, productId, createdAt, ...img }: any) => img),
    };
    await fetch("/api/admin/products", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="max-w-[760px]">
      <button onClick={onCancel} className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-4 hover:underline">
        <ArrowLeft size={13} /> VOLVER A PRODUCTOS
      </button>
      <h1 className="font-display text-xl font-bold mb-5">{isNew ? "Nuevo producto" : "Editar producto"}</h1>
      <div className="bg-card border border-hair rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-dark block mb-1">Nombre</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">SKU</label><input value={f.sku} onChange={(e) => set("sku", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-copper" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">Slug (URL)</label><input value={f.slug} onChange={(e) => set("slug", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-copper" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">Marca (ID)</label><input value={f.brandId} onChange={(e) => set("brandId", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-copper" placeholder="ID de la marca" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">Categoría (ID)</label><input value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-copper" placeholder="ID de la categoría" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">Unidad de venta</label><input value={f.unit} onChange={(e) => set("unit", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" /></div>
          <div><label className="text-xs font-semibold text-slate-dark block mb-1">Estado</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper">
              <option value="PUBLISHED">Publicado</option><option value="DRAFT">Borrador</option>
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-dark block mb-1">Descripción</label><textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" /></div>
        </div>

        {/* Precio/stock si no hay variantes */}
        {variants.length === 0 && (
          <div className="grid grid-cols-2 gap-4 bg-paper rounded-lg p-4">
            <div><label className="text-xs font-semibold text-slate-dark block mb-1">Precio</label><input type="number" value={f.price} onChange={(e) => set("price", +e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" /></div>
            <div><label className="text-xs font-semibold text-slate-dark block mb-1">Stock</label><input type="number" value={f.stock} onChange={(e) => set("stock", +e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" /></div>
          </div>
        )}

        {/* Imágenes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold">Imágenes ({images.length})</span>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline">
              <Upload size={13} /> {uploading ? "Subiendo..." : "Subir imagen"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {images.map((img: any, i: number) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-hair">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setImages((prev) => prev.filter((_, k) => k !== i))}
                  className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5"><X size={12} /></button>
              </div>
            ))}
            {images.length === 0 && <div className="text-xs text-muted py-4">Sin imágenes. Sube la primera foto del producto.</div>}
          </div>
        </div>

        {/* Variantes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold">Variantes ({variants.length})</span>
            <button onClick={() => setVariants((prev) => [...prev, { name: "", sku: f.sku + "-", price: 0, stock: 0, active: true }])}
              className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline"><Plus size={13} /> Agregar</button>
          </div>
          <div className="space-y-2">
            {variants.map((v: any, i: number) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end border border-hair rounded-lg p-3">
                <div><label className="text-[10px] font-semibold text-muted block mb-0.5">Nombre</label><input value={v.name} onChange={(e) => { const u = [...variants]; u[i] = { ...u[i], name: e.target.value }; setVariants(u); }} className="w-full border border-hair rounded px-2 py-1.5 text-xs focus:outline-none focus:border-copper" /></div>
                <div><label className="text-[10px] font-semibold text-muted block mb-0.5">SKU</label><input value={v.sku} onChange={(e) => { const u = [...variants]; u[i] = { ...u[i], sku: e.target.value }; setVariants(u); }} className="w-full border border-hair rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-copper" /></div>
                <div><label className="text-[10px] font-semibold text-muted block mb-0.5">Precio</label><input type="number" value={v.price} onChange={(e) => { const u = [...variants]; u[i] = { ...u[i], price: +e.target.value }; setVariants(u); }} className="w-full border border-hair rounded px-2 py-1.5 text-xs focus:outline-none focus:border-copper" /></div>
                <div><label className="text-[10px] font-semibold text-muted block mb-0.5">Stock</label><input type="number" value={v.stock} onChange={(e) => { const u = [...variants]; u[i] = { ...u[i], stock: +e.target.value }; setVariants(u); }} className="w-full border border-hair rounded px-2 py-1.5 text-xs focus:outline-none focus:border-copper" /></div>
                <button onClick={() => setVariants((prev) => prev.filter((_, k) => k !== i))} className="text-alert p-2"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Specs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold">Especificaciones ({specs.length})</span>
            <button onClick={() => setSpecs((prev) => [...prev, { key: "", value: "" }])}
              className="text-xs font-semibold text-copper flex items-center gap-1 hover:underline"><Plus size={13} /> Agregar</button>
          </div>
          <div className="space-y-2">
            {specs.map((s: any, i: number) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2"><input value={s.key} onChange={(e) => { const u = [...specs]; u[i] = { ...u[i], key: e.target.value }; setSpecs(u); }} placeholder="Ej: Material" className="w-full border border-hair rounded px-2 py-1.5 text-xs focus:outline-none focus:border-copper" /></div>
                <div className="col-span-2"><input value={s.value} onChange={(e) => { const u = [...specs]; u[i] = { ...u[i], value: e.target.value }; setSpecs(u); }} placeholder="Ej: Cobre" className="w-full border border-hair rounded px-2 py-1.5 text-xs focus:outline-none focus:border-copper" /></div>
                <button onClick={() => setSpecs((prev) => prev.filter((_, k) => k !== i))} className="text-alert p-2"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Destacado */}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Producto destacado
        </label>

        <div className="flex gap-3 pt-3 border-t border-hair">
          <button onClick={save} disabled={!f.name || !f.sku || saving}
            className="bg-copper text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-copper-bright transition-colors disabled:opacity-50">
            <Check size={15} /> {saving ? "Guardando..." : "Guardar producto"}
          </button>
          <button onClick={onCancel} className="border border-hair text-sm px-5 py-2.5 rounded-lg hover:border-copper transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
