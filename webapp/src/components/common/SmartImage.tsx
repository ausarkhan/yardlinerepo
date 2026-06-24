import { useState } from "react";
import { cn } from "@/lib/utils";

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: string;
}

const DEFAULT_FALLBACK =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop";

// <img> that fades in on load and swaps to a fallback if the source 404s.
export function SmartImage({
  src,
  fallback = DEFAULT_FALLBACK,
  className,
  alt = "",
  ...props
}: SmartImageProps) {
  const [current, setCurrent] = useState(src);
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      {...props}
      src={current}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
      className={cn(
        "transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
