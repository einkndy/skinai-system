import { memo, useEffect, useRef, useState } from "react";

function OptimizedImage({
  src,
  alt,
  className = "",
  eager = false,
  ...props
}) {
  const imageRef = useRef(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (eager || !imageRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "180px",
      }
    );

    observer.observe(imageRef.current);

    return () => observer.disconnect();
  }, [eager]);

  return (
    <img
      ref={imageRef}
      src={visible ? src : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      {...props}
    />
  );
}

export default memo(OptimizedImage);
