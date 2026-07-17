import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  label,
  error,
  ...props
}: React.ComponentProps<typeof InputPrimitive> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-foreground">{label}</label>
      )}
      <InputPrimitive
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          error && "border-destructive focus-visible:ring-destructive/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export { Input };
