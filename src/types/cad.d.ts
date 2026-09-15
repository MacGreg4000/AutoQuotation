/**
 * Déclarations pour les paquets CAO dépourvus de types exploitables.
 */

declare module 'dxf' {
  export class Helper {
    constructor(dxf: string)
    parsed: any
    denormalised: any[]
    toSVG(): string
    toPolylines(): any
  }
}

// Le module WebAssembly livre bien un .d.ts, mais ce sous-chemin n'est pas
// déclaré dans les « exports » du paquet : TypeScript ne le résout donc pas.
declare module 'dwgdxf-wasm' {
  export function convertDwgToDxf(dwg: Uint8Array): Uint8Array
  export default function init(
    options: { module_or_path: ArrayBuffer | Uint8Array | WebAssembly.Module }
  ): Promise<unknown>
}
