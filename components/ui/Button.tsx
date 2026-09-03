import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

// gapはサイズごとに変えたいため、共通classにはせずここへ含める
// （baseクラスとの重複指定はTailwindのカスケード順が不定になり事故りやすいため避ける）。
const sizeClasses: Record<Size, string> = {
  // カード一覧でリアクションボタン4つを1行に収める等、極小スペース向け。
  xs: "px-1.5 py-0.5 text-[11px] gap-1",
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-1.5",
  // トピック登録等、視線を集めたい主要導線向け。
  lg: "px-6 py-3 text-base gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", active, className = "", ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          variantClasses[variant]
        } ${sizeClasses[size]} ${
          active ? "ring-2 ring-offset-1 ring-slate-900" : ""
        } ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
