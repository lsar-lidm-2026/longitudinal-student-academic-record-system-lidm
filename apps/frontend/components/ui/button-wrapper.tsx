"use client";

import { Button as ShadcnButton } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ButtonWrapperProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "ghost" | "default" | "outline" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "default" | "icon";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"> = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
  default: "default",
  outline: "outline",
  destructive: "destructive",
  link: "link",
};

const sizeMap: Record<string, "default" | "sm" | "lg" | "icon"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
  default: "default",
  icon: "icon",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  className = "",
  ...props
}: ButtonWrapperProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant] || "default"}
      size={sizeMap[size] || "default"}
      disabled={loading || props.disabled}
      className={className}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </ShadcnButton>
  );
}
