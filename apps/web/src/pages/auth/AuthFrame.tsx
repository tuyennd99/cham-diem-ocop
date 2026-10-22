import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthFrame({
  eyebrow,
  title,
  intro,
  mode,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  mode?: "login" | "register";
  aside?: ReactNode;
  children: ReactNode;
}) {
  const panel = (
    <section className="route-panel auth-panel" aria-labelledby="route-title">
      {mode && (
        <div className="auth-tabs" aria-label="Chuyển đổi đăng nhập và đăng ký">
          <Link
            className={`auth-tab${mode === "login" ? " is-active" : ""}`}
            to="/login"
            aria-current={mode === "login" ? "page" : undefined}
          >
            Đăng nhập
          </Link>
          <Link
            className={`auth-tab${mode === "register" ? " is-active" : ""}`}
            to="/register"
            aria-current={mode === "register" ? "page" : undefined}
          >
            Đăng ký tài khoản
          </Link>
        </div>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="route-title">{title}</h1>
      <p className="route-intro">{intro}</p>
      {children}
    </section>
  );

  return (
    <main className="route-main" id="content">
      <div className="container route-container">
        {aside ? (
          <div className="auth-grid">
            {panel}
            {aside}
          </div>
        ) : (
          panel
        )}
      </div>
    </main>
  );
}
