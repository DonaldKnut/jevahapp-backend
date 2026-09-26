/**
 * Public-domain Bible text helpers for KJV, BSB, ASV, and Douay-Rheims.
 * Sources are official / public-domain files only. No Bible Gateway, YouVersion, or NIV.
 */

const CANONICAL_BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

const USFM_TO_NAME = {
  GEN: "Genesis",
  EXO: "Exodus",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEU: "Deuteronomy",
  JOS: "Joshua",
  JDG: "Judges",
  RUT: "Ruth",
  "1SA": "1 Samuel",
  "2SA": "2 Samuel",
  "1KI": "1 Kings",
  "2KI": "2 Kings",
  "1CH": "1 Chronicles",
  "2CH": "2 Chronicles",
  EZR: "Ezra",
  NEH: "Nehemiah",
  EST: "Esther",
  JOB: "Job",
  PSA: "Psalms",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SNG: "Song of Solomon",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  EZK: "Ezekiel",
  EZE: "Ezekiel",
  DAN: "Daniel",
  HOS: "Hosea",
  JOL: "Joel",
  JOE: "Joel",
  AMO: "Amos",
  OBA: "Obadiah",
  JON: "Jonah",
  MIC: "Micah",
  NAM: "Nahum",
  NAH: "Nahum",
  HAB: "Habakkuk",
  ZEP: "Zephaniah",
  HAG: "Haggai",
  ZEC: "Zechariah",
  MAL: "Malachi",
  MAT: "Matthew",
  MRK: "Mark",
  MAR: "Mark",
  LUK: "Luke",
  JHN: "John",
  JOH: "John",
  ACT: "Acts",
  ROM: "Romans",
  "1CO": "1 Corinthians",
  "2CO": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHP: "Philippians",
  PHI: "Philippians",
  COL: "Colossians",
  "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians",
  "1TI": "1 Timothy",
  "2TI": "2 Timothy",
  TIT: "Titus",
  PHM: "Philemon",
  HEB: "Hebrews",
  JAS: "James",
  JAM: "James",
  "1PE": "1 Peter",
  "2PE": "2 Peter",
  "1JN": "1 John",
  "1JO": "1 John",
  "2JN": "2 John",
  "2JO": "2 John",
  "3JN": "3 John",
  "3JO": "3 John",
  JUD: "Jude",
  REV: "Revelation",
};

const EXTRA_ALIASES = {
  psalm: "Psalms",
  psalms: "Psalms",
  psa: "Psalms",
  ps: "Psalms",
  "song of songs": "Song of Solomon",
  "song of solomon": "Song of Solomon",
  canticles: "Song of Solomon",
  "canticle of canticles": "Song of Solomon",
  songs: "Song of Solomon",
  sos: "Song of Solomon",
  "acts of the apostles": "Acts",
  "the acts": "Acts",
  "revelation of john": "Revelation",
  "revelation of st john": "Revelation",
  apocalypse: "Revelation",
  "i samuel": "1 Samuel",
  "ii samuel": "2 Samuel",
  "i kings": "1 Kings",
  "ii kings": "2 Kings",
  "i chronicles": "1 Chronicles",
  "ii chronicles": "2 Chronicles",
  "i corinthians": "1 Corinthians",
  "ii corinthians": "2 Corinthians",
  "i thessalonians": "1 Thessalonians",
  "ii thessalonians": "2 Thessalonians",
  "i timothy": "1 Timothy",
  "ii timothy": "2 Timothy",
  "i peter": "1 Peter",
  "ii peter": "2 Peter",
  "i john": "1 John",
  "ii john": "2 John",
  "iii john": "3 John",
  "1 sam": "1 Samuel",
  "2 sam": "2 Samuel",
  "1 kgs": "1 Kings",
  "2 kgs": "2 Kings",
  "1 chr": "1 Chronicles",
  "2 chr": "2 Chronicles",
  "1 cor": "1 Corinthians",
  "2 cor": "2 Corinthians",
  "1 thess": "1 Thessalonians",
  "2 thess": "2 Thessalonians",
  "1 tim": "1 Timothy",
  "2 tim": "2 Timothy",
  "1 pet": "1 Peter",
  "2 pet": "2 Peter",
  "1 jn": "1 John",
  "2 jn": "2 John",
  "3 jn": "3 John",
  "song": "Song of Solomon",
  josue: "Joshua",
  "1 kings dr": "1 Samuel",
  "2 kings dr": "2 Samuel",
  "3 kings": "1 Kings",
  "4 kings": "2 Kings",
  "1 paralipomenon": "1 Chronicles",
  "2 paralipomenon": "2 Chronicles",
  "1 esdras": "Ezra",
  "2 esdras": "Nehemiah",
  "canticle of canticles": "Song of Solomon",
  canticles: "Song of Solomon",
  isaias: "Isaiah",
  jeremias: "Jeremiah",
  ezechiel: "Ezekiel",
  osee: "Hosea",
  abdias: "Obadiah",
  jonas: "Jonah",
  micheas: "Micah",
  habacuc: "Habakkuk",
  sophonias: "Zephaniah",
  aggeus: "Haggai",
  zacharias: "Zechariah",
  malachias: "Malachi",
  apocalypse: "Revelation",
};

const MIN_PROTESTANT_VERSES = 30000;

const SOURCES = {
  KJV: [
    {
      name: "eKJV (University of Michigan KJV text)",
      url: "https://www.ekjv.org/ekjv/bible.txt",
    },
    {
      name: "OpenBible KJV plaintext",
      url: "https://openbible.com/textfiles/kjv.txt",
    },
    {
      name: "scrollmapper public-domain KJV",
      url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/txt/KJV.txt",
    },
  ],
  BSB: [
    {
      name: "Official BSB plaintext (bereanbible.com)",
      url: "https://bereanbible.com/bsb.txt",
    },
  ],
  ASV: [
    {
      name: "OpenBible ASV 1901 plaintext",
      url: "https://openbible.com/textfiles/asv.txt",
    },
    {
      name: "scrollmapper public-domain ASV",
      url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/txt/ASV.txt",
    },
  ],
  DRB: [
    {
      name: "OpenBible Douay-Rheims (1899 Challoner) plaintext",
      url: "https://openbible.com/textfiles/drb.txt",
    },
  ],
};

function keyOf(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBookIndex() {
  const map = new Map();
  for (const name of CANONICAL_BOOKS) {
    map.set(keyOf(name), name);
    map.set(keyOf(name.replace(/\s+/g, "")), name);
  }
  for (const [code, name] of Object.entries(USFM_TO_NAME)) {
    map.set(keyOf(code), name);
  }
  for (const [alias, name] of Object.entries(EXTRA_ALIASES)) {
    map.set(keyOf(alias), name);
  }
  const short = {
    gen: "Genesis",
    exo: "Exodus",
    ex: "Exodus",
    lev: "Leviticus",
    num: "Numbers",
    deu: "Deuteronomy",
    deut: "Deuteronomy",
    jos: "Joshua",
    jdg: "Judges",
    rut: "Ruth",
    ezr: "Ezra",
    neh: "Nehemiah",
    est: "Esther",
    job: "Job",
    pro: "Proverbs",
    prov: "Proverbs",
    ecc: "Ecclesiastes",
    eccl: "Ecclesiastes",
    isa: "Isaiah",
    jer: "Jeremiah",
    lam: "Lamentations",
    eze: "Ezekiel",
    ezek: "Ezekiel",
    dan: "Daniel",
    hos: "Hosea",
    joe: "Joel",
    amo: "Amos",
    oba: "Obadiah",
    jon: "Jonah",
    mic: "Micah",
    nah: "Nahum",
    hab: "Habakkuk",
    zep: "Zephaniah",
    hag: "Haggai",
    zec: "Zechariah",
    zech: "Zechariah",
    mal: "Malachi",
    mat: "Matthew",
    matt: "Matthew",
    mrk: "Mark",
    mk: "Mark",
    luk: "Luke",
    lk: "Luke",
    jhn: "John",
    jn: "John",
    act: "Acts",
    rom: "Romans",
    gal: "Galatians",
    eph: "Ephesians",
    php: "Philippians",
    phil: "Philippians",
    col: "Colossians",
    tit: "Titus",
    phm: "Philemon",
    heb: "Hebrews",
    jas: "James",
    jam: "James",
    jud: "Jude",
    jude: "Jude",
    rev: "Revelation",
  };
  for (const [alias, name] of Object.entries(short)) {
    map.set(alias, name);
  }
  return map;
}

const BOOK_INDEX = buildBookIndex();

function resolveBookName(raw) {
  if (!raw) return null;
  const key = keyOf(raw);
  if (BOOK_INDEX.has(key)) return BOOK_INDEX.get(key);
  const compact = key.replace(/\s+/g, "");
  if (BOOK_INDEX.has(compact)) return BOOK_INDEX.get(compact);
  return null;
}

const NAME_CHAPTER_VERSE = /^(\d?\s*[A-Za-z][A-Za-z']+(?:\s+[A-Za-z][A-Za-z']+){0,4})\s+(\d+):(\d+)(?:\s+(.*))?$/;
const USFM_LINE = /^([A-Z][A-Z0-9]{1,3})\s+(\d+):(\d+)(?:\s+(.*))?$/;
const DOT_ABBREV = /^([1-3]?[A-Za-z]+)\.(\d+):(\d+)(?:\s+(.*))?$/;

function cleanVerseText(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseVerseLine(line) {
  const raw = String(line || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) return null;

  let match = raw.match(USFM_LINE);
  if (match && USFM_TO_NAME[match[1]]) {
    return {
      bookName: USFM_TO_NAME[match[1]],
      chapterNumber: Number(match[2]),
      verseNumber: Number(match[3]),
      text: cleanVerseText(match[4]),
    };
  }

  match = raw.match(DOT_ABBREV);
  if (match) {
    const bookName = resolveBookName(match[1]);
    if (bookName) {
      return {
        bookName,
        chapterNumber: Number(match[2]),
        verseNumber: Number(match[3]),
        text: cleanVerseText(match[4]),
      };
    }
  }

  match = raw.match(NAME_CHAPTER_VERSE);
  if (match) {
    const bookName = resolveBookName(match[1]);
    if (bookName) {
      return {
        bookName,
        chapterNumber: Number(match[2]),
        verseNumber: Number(match[3]),
        text: cleanVerseText(match[4]),
      };
    }
  }

  return null;
}

function parseVersePerLineText(text) {
  const verses = [];
  const omitted = [];
  const skipped = [];
  const seen = new Set();
  const lines = String(text || "").split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseVerseLine(line);
    if (!parsed) {
      const trimmed = String(line || "").trim();
      if (trimmed && /\d+:\d+/.test(trimmed)) skipped.push(trimmed.slice(0, 80));
      continue;
    }
    if (!parsed.text) {
      omitted.push(
        `${parsed.bookName} ${parsed.chapterNumber}:${parsed.verseNumber}`
      );
      continue;
    }
    const key = `${parsed.bookName}:${parsed.chapterNumber}:${parsed.verseNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    verses.push(parsed);
  }

  return { verses, omitted, skipped };
}

function summarizeCorpus(verses) {
  const books = new Set();
  for (const v of verses) books.add(v.bookName);
  return {
    verseCount: verses.length,
    bookCount: books.size,
    missingBooks: CANONICAL_BOOKS.filter((name) => !books.has(name)),
  };
}

function assertProtestantCanon(verses, label) {
  const summary = summarizeCorpus(verses);
  if (summary.verseCount < MIN_PROTESTANT_VERSES) {
    throw new Error(
      `${label}: only ${summary.verseCount} verses (need ≥ ${MIN_PROTESTANT_VERSES}). File looks truncated or is the wrong edition.`
    );
  }
  if (summary.missingBooks.length) {
    throw new Error(
      `${label}: missing books ${summary.missingBooks.join(", ")}`
    );
  }
  return summary;
}

module.exports = {
  CANONICAL_BOOKS,
  MIN_PROTESTANT_VERSES,
  SOURCES,
  resolveBookName,
  parseVerseLine,
  parseVersePerLineText,
  summarizeCorpus,
  assertProtestantCanon,
};
