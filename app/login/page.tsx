"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";
import { useNow } from "@/hooks/use-now";

// Mirrors the backend's loginSchema exactly: login has no password
// complexity rule (unlike register), just non-empty.
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FieldErrors = Partial<Record<"email" | "password", string>>;

function LeftPanelClock() {
  const now = useNow();
  return (
    <div className="flex flex-col gap-0.5 border-l-2 border-[#e1be26]/90 pl-3.5">
      <p className="text-[clamp(26px,2.4vw,36px)] font-bold leading-tight text-white tabular-nums">
        {now
          ? now.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })
          : " "}
      </p>
      <p className="text-[15px] font-medium text-white/70">
        {now
          ? now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : " "}
      </p>
    </div>
  );
}

const inputClassName =
  "h-[46px] w-full rounded-xl border-[1.5px] border-[#e2e6e9] bg-[#fafbfb] px-3.5 text-[14.5px] text-[#111827] outline-none transition-[border-color,box-shadow,background] duration-150 focus:border-[#117b8e] focus:bg-white focus:shadow-[0_0_0_3.5px_rgba(17,123,142,0.16)]";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "email" | "password";
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      await login(result.data.email, result.data.password);
      router.replace("/dashboard");
    } catch (err) {
      setServerError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ===== Left — 75% brand panel (hidden below lg) ===== */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-3/4 lg:max-w-3/4 lg:shrink-0">
        <Image
          src="/images/login_background.png"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(5,30,40,0.94)_0%,rgba(9,60,75,0.78)_42%,rgba(17,123,142,0.35)_100%)]" />

        <div className="relative z-10 flex w-full flex-col justify-between gap-4 px-[clamp(28px,3.5vw,56px)] py-[clamp(24px,3.5vh,44px)]">
          {/* Top: brand lockup */}
          <div className="flex items-center gap-3.5 animate-in fade-in duration-700">
            <div className="flex rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(3,20,28,0.35)]">
              <Image
                src="/images/Avenova_logo.png"
                alt="Avenova"
                width={44}
                height={44}
                priority
                className="h-11 w-11"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-[21px] font-extrabold leading-none tracking-wide">
                <span className="text-[#7fd4e4]">AVE</span>
                <span className="text-[#e0c98f]">NOVA</span>
              </div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-white/80">
                Early Intervention and SPED Learning Center
              </div>
            </div>
          </div>

          {/* Middle: headline */}
          <div className="flex max-w-[640px] flex-col items-start gap-3.5 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <div className="flex items-center gap-2.5">
              <div className="h-0.5 w-7 bg-[#e1be26]" />
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#e1be26]">
                Enrollment System
              </span>
            </div>
            <h1 className="text-pretty text-[clamp(28px,3.2vw,48px)] font-bold leading-[1.14] tracking-tight text-white">
              Supporting every child&apos;s early learning journey.
            </h1>
            <p className="max-w-[460px] text-pretty text-[clamp(13px,1.1vw,16px)] leading-relaxed text-white/70">
              Manage students, staff, and enrollment records in one secure
              place.
            </p>
          </div>

          {/* Bottom: clock + partnership */}
          <div className="flex flex-wrap items-end justify-between gap-5 animate-in fade-in duration-700">
            <LeftPanelClock />

            <div className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.18] bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <span className="text-right text-[10px] font-semibold uppercase leading-snug tracking-[0.08em] text-white/75">
                In partnership
                <br />
                with
              </span>
              <span className="text-xl font-extrabold text-[#e1be26]">
                GOLD
              </span>
              <div className="w-px self-stretch bg-white/20" />
              <span className="text-[11.5px] leading-snug text-white/85">
                by <span className="font-bold">Teaching</span>Strategies&reg;
                <br />
                <span className="text-[9px] uppercase tracking-[0.06em] text-white/60">
                  A U.S.-based creative curriculum
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Right — 25% login panel ===== */}
      <div className="relative flex w-full flex-1 items-center justify-center bg-white px-7 py-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#117b8e_0%,#4db6c6_55%,#e1be26_100%)]" />

        <div className="flex w-full max-w-[330px] flex-col gap-[26px] animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/images/Avenova_logo.png"
              alt="Avenova"
              width={60}
              height={60}
              priority
              className="h-[60px] w-[60px]"
            />
            <div className="flex flex-col gap-1">
              <h2 className="text-[23px] font-bold tracking-tight text-[#111827]">
                Welcome back
              </h2>
              <p className="text-[13.5px] text-[#6b7280]">
                Log in to your dashboard to continue.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[12.5px] font-semibold text-[#374151]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[12.5px] font-semibold text-[#374151]"
              >
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClassName} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="absolute right-[7px] flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-[#9ca3af] transition-colors hover:bg-[#eef2f3] hover:text-[#4b5563]"
                >
                  {passwordVisible ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-0.5 h-12 cursor-pointer rounded-xl border-none bg-[linear-gradient(135deg,#117b8e_0%,#0d6577_100%)] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(17,123,142,0.28)] transition-[transform,box-shadow,filter] duration-100 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(17,123,142,0.34)] hover:brightness-[1.06] active:translate-y-0 active:shadow-[0_4px_10px_rgba(17,123,142,0.24)] disabled:pointer-events-none disabled:opacity-70"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#9ca3af]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              Secure, authorized access only
            </div>
            <p className="text-center text-[11.5px] text-[#b0b7c0]">
              &copy; {new Date().getFullYear()} Avenova Early Intervention
              <br />
              and SPED Learning Center
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthGuard requireAuth={false}>
      <LoginForm />
    </AuthGuard>
  );
}
