import { useState, useEffect } from 'react';
import TitleScreen from './pages/arcade/TitleScreen';
import TermsScreen from './pages/arcade/TermsScreen';
import SetupScreen from './pages/arcade/SetupScreen';
import CoworkerSelect, { COWORKERS } from './pages/arcade/CoworkerSelect';
import ThemeSelect, { THEME_PRESETS, type ThemePreset } from './pages/arcade/ThemeSelect';
import OnboardingScreen from './pages/arcade/OnboardingScreen';
import LaunchScreen from './pages/arcade/LaunchScreen';
import CoworkApp from './CoworkApp';
import { host, isWeb } from './platform/host';
import { persistSkin } from './lib/skins';
import type { SpriteName } from './pages/arcade/sprites';
import './styles.css';

type Page = 'loading' | 'intro' | 'terms' | 'setup' | 'coworker' | 'theme' | 'onboarding' | 'launching' | 'terminal';

// Terms-consent persistence for the web build.
//
// The desktop app records consent in the server-side .env
// (`ANTON_TERMS_CONSENT`), but that flag is only ever written by the
// Onboarding screen. The web deployment ships with a provider already
// configured, so onboarding is skipped — meaning the flag was never
// written and the terms screen reappeared on every refresh. We persist
// a per-browser flag in localStorage instead: it survives a reload, is
// scoped to the individual user (unlike the shared server .env), and
// matches how the app already persists the theme.
const TERMS_CONSENT_KEY = 'anton.termsConsent';

// The cartridge picked on the SELECT YOUR COWORKER screen. Mirrors the
// backend `harness` setting; kept in localStorage so the launch screen
// can show "now playing: <coworker>" on later boots too.
const COWORKER_KEY = 'anton.coworker';

function hasLocalTermsConsent(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.localStorage.getItem(TERMS_CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberTermsConsent(): void {
  try { window.localStorage.setItem(TERMS_CONSENT_KEY, 'true'); } catch {}
}

function rememberCoworker(id: string): void {
  try { window.localStorage.setItem(COWORKER_KEY, id); } catch {}
}

function recallCoworker(): { id: string; label: string; sprite: SpriteName } {
  let id = 'anton';
  try { id = window.localStorage.getItem(COWORKER_KEY) || 'anton'; } catch {}
  const cw = COWORKERS.find((c) => c.id === id && !c.locked);
  return cw
    ? { id: cw.id, label: cw.name, sprite: cw.sprite }
    : { id: 'anton', label: 'ANTON', sprite: 'anton' };
}

// Web 部署跳過 CHOOSE YOUR DISPLAY 時套用的預設主題：DAYLIGHT（標準淺色）。
const DEFAULT_WEB_THEME_ID = 'daylight';
function defaultWebThemePreset(): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === DEFAULT_WEB_THEME_ID) ?? THEME_PRESETS[0];
}

// CHOOSE YOUR DISPLAY → persist both axes. CoworkApp seeds its
// theme/skin state from these keys when it mounts after onboarding;
// the body attributes are set too so the launch beat is consistent.
function applyThemePreset(preset: ThemePreset): void {
  persistSkin(preset.skin);
  try { window.localStorage.setItem('anton.theme', preset.theme); } catch {}
  document.body.dataset.skin = preset.skin;
  document.body.dataset.theme = preset.theme;
  document.body.classList.remove('gf-theme-dark', 'gf-theme-light');
  document.body.classList.add(preset.theme === 'light' ? 'gf-theme-light' : 'gf-theme-dark');
  // Re-theme the REMAINING onboarding screens (POWER UP, NOW LOADING)
  // to the chosen preset — arcade.css carries a palette block per
  // preset id. ThemeSelect clears this on mount so back-nav returns
  // to the neutral CRT chooser.
  document.body.dataset.arcadePreset = preset.id;
}

// 從風控治理平台（Open WebUI「風控小幫手」）跳入時，連結會帶 ?from=risk-platform。
// 本部署為內部風控知識庫助理：此參數代表使用者已透過平台入口進入，視為默示同意——
// 首次訪客自動寫入條款同意旗標並直接進主畫面（terminal），略過 intro/terms/launching 等過場。
function isRiskPlatformEntry(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('from') === 'risk-platform';
  } catch {
    return false;
  }
}

// Dev-only deep link (`?page=onboarding` etc.) so onboarding screens can
// be iterated on / screenshotted without replaying the whole gate
// sequence. Compiled out of production bundles via import.meta.env.DEV.
function devForcedPage(): Page | null {
  if (!import.meta.env.DEV) return null;
  try {
    const p = new URLSearchParams(window.location.search).get('page');
    const valid: Page[] = ['intro', 'terms', 'setup', 'coworker', 'theme', 'onboarding', 'launching'];
    return valid.includes(p as Page) ? (p as Page) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('loading');
  const [coworker, setCoworker] = useState(recallCoworker);
  // When inspecting a single screen via `?page=`, freeze it: the
  // onboarding/launch screens auto-advance on completion, which would
  // navigate away from the very screen you're trying to look at.
  const isDevFrozen = Boolean(devForcedPage());

  useEffect(() => {
    const forced = devForcedPage();
    if (forced) { setPage(forced); return; }

    async function init() {
      // Web 部署（內部風控知識庫助理）視為默示同意：首次進入直接跳過
      // intro（COWORK 標題畫面）/terms，並寫入本機旗標讓之後的載入更快。
      // Desktop/Electron 仍保留原本的條款同意流程。
      // 風控治理平台入口同樣是默示同意。
      // 注意：必須在 readSettings() 之前寫入——容器化 dev 環境下該呼叫會 403，
      // 若旗標來不及寫入，外層 catch 會把人退回條款頁（每次重新整理都出現）。
      const webImplicitConsent = isWeb;
      if (webImplicitConsent || isRiskPlatformEntry()) rememberTermsConsent();

      try {
        let serverConsented = false;
        try {
          // /settings/raw 有 LoopbackDesktopOnly guard：容器化 dev 環境下 vite proxy
          // → api 是非 loopback peer，一律 403 "local requests only"。web 的同意是
          // 默示的（上方 webImplicitConsent），這裡失敗只代表「沒有 server-side flag」；
          // desktop 走 Electron bridge 不會 403，失敗時由外層 catch 處理。
          const settings = await host.readSettings();
          serverConsented = settings.ANTON_TERMS_CONSENT === 'true';
        } catch { /* non-fatal: see above */ }

        // Consent counts if either the server-side flag is set (desktop /
        // onboarding path) or this browser already accepted (web path).
        const consented = webImplicitConsent || serverConsented || hasLocalTermsConsent();
        if (!consented) {
          // Terms gate the rest of the app — every launch up until the
          // user accepts shows the title screen, then terms. Once
          // accepted, the intro never plays again because we never
          // re-enter this branch.
          setPage('intro');
          return;
        }

        // Both halves of "ready to start the server": is the anton CLI
        // installed, AND are the Python deps the bundled FastAPI server
        // needs importable from the tool venv. Either being false means
        // setup needs to run. On web both flags are reported true by the
        // FastAPI host (it IS the install), so this short-circuits there.
        const status = await host.checkInstall();
        if (!status.antonInstalled || !status.serverDepsReady) {
          setPage('setup');
          return;
        }
        const { configured } = await host.checkConfigured();
        if (!configured) {
          // Web 部署：跳過 SELECT YOUR COWORKER（預設 ANTON）、CHOOSE YOUR DISPLAY（預設 DAYLIGHT），
          // 並再跳過 POWER UP（onboarding）——直接進主畫面，由使用者之後在 Settings → Providers
          // 自行配置 LLM key（未配置時 CoworkApp 會顯示提示，不會鎖死）。
          // Desktop/Electron 保留原本的 cartridge / 主題選擇 / onboarding 流程。
          if (webImplicitConsent) {
            rememberCoworker('anton');
            setCoworker({ id: 'anton', label: 'ANTON', sprite: 'anton' });
            applyThemePreset(defaultWebThemePreset());
            setPage('terminal');
            return;
          }
          setPage('coworker');
          return;
        }
        setPage('terminal');
      } catch {
        // API 尚未就緒（重啟中）時 readSettings/checkInstall 會失敗。
        // 已同意過的使用者不該被退回條款頁——直接進主畫面，避免「每次都要確認」。
        if (isRiskPlatformEntry() || hasLocalTermsConsent()) {
          setPage('terminal');
        } else {
          setPage('terms');
        }
      }
    }
    init();
  }, []);

  const advanceFromTerms = async () => {
    const status = await host.checkInstall();
    if (!status.antonInstalled || !status.serverDepsReady) {
      setPage('setup');
      return;
    }
    const { configured } = await host.checkConfigured();
    if (!configured) {
      setPage('coworker');
      return;
    }
    setPage('launching');
  };

  const handleTermsAccepted = () => {
    // Persist consent before advancing. The web build skips onboarding
    // (the provider is pre-configured), and onboarding is the only place
    // the server-side ANTON_TERMS_CONSENT flag is written — so without
    // this a browser refresh drops the user back onto the terms screen
    // every single time.
    rememberTermsConsent();
    advanceFromTerms();
  };

  // After install (or re-install), skip coworker/provider onboarding if
  // `~/.anton/.env` already provides a supported provider key — the
  // returning-user case where the installer just refreshed the binary.
  const handleInstallComplete = async () => {
    try {
      const { configured } = await host.checkConfigured();
      if (configured) {
        setPage('launching');
        return;
      }
    } catch {
      // Fail-open to onboarding — better to ask the user one
      // unnecessary time than to land in the terminal with no key.
    }
    setPage('coworker');
  };

  const handleCoworkerSelected = (id: string, label: string) => {
    rememberCoworker(id);
    const cw = COWORKERS.find((c) => c.id === id);
    setCoworker({ id, label, sprite: (cw?.sprite ?? 'anton') as SpriteName });
    setPage('theme');
  };

  const handleThemeSelected = (preset: ThemePreset) => {
    applyThemePreset(preset);
    setPage('onboarding');
  };

  const handleOnboardingComplete = async () => {
    // Restart the backend so it picks up the freshly-written
    // ~/.anton/.env (provider keys, model settings). The server
    // started during Setup before the .env existed, so its cached
    // env-file list doesn't include it.
    try { await host.restartServer(); } catch {}
    setPage('launching');
  };

  const isMac = host.isMac();
  const isArcadePage = page !== 'terminal' && page !== 'loading';

  return (
    <>
      {/* Top-of-window drag overlay only matters for the arcade pages,
          which don't have their own draggable chrome. The cowork page
          provides drag via its sidebar header, so we skip this overlay
          there — otherwise it blocks pointer events for the upper
          ~38px of the sidebar icons. */}
      {isMac && isArcadePage && <div className="titlebar-drag" />}

      {page === 'loading' && (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a13' }} />
      )}

      {page === 'intro' && <TitleScreen onComplete={() => setPage('terms')} />}
      {page === 'terms' && <TermsScreen onAccept={handleTermsAccepted} />}
      {page === 'setup' && <SetupScreen onComplete={handleInstallComplete} />}
      {page === 'coworker' && <CoworkerSelect onSelect={handleCoworkerSelected} />}
      {page === 'theme' && (
        <ThemeSelect
          onSelect={isDevFrozen ? () => {} : handleThemeSelected}
          onBack={() => setPage('coworker')}
        />
      )}
      {page === 'onboarding' && (
        <OnboardingScreen
          coworker={coworker}
          onComplete={isDevFrozen ? () => {} : handleOnboardingComplete}
          onBack={() => setPage('theme')}
          // Web 部署：POWER UP 預設走 GUEST MODE（bring my own LLM key），
          // 跳過 Stage 1 的 MindsHub API Key。Desktop/Electron 保留原流程。
          startInGuestMode={isWeb}
        />
      )}
      {page === 'launching' && (
        <LaunchScreen
          coworkerLabel={coworker.label}
          onDone={isDevFrozen ? () => {} : () => setPage('terminal')}
        />
      )}

      {page === 'terminal' && <CoworkApp />}
    </>
  );
}
