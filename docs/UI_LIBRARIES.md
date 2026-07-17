# UI Libraries — LSAR

Frontend menggunakan **shadcn/ui** (Base UI variant) sebagai foundation dengan Tailwind CSS v4.

## Terintegrasi

| Library | Status | Cara Pakai |
|---------|--------|------------|
| shadcn/ui | ✅ Terintegrasi | `npx shadcn@latest add <component>` |
| Base UI | ✅ via shadcn | Komponen React primitif dari @base-ui |

## Sumber Komponen Eksternal

Berikut UI libraries yang kompatibel dan bisa ditambahkan secara copy-paste:

| Library | URL | Catatan |
|---------|-----|---------|
| Magic UI | https://magicui.design | Copy komponen langsung |
| Aceternity UI | https://ui.aceternity.com | Copy komponen langsung |
| Origin UI | https://originui.com | Copy komponen langsung |
| Tremor Raw | https://raw.tremor.so | `npm install @tremor/react` (terinstall) |
| Shadcn Blocks | https://shadcnblocks.com | Copy blok section |
| Cult UI | https://cult-ui.com | Copy komponen langsung |
| Eldora UI | https://eldoraui.site | Copy komponen langsung |
| Indie UI | https://ui.indie-studio.dev | Copy komponen langsung |
| Kokonut UI | https://kokonutui.com | Copy komponen langsung |
| Syntax UI | https://syntaxui.com | Copy komponen langsung |
| Fancy UI | https://fancyui.design | Copy komponen langsung |
| Animata | https://animata.design | Copy komponen langsung |
| Hover.dev | https://hover.dev | Copy komponen langsung |
| Cuicui | https://cuicui.day | Copy komponen langsung |
| Aura UI | https://aurafx.design | Copy komponen langsung |
| Procrea UI | https://procrea-ui.vercel.app | Copy komponen langsung |
| Kira UI | https://kira-ui.vercel.app | Copy komponen langsung |
| UI-Snippets | https://ui-snippets.dev | Copy komponen langsung |
| Shadcn Extension | VSCode extension | Cari "shadcn" di VSCode marketplace |

## Pencarian & Generator

| Tool | URL | Fungsi |
|------|-----|--------|
| 21st.dev | https://21st.dev | Katalog komponen shadcn + search |
| v0 by Vercel | https://v0.dev | AI generate komponen shadcn |

## Cara Nambah Komponen shadcn

```bash
cd apps/frontend
npx shadcn@latest add button card table badge dialog select tabs
```

## File Komponen

Semua komponen shadcn ada di `apps/frontend/components/ui/`.
Komponen custom ada di `apps/frontend/components/` (layout, ml, dll).
