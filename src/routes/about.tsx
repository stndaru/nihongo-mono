import { createFileRoute, Link } from '@tanstack/react-router'
import meta from '@/data/meta.json'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

const SOURCES = [
  {
    name: 'JMdict (via jmdict-simplified)',
    href: 'https://www.edrdg.org/jmdict/j_jmdict.html',
    license: 'EDRDG licence (CC BY-SA compatible)',
    licenseHref: 'https://www.edrdg.org/edrdg/licence.html',
    what: 'Every word entry — readings, verb classes, transitivity, translations. JLPT-listed words are bundled; the full dictionary loads on demand ("Beyond" level).',
  },
  {
    name: 'JMnedict / ENAMDICT',
    href: 'https://www.edrdg.org/enamdict/enamdict_doc.html',
    license: 'EDRDG licence',
    licenseHref: 'https://www.edrdg.org/edrdg/licence.html',
    what: 'The Names page: 740k+ proper names (surnames, given names, places, companies…).',
  },
  {
    name: 'KANJIDIC2 (via jmdict-simplified)',
    href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    license: 'CC BY-SA 4.0 (EDRDG)',
    licenseHref: 'https://www.edrdg.org/edrdg/licence.html',
    what: 'Kanji meanings, readings, stroke counts, grades, frequency.',
  },
  {
    name: 'JmdictFurigana',
    href: 'https://github.com/Doublevil/JmdictFurigana',
    license: 'Same terms as JMdict (EDRDG)',
    licenseHref: 'https://github.com/Doublevil/JmdictFurigana#license',
    what: 'Per-character furigana segmentation.',
  },
  {
    name: 'Tanaka Corpus / Tatoeba example sentences',
    href: 'https://tatoeba.org/',
    license: 'CC BY 2.0 FR',
    licenseHref: 'https://creativecommons.org/licenses/by/2.0/fr/',
    what: 'Japanese–English example sentences.',
  },
  {
    name: 'JLPT word lists (elzup/jlpt-word-list & stephenmk/yomitan-jlpt-vocab, based on Jonathan Waller’s lists)',
    href: 'https://github.com/stephenmk/yomitan-jlpt-vocab',
    license: 'CC BY (tanos.co.uk)',
    licenseHref: 'http://www.tanos.co.uk/jlpt/sharing/',
    what: 'JLPT level assignment; the yomitan lists add exact JMdict entry ids.',
  },
  {
    name: 'JLPT kanji levels (davidluzgouveia/kanji-data, based on Jonathan Waller’s lists)',
    href: 'https://github.com/davidluzgouveia/kanji-data',
    license: 'MIT / CC BY (tanos.co.uk)',
    licenseHref: 'https://github.com/davidluzgouveia/kanji-data/blob/master/LICENSE',
    what: 'Modern five-level (N5–N1) JLPT tags per kanji — KANJIDIC2 itself only carries the pre-2010 four-level scale.',
  },
  {
    name: 'KRADFILE',
    href: 'https://www.edrdg.org/krad/kradinf.html',
    license: 'EDRDG licence',
    licenseHref: 'https://www.edrdg.org/edrdg/licence.html',
    what: 'Kanji component (radical) decomposition.',
  },
  {
    name: 'KanjiVG (© Ulrich Apel)',
    href: 'https://kanjivg.tagaini.net/',
    license: 'CC BY-SA 3.0',
    licenseHref: 'https://creativecommons.org/licenses/by-sa/3.0/',
    what: 'Kanji stroke-order diagrams (the numbered frame strips on kanji pages).',
  },
  {
    name: 'kuromoji.js + IPADIC',
    href: 'https://github.com/takuyaa/kuromoji.js',
    license: 'Apache-2.0 + IPADIC licence',
    licenseHref: '/kuromoji/NOTICE.md',
    what: 'Morphological analysis: example-sentence furigana at build time, and the sentence parser’s optional "Smart Parsing" mode (the IPADIC dictionary downloads on first use; its licence notice ships alongside it).',
  },
  {
    name: 'PaddleOCR.js + PP-OCRv5 mobile models',
    href: 'https://github.com/PaddlePaddle/PaddleOCR',
    license: 'Apache-2.0',
    licenseHref: '/ocr/paddle/NOTICE.md',
    what: 'Primary on-device image-to-text for the sentence parser, including horizontal, vertical, and handwritten Japanese. The pinned browser runtime and models download only after opt-in.',
  },
  {
    name: 'tesseract-wasm + Tesseract tessdata_fast models',
    href: 'https://github.com/robertknight/tesseract-wasm',
    license: 'BSD-2-Clause + Apache-2.0',
    licenseHref: '/ocr/NOTICE.md',
    what: 'Automatic and manual fallback for the sentence parser’s optional on-device image scanning when Paddle fails, returns no text, or needs a comparison.',
  },
] as const

const FURTHER_REFERENCES = [
  { name: 'JMdict-EDICT project', href: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project' },
  { name: 'KANJIDIC project', href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' },
  { name: 'Tatoeba', href: 'https://tatoeba.org/' },
  { name: 'Jreibun (example sentences — planned; its dataset is not yet published)', href: 'https://www.tufs.ac.jp/ts/personal/SUZUKI_Tomomi/jreibun/index-jreibun.html' },
  { name: 'kanji.org', href: 'https://www.kanji.org/' },
] as const

function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">About</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        nihongo mono is a lightweight Japanese verb dictionary and conjugation
        trainer. There is no account requirement and no server database — your
        study progress is stored in this browser and can be exported from
        Settings. Optionally, Settings can connect your own Google Drive to
        sync progress across devices: the app then talks to Google directly
        from your browser using the narrow drive.file permission (it can only
        see the files it created), keeps the data in a visible{' '}
        <span className="text-foreground">My Drive › Nihongo Mono</span> folder
        that shouldn&apos;t be moved or edited by hand, and nothing ever
        passes through a nihongo mono server — there isn&apos;t one. Full
        details, disclaimers, and legal notes:{' '}
        <Link
          to="/cloud-sync"
          className="text-primary underline-offset-2 hover:underline"
        >
          Cloud Sync — How It Works &amp; Privacy
        </Link>
        .
      </p>

      <h2 className="mt-8 text-lg font-semibold">Data sources & licences</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This site uses the{' '}
        <a className="text-primary underline-offset-2 hover:underline" href="https://www.edrdg.org/">
          Electronic Dictionary Research and Development Group
        </a>
        &apos;s JMdict and KANJIDIC dictionary files in accordance with the
        Group&apos;s licence. Dataset generated {meta.generated}.
      </p>
      <ul className="mt-4 space-y-4">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <a
                className="font-medium text-primary underline-offset-2 hover:underline"
                href={s.href}
                target="_blank"
                rel="noreferrer"
              >
                {s.name}
              </a>
              <a
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                href={s.licenseHref}
                target="_blank"
                rel="noreferrer"
              >
                {s.license}
              </a>
            </div>
            <p className="mt-1 text-muted-foreground">{s.what}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Further references</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Projects consulted for verification, and planned future sources:
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {FURTHER_REFERENCES.map((r) => (
          <li key={r.name}>
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={r.href}
              target="_blank"
              rel="noreferrer"
            >
              {r.name}
            </a>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">This app&apos;s licence</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        nihongo mono&apos;s source code is MIT-licensed. The generated
        dictionary data it serves remains under the licences of its sources:
        CC BY-SA 4.0 (EDRDG licence) for everything derived from JMdict,
        JMnedict, KANJIDIC2, and KRADFILE, and CC BY-SA 3.0 for the KanjiVG
        stroke-order data — see the repository&apos;s LICENSE and
        LICENSE-DATA files for the exact per-directory breakdown. The
        Grammar Points explanations, formation structures, pitfalls, and
        example sentences are original content written for this app (MIT,
        like the code); only the inventory of which grammar points exist at
        each JLPT level was cross-referenced against public JLPT study
        lists.
      </p>

      <h2 className="mt-8 text-lg font-semibold">A note on JLPT levels</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        There are no official public JLPT vocabulary lists since 2010. The
        levels shown here are community estimates — treat them as a rough
        difficulty guide, not a promise about exam content.
      </p>
    </div>
  )
}
