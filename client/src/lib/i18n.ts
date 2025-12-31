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
        welcome: "Automate your crypto trading strategy.",
        subtitle: "Simple. Secure. Automated.",
      },
      auth: {
        login: "Login",
        register: "Register",
        loginDesc: "Sign in to your account",
        registerDesc: "Create a new account",
        email: "Email",
        emailPlaceholder: "Enter your email",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        displayName: "Display Name",
        displayNamePlaceholder: "Enter your name",
        loginButton: "Sign In",
        registerButton: "Create Account",
        noAccount: "Don't have an account?",
        registerLink: "Sign up",
        hasAccount: "Already have an account?",
        loginLink: "Sign in",
        loginFailed: "Login Failed",
        registerFailed: "Registration Failed",
      },
      landing: {
        fast: "Fast",
        fastDesc: "Real-time monitoring",
        secure: "Secure",
        secureDesc: "Encrypted storage",
        auto: "Automated",
        autoDesc: "24/7 trading",
      },
      settings: {
        saved: "Settings Saved",
        savedDesc: "Your bot configuration has been updated.",
        error: "Error",
        errorDesc: "Failed to save settings. Please try again.",
        verifySuccess: "API Key Verified",
        verifyFailed: "Verification Failed",
        verify: "Verify Keys",
        verifying: "Verifying...",
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
        welcome: "가상화폐 자동매매를 시작하세요.",
        subtitle: "간편하고 안전한 자동화 시스템",
      },
      auth: {
        login: "로그인",
        register: "회원가입",
        loginDesc: "계정에 로그인하세요",
        registerDesc: "새 계정을 만드세요",
        email: "이메일",
        emailPlaceholder: "이메일을 입력하세요",
        password: "비밀번호",
        passwordPlaceholder: "비밀번호를 입력하세요",
        displayName: "닉네임",
        displayNamePlaceholder: "닉네임을 입력하세요",
        loginButton: "로그인",
        registerButton: "회원가입",
        noAccount: "계정이 없으신가요?",
        registerLink: "가입하기",
        hasAccount: "이미 계정이 있으신가요?",
        loginLink: "로그인",
        loginFailed: "로그인 실패",
        registerFailed: "회원가입 실패",
      },
      landing: {
        fast: "빠른 실행",
        fastDesc: "실시간 모니터링",
        secure: "보안",
        secureDesc: "암호화된 저장소",
        auto: "자동화",
        autoDesc: "24시간 거래",
      },
      settings: {
        saved: "설정 저장 완료",
        savedDesc: "봇 설정이 저장되었습니다.",
        error: "오류",
        errorDesc: "설정 저장에 실패했습니다. 다시 시도해주세요.",
        verifySuccess: "API 키 확인 완료",
        verifyFailed: "API 키 확인 실패",
        verify: "키 확인",
        verifying: "확인 중...",
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
