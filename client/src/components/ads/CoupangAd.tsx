import { useEffect, useRef } from "react";

interface CoupangAdProps {
  className?: string;
}

export function CoupangAd({ className }: CoupangAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = `
        <iframe 
          src="https://ads-partners.coupang.com/widgets.html?id=954378&template=carousel&trackingCode=AF4646383&subId=&width=680&height=140&tsource=" 
          width="680" 
          height="140" 
          frameborder="0" 
          scrolling="no" 
          referrerpolicy="unsafe-url"
          style="max-width: 100%;"
        ></iframe>
      `;
    }
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={className}
      data-testid="ad-coupang-partners"
      style={{ 
        display: "flex", 
        justifyContent: "center", 
        overflow: "hidden",
        maxWidth: "100%"
      }}
    />
  );
}
