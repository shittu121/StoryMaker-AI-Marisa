// Theme configuration for consistent styling across the app
export const theme = {
  colors: {
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
    purple: {
      50: "#faf5ff",
      100: "#f3e8ff",
      200: "#e9d5ff",
      300: "#d8b4fe",
      400: "#c084fc",
      500: "#a855f7",
      600: "#9333ea",
      700: "#7c3aed",
      800: "#6b21a8",
      900: "#581c87",
    },
    gray: {
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
    success: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d",
    },
    error: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d",
    },
    warning: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
    },
  },
  gradients: {
    primary: "from-blue-600 to-purple-600",
    primaryHover: "from-blue-700 to-purple-700",
    background: "from-blue-50 via-white to-purple-50",
    card: "bg-white/80 backdrop-blur-sm",
    glass: "bg-white/10 backdrop-blur-md border border-white/20",
  },
  shadows: {
    card: "shadow-xl",
    button: "shadow-lg",
    input: "shadow-sm",
  },
  borderRadius: {
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    full: "rounded-full",
  },
  transitions: {
    default: "transition-all duration-200",
    fast: "transition-all duration-150",
    slow: "transition-all duration-300",
    transform: "transform hover:scale-[1.02] focus:scale-[0.98]",
  },
} as const;

// Utility functions for theme usage
export const getGradientClass = (gradient: keyof typeof theme.gradients) => {
  return `bg-gradient-to-br ${theme.gradients[gradient]}`;
};

export const getColorClass = (color: string, shade: number = 500) => {
  return `text-${color}-${shade}`;
};

export const getBgColorClass = (color: string, shade: number = 500) => {
  return `bg-${color}-${shade}`;
};
