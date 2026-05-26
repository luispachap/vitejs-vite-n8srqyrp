// ============================================================
//  AgroGestión — Adaptador de datos para Supabase
//
//  Funciones para leer y escribir las colecciones de la app
//  en la base de datos. Sigue el patrón de columnas reales +
//  columna "datos" tipo JSON que definimos en el esquema SQL.
//
//  IMPORTANTE: este módulo no decide CUÁNDO se llama. Solo
//  sabe leer y escribir cuando alguien se lo pide. La lógica
//  de cuándo usarlo vive en App.jsx.
// ============================================================

import { supabase, supabaseListo } from "./supabase";

// ------------------------------------------------------------
//  Mapeo: nombre de colección → nombre de tabla en Supabase
//  (todas iguales, pero por si en el futuro cambian, está aquí)
// ------------------------------------------------------------
export const TABLAS = [
  "ranchos", "parcelas", "cultivos", "siembras", "trabajadores",
  "encargados", "agronomos", "cuadrillas", "externos", "maquinaria",
  "inventario", "actividades", "cosechas", "aplicaciones", "ingresos",
  "egresos", "compras", "entradas_inv", "tareas", "bonificaciones",
  "incidencias", "prestamos", "cajachica", "creditos", "proveedores",
  "ciclos", "asistencia", "envios_bodega",
];

// Catálogos que sí subimos a la nube en la primera carga.
// Lo demás son movimientos y no se siembra desde el navegador.
export const CATALOGOS = [
  "ranchos", "parcelas", "cultivos", "trabajadores",
  "encargados", "agronomos", "cuadrillas", "proveedores",
];

// ------------------------------------------------------------
//  Separar campos: algunas columnas viven aparte del JSON.
//  El resto de los campos del objeto van dentro de "datos".
// ------------------------------------------------------------
const COLUMNAS_REALES = {
  ranchos:        ["id", "nombre"],
  parcelas:       ["id", "ranchoId", "nombre", "cultivo"],
  cultivos:       ["id", "nombre"],
  siembras:       ["id", "parcelaId", "cultivoId", "estado"],
  trabajadores:   ["id", "nombre", "pin"],
  encargados:     ["id", "nombre", "pin"],
  agronomos:      ["id", "nombre", "pin"],
  cuadrillas:     ["id", "nombre", "pin"],
  externos:       ["id", "nombre", "estado"],
  maquinaria:     ["id", "nombre"],
  inventario:     ["id", "nombre", "cat"],
  actividades:    ["id", "parcelaId", "fecha", "tipo"],
  cosechas:       ["id", "parcelaId"],
  aplicaciones:   ["id", "parcelaId", "fecha"],
  ingresos:       ["id", "fecha"],
  egresos:        ["id", "fecha", "parcelaId"],
  compras:        ["id", "estado"],
  entradas_inv:   ["id"],
  tareas:         ["id", "asignadoA", "estado"],
  bonificaciones: ["id"],
  incidencias:    ["id", "estado"],
  prestamos:      ["id", "estado"],
  cajachica:      ["id"],
  creditos:       ["id", "estado"],
  proveedores:    ["id", "nombre"],
  ciclos:         ["id", "estado"],
  asistencia:     ["id", "fecha", "trabajadorId"],
  envios_bodega:  ["id", "parcelaId", "fecha", "cultivo"],
};

// Diccionario: nombre en la app (camelCase) → nombre en SQL (snake_case)
const MAP_COL = {
  ranchoId:     "rancho_id",
  parcelaId:    "parcela_id",
  cultivoId:    "cultivo_id",
  asignadoA:    "asignado_a",
  trabajadorId: "trabajador_id",
  cat:          "categoria",
};
const inv = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
const MAP_COL_INV = inv(MAP_COL);

const aSql = k => MAP_COL[k] || k;
const aApp = k => MAP_COL_INV[k] || k;

// ------------------------------------------------------------
//  Convertir un objeto de la app → fila SQL
// ------------------------------------------------------------
function objetoAFila(tabla, obj) {
  const reales = COLUMNAS_REALES[tabla] || ["id"];
  const fila = {};
  const datos = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (reales.includes(k)) fila[aSql(k)] = v;
    else datos[k] = v;
  }
  fila.datos = datos;
  fila.actualizado = new Date().toISOString();
  return fila;
}

// ------------------------------------------------------------
//  Convertir una fila SQL → objeto de la app
// ------------------------------------------------------------
function filaAObjeto(fila) {
  const { datos, actualizado, ...resto } = fila || {};
  const obj = {};
  for (const [k, v] of Object.entries(resto)) {
    if (v === null || v === undefined) continue;
    obj[aApp(k)] = v;
  }
  if (datos && typeof datos === "object") Object.assign(obj, datos);
  return obj;
}

// ------------------------------------------------------------
//  LEER toda una colección
// ------------------------------------------------------------
export async function leerColeccion(tabla) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const { data, error } = await supabase.from(tabla).select("*");
  if (error) throw error;
  return (data || []).map(filaAObjeto);
}

// ------------------------------------------------------------
//  LEER TODO: trae todas las colecciones a la vez
//  Devuelve un objeto { ranchos: [...], parcelas: [...], ... }
// ------------------------------------------------------------
export async function leerTodo() {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const resultado = {};
  for (const t of TABLAS) {
    try {
      resultado[t] = await leerColeccion(t);
    } catch (e) {
      console.warn(`No se pudo leer ${t}:`, e.message);
      resultado[t] = [];
    }
  }
  return resultado;
}

// ------------------------------------------------------------
//  SUBIR (insertar o actualizar) un registro
// ------------------------------------------------------------
export async function guardarRegistro(tabla, obj) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const fila = objetoAFila(tabla, obj);
  const { error } = await supabase.from(tabla).upsert(fila, { onConflict: "id" });
  if (error) throw error;
  return true;
}

// ------------------------------------------------------------
//  BORRAR un registro
// ------------------------------------------------------------
export async function borrarRegistro(tabla, id) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const { error } = await supabase.from(tabla).delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ------------------------------------------------------------
//  SUBIR EN BLOQUE: una colección completa de la app a Supabase.
//  Usado en la migración inicial.
// ------------------------------------------------------------
export async function subirColeccion(tabla, registros) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  if (!registros || registros.length === 0) return 0;
  const filas = registros.map(r => objetoAFila(tabla, r));
  // Subir en lotes de 100 para no rebasar límites
  let total = 0;
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const { error } = await supabase.from(tabla).upsert(lote, { onConflict: "id" });
    if (error) throw error;
    total += lote.length;
  }
  return total;
}

// ------------------------------------------------------------
//  MIGRAR CATÁLOGOS: sube solo lo que es catálogo real del rancho.
//  Lo demás (movimientos, demos) queda en cero en la nube.
// ------------------------------------------------------------
export async function migrarCatalogos(datosLocales) {
  const resumen = {};
  for (const c of CATALOGOS) {
    const registros = datosLocales[c] || [];
    try {
      const subidos = await subirColeccion(c, registros);
      resumen[c] = { ok: true, cantidad: subidos };
    } catch (e) {
      resumen[c] = { ok: false, error: e.message };
    }
  }
  return resumen;
}
