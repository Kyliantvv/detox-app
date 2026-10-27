"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { login, loginDemo, register, useDetox } from "@/lib/store";

type Mode = "connexion" | "inscription";
type Field = "email" | "username" | "password";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-zA-Z0-9._]{3,30}$/;

function validate(field: Field, value: string, mode: Mode): string {
  if (field === "email") return EMAIL.test(value) ? "" : "Entre une adresse e-mail valide.";
  if (field === "username") {
    return USERNAME.test(value) ? "" : "3 à 30 caractères : lettres, chiffres, points ou _.";
  }
  if (mode === "inscription" && value.length < 6) return "6 caractères minimum.";
  return value ? "" : "Entre ton mot de passe.";
}

// Formulaire de connexion / inscription.
// TODO API : POST /api/auth/login et /api/auth/register, garder le token renvoyé.
// En attendant, le compte est seulement gardé dans ce navigateur (le mot de passe n'est pas stocké).
export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { hydrated, user } = useDetox();
  const fields: Field[] = mode === "inscription" ? ["email", "username", "password"] : ["email", "password"];
  const [values, setValues] = useState<Record<Field, string>>({ email: "", username: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (hydrated && user) router.replace("/");
  }, [hydrated, user, router]);

  const update = (field: Field, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFormError("");
    if (errors[field] && !validate(field, value, mode)) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = Object.fromEntries(fields.map((field) => [field, validate(field, values[field], mode)]));
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const email = values.email.trim().toLowerCase();
    const problem =
      mode === "inscription"
        ? register({ email, username: values.username.trim(), bio: "" })
        : login(email);
    if (problem) setFormError(problem);
    else router.replace("/");
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

        <button type="submit" className={mode === "inscription" ? "btn-lime" : "btn-sun"}>
          {mode === "inscription" ? "Créer mon compte" : "Me connecter"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          loginDemo();
          router.replace("/");
        }}
      >
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
