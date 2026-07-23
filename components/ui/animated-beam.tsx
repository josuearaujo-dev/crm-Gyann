"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React, { forwardRef, useRef } from "react";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = Math.random() * 3 + 4,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) => {
  const id = React.useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  return (
    <svg
      ref={svgRef}
      fill="none"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2",
        className
      )}
      viewBox={`0 0 ${containerRef.current?.offsetWidth} ${containerRef.current?.offsetHeight}`}
    >
      <path
        ref={pathRef}
        d=""
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          className="transform-gpu"
          id={`gradient-${id}`}
          gradientUnits={"userSpaceOnUse"}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0"></stop>
          <stop stopColor={gradientStartColor}></stop>
          <stop offset="32.5%" stopColor={gradientStopColor}></stop>
          <stop
            offset="100%"
            stopColor={gradientStopColor}
            stopOpacity="0"
          ></stop>
        </linearGradient>
      </defs>
      <motion.path
        d=""
        stroke={`url(#gradient-${id})`}
        strokeWidth={pathWidth}
        strokeOpacity="1"
        strokeLinecap="round"
        initial={{
          pathLength: 0,
          pathOffset: reverse ? 1 : 0,
        }}
        animate={{
          pathLength: 1,
          pathOffset: reverse ? 0 : 1,
        }}
        transition={{
          delay,
          duration,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: 0,
        }}
      />
    </svg>
  );
};

export default AnimatedBeam;
