interface BadgeProps {
  variant?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

export function Badge({ variant = "info", children }: BadgeProps) {
  const variants = {
    info: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${variants[variant]}`}>
      {children}
    </span>
  );
}
