import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      dashboard: {
        title: "Trading Dashboard",
        status: "Bot Status",
        active: "Active",
        inactive: "Inactive",
        currentPrice: "Current Price",
        balance: "Total Equity",
        holdings: "Holdings",
        settings: "Bot Settings",
        logs: "Trade Logs",
        market: "Market",
        buyThreshold: "Buy Threshold",
        sellThreshold: "Sell Threshold",
        targetAmount: "Trade Amount (KRW)",
        accessKey: "Access Key",
        secretKey: "Secret Key",
        save: "Save Settings",
        saving: "Saving...",
        keySet: "Key Configured",
        keyNotSet: "Key Not Set",
        monitoring: "Monitoring...",
        startBot: "Start Bot",
        stopBot: "Stop Bot",
        krw: "KRW",
        recentTrades: "Recent Trades",
        noTrades: "No trades recorded yet.",
        login: "Login with Replit",
        welcome: "Automate your crypto trading strategy.",
        subtitle: "Simple. Secure. Automated.",
      },
      columns: {
        time: "Time",
        side: "Side",
        price: "Price",
        volume: "Volume",
        status: "Status",
        message: "Message"
      },
      sides: {
        bid: "Buy",
        ask: "Sell",
        info: "Info"
      }
    }
  },
  ko: {
    translation: {
      dashboard: {
        title: "트레이딩 대시보드",
        status: "봇 상태",
        active: "작동 중",
        inactive: "중지됨",
        currentPrice: "현재가",
        balance: "총 자산",
        holdings: "보유 자산",
        settings: "봇 설정",
        logs: "매매 기록",
        market: "마켓",
        buyThreshold: "매수 기준 (%)",
        sellThreshold: "매도 기준 (%)",
        targetAmount: "매매 금액 (KRW)",
        accessKey: "액세스 키 (Access Key)",
        secretKey: "시크릿 키 (Secret Key)",
        save: "설정 저장",
        saving: "저장 중...",
        keySet: "키 설정됨",
        keyNotSet: "키 미설정",
        monitoring: "모니터링 중...",
        startBot: "봇 시작",
        stopBot: "봇 중지",
        krw: "원",
        recentTrades: "최근 거래",
        noTrades: "아직 거래 기록이 없습니다.",
        login: "Replit으로 로그인",
        welcome: "가상화폐 자동매매를 시작하세요.",
        subtitle: "간편하고 안전한 자동화 시스템",
      },
      columns: {
        time: "시간",
        side: "매매",
        price: "가격",
        volume: "수량",
        status: "상태",
        message: "메시지"
      },
      sides: {
        bid: "매수",
        ask: "매도",
        info: "알림"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko', // Default to Korean as requested
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
