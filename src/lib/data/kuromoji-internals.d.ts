/**
 * Deep imports into kuromoji's CommonJS internals. We bypass its
 * TokenizerBuilder/BrowserDictionaryLoader on purpose: the stock loader
 * needs Node's `path` module (which Vite won't polyfill) and gunzips with
 * bundled zlibjs, which breaks when a server already inflated the .dat.gz
 * via Content-Encoding. Loading the buffers ourselves (fetchBufferGz) and
 * feeding DynamicDictionaries directly avoids both — see kuromoji.ts.
 */

declare module 'kuromoji/src/dict/DynamicDictionaries.js' {
  class DynamicDictionaries {
    loadTrie(base: Int32Array, check: Int32Array): DynamicDictionaries
    loadTokenInfoDictionaries(
      tokenInfo: Uint8Array,
      pos: Uint8Array,
      targetMap: Uint8Array,
    ): DynamicDictionaries
    loadConnectionCosts(cc: Int16Array): DynamicDictionaries
    loadUnknownDictionaries(
      unk: Uint8Array,
      unkPos: Uint8Array,
      unkMap: Uint8Array,
      catMap: Uint8Array,
      compatCatMap: Uint32Array,
      invokeDef: Uint8Array,
    ): DynamicDictionaries
  }
  export = DynamicDictionaries
}

declare module 'kuromoji/src/Tokenizer.js' {
  import type { IpadicFeatures } from 'kuromoji'
  import type DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js'
  class Tokenizer {
    constructor(dic: DynamicDictionaries)
    tokenize(text: string): IpadicFeatures[]
  }
  export = Tokenizer
}
