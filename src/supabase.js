// ============================================================
//  Conexión a Supabase — AgroGestión
//  Agroselectos P&A
//
//  Este archivo crea UN solo cliente de Supabase que toda la
//  aplicación reutiliza. Lee las llaves desde variables de
//  entorno para no exponerlas en el código.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Aviso temprano si faltan las llaves (útil en desarrollo).
if (!url || !anonKey) {
  console.warn(
    "AgroGestión: faltan las llaves de Supabase. " +
    "Verifica que el archivo .env tenga VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url || "", anonKey || "", {
  auth: {
    persistSession: true,         // recordar la sesión entre visitas
    autoRefreshToken: true,       // renovar el token solo
    detectSessionInUrl: false,    // no necesitamos OAuth por URL
  },
});

// Indica si la conexión está configurada (útil para mostrar avisos).
export const supabaseListo = Boolean(url && anonKey);
