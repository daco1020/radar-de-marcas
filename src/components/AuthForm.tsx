import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setErr("Correo o contraseña incorrectos.");
      navigate({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName, company } },
      });
      setLoading(false);
      if (error) return setErr(error.message);
      if (data.session) navigate({ to: "/" });
      else setMsg("Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-7">
        <Logo />
        <h1 className="text-2xl">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
        {mode === "registro" && (
          <>
            <div className="space-y-1.5"><Label htmlFor="n">Nombre</Label><Input className="bg-background" id="n" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="c">Empresa</Label><Input className="bg-background" id="c" required value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          </>
        )}
        <div className="space-y-1.5"><Label htmlFor="e">Correo</Label><Input className="bg-background" id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="p">Contraseña</Label><Input className="bg-background" id="p" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Un momento…" : mode === "login" ? "Entrar" : "Registrarme"}</Button>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? <>¿No tienes cuenta? <Link to="/registro" className="text-primary underline">Regístrate</Link></> : <>¿Ya tienes cuenta? <Link to="/login" className="text-primary underline">Inicia sesión</Link></>}
        </p>
      </form>
    </div>
  );
}
