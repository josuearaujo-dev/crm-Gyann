import React, { type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={
          {
            "--shimmer-color": shimmerColor,
            "--shimmer-size": shimmerSize,
            "--shimmer-duration": shimmerDuration,
            "--border-radius": borderRadius,
            "--background": background,
          } as CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--background)] [border-radius:var(--border-radius)] transition-all duration-300 hover:scale-105 active:scale-95",
          "before:absolute before:inset-0 before:z-[-1] before:translate-x-[-150%] before:translate-y-[-150%] before:scale-[2.5] before:rounded-full before:bg-white/10 before:opacity-0 before:transition-transform before:duration-1000 before:ease-out hover:before:translate-x-0 hover:before:translate-y-0 hover:before:opacity-100",
          "after:absolute after:inset-0 after:z-[-1] after:rounded-[inherit] after:bg-[linear-gradient(to_right,var(--shimmer-color)_0%,transparent_10%,transparent_90%,var(--shimmer-color)_100%)] after:opacity-0 after:transition-opacity after:[animation:shimmer_var(--shimmer-duration)_linear_infinite] group-hover:after:opacity-100",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";

export default ShimmerButton;
