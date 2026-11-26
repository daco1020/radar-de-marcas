/* eslint-disable @typescript-eslint/no-explicit-any */
// Dónde guarda el motor sus archivos intermedios (respuestas de treg y datos calculados).
// En la nube es el bucket "informes" (carpeta motor/<informe>/); en las pruebas, una carpeta local.
export interface Almacen {
  leer(nombre: string): Promise<any | null>;
  escribir(nombre: string, datos: unknown): Promise<void>;
  /** Nombres (con su prefijo) que empiezan por `prefijo`, ordenados. */
  listar(prefijo: string): Promise<string[]>;
}

/** Almacén en memoria con lectura perezosa de otro almacén (lo usa el cálculo para no releer). */
export class Memoria implements Almacen {
  datos = new Map<string, unknown>();
  async leer(n: string) {
    return this.datos.has(n) ? (this.datos.get(n) as any) : null;
  }
  async escribir(n: string, d: unknown) {
    this.datos.set(n, d);
  }
  async listar(p: string) {
    return [...this.datos.keys()].filter((k) => k.startsWith(p)).sort();
  }
}
