"use client";

import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

function nextUrl() {
  return new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
}

/** Set when the middleware bounced a session off a hostname that doesn't serve it. */
function wrongHost() {
  return new URLSearchParams(window.location.search).get("e") === "host";
}

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hostNote, setHostNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Bounced here for using the wrong address: show the form, never retry
      // the silent refresh — it would redirect straight back here.
      if (wrongHost()) {
        setHostNote(true);
        setChecking(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!cancelled && res.ok) {
          window.location.replace(nextUrl());
          return;
        }
      } catch {
        /* show form */
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Login failed");
        return;
      }
      window.location.href = nextUrl();
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <p className="muted" data-test-id="login-checking">
          <T en="Checking session…" ar="جارٍ التحقق من الجلسة…" />
        </p>
      </main>
    );
  }

  return (
    <main className="auth">
      <aside className="auth__aside">
        <div className="brand reveal">
          <span className="mark" aria-hidden />
          <span><span className="b1">broadcast</span><span className="b2">hub</span></span>
        </div>
        <div>
          <p className="auth__pitch reveal d1">
            <T
              en="Reach every customer on WhatsApp — and watch each message land."
              ar="تواصل مع كل عملائك عبر واتساب — وتابع وصول كل رسالة."
            />
          </p>
          <div className="auth__points reveal d2">
            <span><T en="Send Meta-approved templates to whole contact lists" ar="أرسِل قوالب معتمدة من ميتا لقوائم الاتصال" /></span>
            <span><T en="Track sent, delivered, read & failed in real time" ar="تتبّع المرسلة والمسلَّمة والمقروءة والفاشلة لحظياً" /></span>
            <span><T en="Opt-outs honored automatically — every send" ar="إلغاء الاشتراك يُحترم تلقائياً — في كل إرسال" /></span>
          </div>
        </div>
        <p className="muted reveal d3" style={{ fontSize: 13 }}>
          <T en="NazzilVideo · WhatsApp Cloud API" ar="نازل فيديو · واتساب كلاود API" />
        </p>
      </aside>

      <section className="auth__panel">
        <div className="auth__top"><ThemeToggle /></div>
        <form onSubmit={onSubmit} className="auth__form reveal">
          <h1><T en="Welcome back" ar="مرحباً بعودتك" /></h1>
          <p className="sub"><T en="Sign in to your Broadcast Hub." ar="سجّل الدخول إلى Broadcast Hub." /></p>
          <div className="field">
            <label className="label" htmlFor="email"><T en="Email" ar="البريد الإلكتروني" /></label>
            <input id="email" data-test-id="login-email" className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div className="field">
            <label className="label" htmlFor="password"><T en="Password" ar="كلمة المرور" /></label>
            <input id="password" data-test-id="login-password" className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {hostNote && (
            <p className="note" data-test-id="login-host-note" style={{ marginBottom: 10 }}>
              <T
                en="This address serves a single workspace. Sign in with an account for it, or use your own workspace address — signing in below will tell you which one that is."
                ar="هذا العنوان يخدم مساحة عمل واحدة. سجّل الدخول بحساب خاص بها، أو استخدم عنوان مساحة عملك — تسجيل الدخول أدناه سيخبرك أيهما."
              />
            </p>
          )}
          {error && <p data-test-id="login-error" className="error-text">{error}</p>}
          <button data-test-id="login-submit" className="btn" type="submit" disabled={loading}
            aria-busy={loading} style={{ width: "100%", marginTop: 6 }}>
            {loading ? <T en="Signing in…" ar="جارٍ تسجيل الدخول…" /> : <T en="Sign in" ar="تسجيل الدخول" />}
          </button>
        </form>
      </section>
    </main>
  );
}
