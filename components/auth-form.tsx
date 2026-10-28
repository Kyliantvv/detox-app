"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ApiErrorBody } from "@/lib/types";
import { EMAIL, PASSWORD_MIN, USERNAME } from "@/lib/validation";

type Mode = "connexion" | "inscription";
type Field = "email" | "username" | "password";

function validate(field: Field, value: string, mode: Mode): string {
  if (field === "email") return EMAIL.test(value) ? "" : "Entre une adresse e-mail valide.";
  if (field === "username") {
    return USERNAME.test(value) ? "" : "3 à 30 caractères : lettres, chiffres, points ou _.";
  }
  if (mode === "inscription" && value.length < PASSWORD_MIN) return `${PASSWORD_MIN} caractères minimum.`;
  return value ? "" : "Entre ton mot de passe.";
}

// Navigation complète voulue après connexion : le proxy relit le cookie de session tout neuf,
// et le cache du routeur (pages préchargées sans session) comme celui de SWR repartent de zéro.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const enterApp = () => window.location.assign("/");

// Formulaire de connexion / inscription. La session NextAuth porte le JWT de l'API.
export default function AuthForm({ mode }: { mode: Mode }) {
  const fields: Field[] = mode === "inscription" ? ["email", "username", "password"] : ["email", "password"];
  const [values, setValues] = useState<Record<Field, string>>({ email: "", username: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  const update = (field: Field, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFormError("");
    if (errors[field] && !validate(field, value, mode)) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = Object.fromEntries(fields.map((field) => [field, validate(field, values[field], mode)]));
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const email = values.email.trim().toLowerCase();
    setPending(true);
    setFormError("");
    try {
      if (mode === "inscription") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username: values.username.trim(), password: values.password }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
          setFormError(body?.error.message ?? "Inscription impossible. Réessaie.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password: values.password, redirect: false });
      if (result?.error) {
        setFormError("E-mail ou mot de passe incorrect.");
        return;
      }
      enterApp();
    } catch {
      setFormError("Le serveur ne répond pas. Réessaie.");
    } finally {
      setPending(false);
    }
  };

  const enterDemo = async () => {
    setPending(true);
    const result = await signIn("demo", { redirect: false }).catch(() => null);
    if (result && !result.error) enterApp();
    else {
      setFormError("Connexion au compte démo impossible.");
      setPending(false);
    }
  };

  const labels: Record<Field, { label: string; type: string; autoComplete: string; hint?: string }> = {
    email: { label: "E-mail", type: "email", autoComplete: "email" },
    username: { label: "Nom d'utilisateur", type: "text", autoComplete: "username", hint: "ex. alex.detox" },
    password: {
      label: "Mot de passe",
      type: "password",
      autoComplete: mode === "inscription" ? "new-password" : "current-password",
      hint: mode === "inscription" ? "6 caractères minimum" : undefined,
    },
  };

  return (
    <>
      <div>
        <h1 className="font-display text-[30px] leading-tight font-bold">
          {mode === "inscription" ? "Commence ta détox." : "Bon retour."}
        </h1>
        <p className="mt-1 text-muted">
          {mode === "inscription"
            ? "Chaque scroll te rapporte des points. Promis, c'est sain."
            : "Tes points t'attendent. Ils ne servent à rien, mais ils t'attendent."}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {fields.map((field) => {
          const { label, type, autoComplete, hint } = labels[field];
          const error = errors[field];
          return (
            <div key={field} className="flex flex-col gap-1.5">
              <label htmlFor={field} className="text-sm font-semibold text-muted">
                {label}
              </label>
              <input
                id={field}
                type={type}
                autoComplete={autoComplete}
                placeholder={hint}
                value={values[field]}
                onChange={(event) => update(field, event.target.value)}
                onBlur={() => values[field] && setErrors((prev) => ({ ...prev, [field]: validate(field, values[field], mode) }))}
                aria-invalid={!!error}
                aria-describedby={error ? `${field}-error` : undefined}
                className={`input ${error ? "border-pink" : ""}`}
              />
              {error && (
                <p id={`${field}-error`} className="text-sm text-pink">
                  {error}
                </p>
              )}
            </div>
          );
        })}

        {formError && (
          <p role="alert" className="rounded-xl border border-pink px-4 py-3 text-sm text-pink">
            {formError}
          </p>
        )}

        <button type="submit" className={mode === "inscription" ? "btn-lime" : "btn-sun"} disabled={pending}>
          {pending ? "Un instant…" : mode === "inscription" ? "Créer mon compte" : "Me connecter"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>

      <button type="button" className="btn-ghost" onClick={enterDemo} disabled={pending}>
        Entrer avec le compte démo
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "inscription" ? (
          <>
            Déjà accro ?{" "}
            <Link href="/connexion" className="font-semibold text-lime">
              Me connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore accro ?{" "}
            <Link href="/inscription" className="font-semibold text-lime">
              Créer un compte
            </Link>
          </>
        )}
      </p>
    </>
  );
}
