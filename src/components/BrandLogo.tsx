"use client";

import Image from "next/image";
import { useState } from "react";

const DEFAULT_LOGO = "/brand/dcnet-logo.png";
const FALLBACK_LOGO = "/icons/dcnet-client.svg";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  height: number;
  width: number;
  src?: string;
  fallbackSrc?: string;
  priority?: boolean;
};

export function BrandLogo({
  alt = "DC NET",
  className,
  height,
  width,
  src = DEFAULT_LOGO,
  fallbackSrc = FALLBACK_LOGO,
  priority = false,
}: BrandLogoProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
