// Traduce los errores de Supabase Auth al español de Colombia, con una indicación de qué hacer.
type AuthErrorLike =
  { code?: string | null | undefined; message?: string | null | undefined } | null | undefined;

const POR_CODIGO: Record<string, string> = {
  weak_password:
    "Esa contraseña aparece en filtraciones públicas o es muy fácil de adivinar. Usa una distinta: por ejemplo, tres o cuatro palabras que no tengan relación entre sí, con algún número.",
  user_already_exists: "Ya existe una cuenta con ese correo. Inicia sesión.",
  email_exists: "Ya existe una cuenta con ese correo. Inicia sesión.",
  email_address_invalid: "Ese correo no es válido. Revísalo e intenta de nuevo.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Primero confirma tu correo con el enlace que te enviamos.",
  over_email_send_rate_limit:
    "Se enviaron demasiados correos. Espera unos minutos e intenta de nuevo.",
  over_request_rate_limit: "Demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.",
  signup_disabled: "El registro está cerrado por ahora.",
};

const POR_TEXTO: [RegExp, string][] = [
  [/weak|easy to guess|pwned|leaked/i, POR_CODIGO["weak_password"]!],
  [/at least (\d+) characters/i, "La contraseña debe tener al menos $1 caracteres."],
  [/already registered|already exists/i, POR_CODIGO["user_already_exists"]!],
  [/invalid login credentials/i, POR_CODIGO["invalid_credentials"]!],
  [/email not confirmed/i, POR_CODIGO["email_not_confirmed"]!],
  [/rate limit|too many/i, POR_CODIGO["over_request_rate_limit"]!],
  [/invalid.*email|email.*invalid/i, POR_CODIGO["email_address_invalid"]!],
];

export function mensajeAuth(
  error: AuthErrorLike,
  porDefecto = "No se pudo completar. Intenta de nuevo.",
): string {
  if (!error) return porDefecto;
  if (error.code && POR_CODIGO[error.code]) return POR_CODIGO[error.code]!;
  const texto = error.message ?? "";
  for (const [re, es] of POR_TEXTO) {
    const m = texto.match(re);
    if (m) return es.replace("$1", m[1] ?? "");
  }
  return porDefecto;
}
