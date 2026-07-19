/**
 * tabs — Reusable Tabs component berdasarkan @base-ui/react/tabs dengan styling Tailwind.
 * ========================================================================================
 *
 * Cara Kerja:
 * 1. Komponen ini membungkus `TabsPrimitive` dari `@base-ui/react/tabs` dengan styling kustom.
 * 2. Terdapat 4 komponen utama:
 *    a. `Tabs` — Root wrapper dengan data-orientation (horizontal/vertical)
 *    b. `TabsList` — Container untuk trigger tabs, dengan variant (default/line)
 *    c. `TabsTrigger` — Tombol tab individual, dengan styling active/inactive
 *    d. `TabsContent` — Panel konten yang terkait dengan trigger
 * 3. Menggunakan `cva` (class-variance-authority) untuk mengelola variant styling TabsList.
 * 4. `cn` utility dari `@/lib/utils` untuk merge className.
 * 5. Semua props di-forward ke komponen primitif Base UI via spread operator.
 *
 * Alur Lengkap:
 *   <Tabs defaultValue="tab1" orientation="horizontal">
 *       <TabsList variant="default">
 *           <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *           <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *       </TabsList>
 *       <TabsContent value="tab1">Konten 1</TabsContent>
 *       <TabsContent value="tab2">Konten 2</TabsContent>
 *   </Tabs>
 *
 *   // TabsList variant "line" (garis bawah):
 *   <TabsList variant="line">
 *       <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *   </TabsList>
 */

"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tabs — Root component untuk tabs.
 * Mengatur orientation (horizontal/vertical) dan data attributes untuk styling.
 *
 * @param className - Class tambahan
 * @param orientation - Arah tabs: "horizontal" (default) atau "vertical"
 * @param props - Props tambahan untuk TabsPrimitive.Root
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props} // Forward props (defaultValue, value, onValueChange, dll)
    />
  )
}

/**
 * tabsListVariants — Variants untuk styling TabsList menggunakan class-variance-authority.
 * - default: background muted, rounded
 * - line: tanpa background, gap antar item
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",      /** Background muted untuk list */
        line: "gap-1 bg-transparent", /** Tanpa background, gap antar item */
      },
    },
    defaultVariants: {
      variant: "default", /** Default variant */
    },
  }
)

/**
 * TabsList — Container untuk TabsTrigger components.
 *
 * @param className - Class tambahan
 * @param variant - "default" (muted bg) atau "line" (garis bawah)
 * @param props - Props tambahan untuk TabsPrimitive.List
 */
function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props} // Forward props
    />
  )
}

/**
 * TabsTrigger — Tombol tab individual yang bisa di-klik untuk ganti tab.
 * Memiliki styling untuk state: active, hover, focus, disabled.
 *
 * @param className - Class tambahan
 * @param props - Props tambahan untuk TabsPrimitive.Tab
 */
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Styling dasar: flex, center, padding, typography
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Styling untuk variant "line"
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // Styling untuk state active (data-active)
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        // Indikator garis bawah untuk variant "line" (pseudo-element after)
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props} // Forward props (value, disabled, dll)
    />
  )
}

/**
 * TabsContent — Panel konten yang tampil saat tab terkait aktif.
 *
 * @param className - Class tambahan
 * @param props - Props tambahan untuk TabsPrimitive.Panel
 */
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props} // Forward props (value, dll)
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
