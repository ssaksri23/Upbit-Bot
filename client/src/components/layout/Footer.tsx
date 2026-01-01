import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";

export function Footer() {
  const { i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  return (
    <footer className="border-t border-border/40 bg-background/95 mt-8">
      <div className="container px-4 py-6">
        {/* Coupang Partners Banner */}
        <div className="flex justify-center mb-6 overflow-hidden">
          <iframe 
            src="https://ads-partners.coupang.com/widgets.html?id=954378&template=carousel&trackingCode=AF4646383&subId=&width=680&height=140&tsource=" 
            width="680" 
            height="140" 
            frameBorder="0" 
            scrolling="no" 
            referrerPolicy="unsafe-url"
            className="max-w-full border-0"
            style={{ minHeight: '140px' }}
            title="Coupang Partners"
          />
        </div>
        
        {/* Footer Info */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p className="flex items-center justify-center gap-2">
            <Phone className="w-3 h-3" />
            <span>{isKorean ? "문의: 0507-1319-0641" : "Contact: 0507-1319-0641"}</span>
          </p>
          <p>
            {isKorean 
              ? "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
              : "This post is part of Coupang Partners activities and receives a commission accordingly."}
          </p>
          <p className="text-muted-foreground/60">
            © 2025 RichBot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
