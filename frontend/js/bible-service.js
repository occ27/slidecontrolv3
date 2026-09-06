/**
 * SLIDECONTROL V3 — BIBLE SERVICE
 * Integração completa da Bíblia Sagrada com o banco SQLite local (FastAPI),
 * parser de referências bíblicas instantâneo e abastecimento da Trilha Norte (3D Orbital).
 */

class BibleService {
  constructor() {
    this.apiUrl = '/api/bible';
    this.versions = [];
    this.books = [];
    this.selectedVersion = 'acf';
    this.selectedBook = null; // Objeto do livro atual
    this.selectedChapter = 1;
    this.selectedVerse = 1;
    this.currentChapterVerses = [];
    this.history = [];
    this.initialized = false;

    // Tabela de abreviações e apelidos populares em Português para busca instantânea
    this.bookAliases = {
      // Antigo Testamento
      'gn': 'gn', 'gen': 'gn', 'genesis': 'gn', 'gênesis': 'gn',
      'ex': 'ex', 'exo': 'ex', 'exodo': 'ex', 'êxodo': 'ex',
      'lv': 'lv', 'lev': 'lv', 'levitico': 'lv', 'levítico': 'lv',
      'nm': 'nm', 'num': 'nm', 'numeros': 'nm', 'números': 'nm',
      'dt': 'dt', 'deu': 'dt', 'deuteronomio': 'dt', 'deuteronômio': 'dt',
      'js': 'js', 'jos': 'js', 'josue': 'js', 'josué': 'js',
      'jz': 'jz', 'jui': 'jz', 'juizes': 'jz', 'juízes': 'jz',
      'rt': 'rt', 'rut': 'rt', 'rute': 'rt',
      '1sm': '1sm', '1sam': '1sm', '1samuel': '1sm', '1 samuel': '1sm', 'i sm': '1sm', 'i samuel': '1sm',
      '2sm': '2sm', '2sam': '2sm', '2samuel': '2sm', '2 samuel': '2sm', 'ii sm': '2sm', 'ii samuel': '2sm',
      '1rs': '1rs', '1re': '1rs', '1reis': '1rs', '1 reis': '1rs', 'i rs': '1rs', 'i reis': '1rs',
      '2rs': '2rs', '2re': '2rs', '2reis': '2rs', '2 reis': '2rs', 'ii rs': '2rs', 'ii reis': '2rs',
      '1cr': '1cr', '1cro': '1cr', '1cronicas': '1cr', '1 crônicas': '1cr', 'i cr': '1cr', 'i cronicas': '1cr',
      '2cr': '2cr', '2cro': '2cr', '2cronicas': '2cr', '2 crônicas': '2cr', 'ii cr': '2cr', 'ii cronicas': '2cr',
      'ed': 'ed', 'esd': 'ed', 'esdras': 'ed',
      'ne': 'ne', 'nee': 'ne', 'neemias': 'ne',
      'et': 'et', 'est': 'et', 'ester': 'et',
      'job': 'jó', 'jo': 'jó', 'jó': 'jó',
      'sl': 'sl', 'sal': 'sl', 'salmo': 'sl', 'salmos': 'sl',
      'pv': 'pv', 'pro': 'pv', 'proverbios': 'pv', 'provérbios': 'pv',
      'ec': 'ec', 'ecl': 'ec', 'eclesiastes': 'ec',
      'ct': 'ct', 'can': 'ct', 'canticos': 'ct', 'cânticos': 'ct', 'cantares': 'ct',
      'is': 'is', 'isa': 'is', 'isaias': 'is', 'isaías': 'is',
      'jr': 'jr', 'jer': 'jr', 'jeremias': 'jr',
      'lm': 'lm', 'lam': 'lm', 'lamentacoes': 'lm', 'lamentações': 'lm',
      'ez': 'ez', 'eze': 'ez', 'ezequiel': 'ez',
      'dn': 'dn', 'dan': 'dn', 'daniel': 'dn',
      'os': 'os', 'ose': 'os', 'oseias': 'os', 'oséias': 'os',
      'jl': 'jl', 'joe': 'jl', 'joel': 'jl',
      'am': 'am', 'amo': 'am', 'amos': 'am', 'amós': 'am',
      'ob': 'ob', 'oba': 'ob', 'obadias': 'ob',
      'jn': 'jn', 'jon': 'jn', 'jonas': 'jn',
      'mq': 'mq', 'miq': 'mq', 'miqueias': 'mq', 'miquéias': 'mq',
      'na': 'na', 'nau': 'na', 'naum': 'na',
      'hc': 'hc', 'hab': 'hc', 'habacuque': 'hc',
      'sf': 'sf', 'sof': 'sf', 'sofonias': 'sf',
      'ag': 'ag', 'age': 'ag', 'ageu': 'ag',
      'zc': 'zc', 'zac': 'zc', 'zacarias': 'zc',
      'ml': 'ml', 'mal': 'ml', 'malaquias': 'ml',

      // Novo Testamento
      'mt': 'mt', 'mat': 'mt', 'mateus': 'mt',
      'mc': 'mc', 'mar': 'mc', 'marcos': 'mc',
      'lc': 'lc', 'luc': 'lc', 'lucas': 'lc',
      'joao': 'jo', 'joão': 'jo', 'jhn': 'jo',
      'at': 'at', 'act': 'at', 'atos': 'at',
      'rm': 'rm', 'rom': 'rm', 'romanos': 'rm',
      '1co': '1co', '1cor': '1co', '1corintios': '1co', '1 corintios': '1co', '1 coríntios': '1co', 'i co': '1co',
      '2co': '2co', '2cor': '2co', '2corintios': '2co', '2 corintios': '2co', '2 coríntios': '2co', 'ii co': '2co',
      'gl': 'gl', 'gal': 'gl', 'galatas': 'gl', 'gálatas': 'gl',
      'ef': 'ef', 'efe': 'ef', 'efesios': 'ef', 'efésios': 'ef',
      'fp': 'fp', 'fil': 'fp', 'filipenses': 'fp', 'flp': 'fp',
      'cl': 'cl', 'col': 'cl', 'colossenses': 'cl',
      '1ts': '1ts', '1tes': '1ts', '1tessalonicenses': '1ts', '1 tessalonicenses': '1ts', 'i ts': '1ts',
      '2ts': '2ts', '2tes': '2ts', '2tessalonicenses': '2ts', '2 tessalonicenses': '2ts', 'ii ts': '2ts',
      '1tm': '1tm', '1tim': '1tm', '1timoteo': '1tm', '1 timóteo': '1tm', '1 timoteo': '1tm', 'i tm': '1tm',
      '2tm': '2tm', '2tim': '2tm', '2timoteo': '2tm', '2 timóteo': '2tm', '2 timoteo': '2tm', 'ii tm': '2tm',
      'tt': 'tt', 'tit': 'tt', 'tito': 'tt',
      'fm': 'fm', 'flm': 'fm', 'filemom': 'fm', 'filemon': 'fm',
      'hb': 'hb', 'heb': 'hb', 'hebreus': 'hb',
      'tg': 'tg', 'tia': 'tg', 'tiago': 'tg',
      '1pe': '1pe', '1ped': '1pe', '1pedro': '1pe', '1 pedro': '1pe', 'i pe': '1pe', 'i pedro': '1pe',
      '2pe': '2pe', '2ped': '2pe', '2pedro': '2pe', '2 pedro': '2pe', 'ii pe': '2pe', 'ii pedro': '2pe',
      '1jo': '1jo', '1joao': '1jo', '1 joão': '1jo', '1 joao': '1jo', 'i jo': '1jo', 'i joao': '1jo',
      '2jo': '2jo', '2joao': '2jo', '2 joão': '2jo', '2 joao': '2jo', 'ii jo': '2jo', 'ii joao': '2jo',
      '3jo': '3jo', '3joao': '3jo', '3 joão': '3jo', '3 joao': '3jo', 'iii jo': '3jo', 'iii joao': '3jo',
      'jd': 'jd', 'jud': 'jd', 'judas': 'jd',
      'ap': 'ap', 'apo': 'ap', 'apocalipse': 'ap', 'apoc': 'ap', 'rev': 'ap'
    };
  }

  async init() {
    if (this.initialized) return;
    try {
      await Promise.all([this.loadVersions(), this.loadBooks()]);
      this.initialized = true;
      console.log('📖 BibleService inicializado com', this.books.length, 'livros e', this.versions.length, 'versões.');
    } catch (e) {
      console.error('Erro ao inicializar BibleService:', e);
    }
  }

  async loadVersions() {
    try {
      const res = await fetch(`${this.apiUrl}/versions`);
      if (res.ok) {
        this.versions = await res.json();
        if (this.versions.length > 0 && !this.versions.find(v => v.abbreviation === this.selectedVersion)) {
          this.selectedVersion = this.versions[0].abbreviation;
        }
      }
    } catch (e) {
      console.warn('Não foi possível carregar versões da Bíblia:', e);
    }
  }

  async loadBooks(version = null) {
    const v = version || this.selectedVersion || 'acf';
    try {
      const res = await fetch(`${this.apiUrl}/books?version=${encodeURIComponent(v)}`);
      if (res.ok) {
        this.books = await res.json();
        if (!this.selectedBook && this.books.length > 0) {
          this.selectedBook = this.books.find(b => b.abbrev === 'jo') || this.books[0];
        }
      }
    } catch (e) {
      console.warn('Não foi possível carregar livros da Bíblia:', e);
    }
  }

  getOldTestamentBooks() {
    return this.books.filter(b => b.book_order <= 39);
  }

  getNewTestamentBooks() {
    return this.books.filter(b => b.book_order > 39);
  }

  async getChapter(bookAbbrev, chapterNum, version = null) {
    const v = version || this.selectedVersion || 'acf';
    try {
      const bookObj = this.books.find(b => b.abbrev.toLowerCase() === bookAbbrev.toLowerCase());
      const orderParam = bookObj ? `?order=${bookObj.book_order}` : '';
      const res = await fetch(`${this.apiUrl}/verses/${encodeURIComponent(v)}/${encodeURIComponent(bookAbbrev)}/${chapterNum}${orderParam}`);
      if (res.ok) {
        const data = await res.json();
        this.selectedBook = bookObj || { abbrev: bookAbbrev, name: data.book };
        this.selectedChapter = Number(chapterNum);
        this.currentChapterVerses = data.verses || [];
        return data;
      }
    } catch (e) {
      console.error('Erro ao buscar capítulo da Bíblia:', e);
    }
    return null;
  }

  parseReference(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const regex = /^(\d?\s*[a-z]+)\s*(\d+)(?:[:\s]+(\d+)(?:-\d+)?)?$/i;
    const match = clean.match(regex);
    if (!match) return null;

    let rawBook = match[1].trim();
    rawBook = rawBook.replace(/^i\s+/, '1 ').replace(/^ii\s+/, '2 ').replace(/^iii\s+/, '3 ');
    const compactBook = rawBook.replace(/\s+/g, '');

    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : 1;

    let targetAbbrev = this.bookAliases[compactBook] || this.bookAliases[rawBook];

    if (!targetAbbrev && this.books.length > 0) {
      const found = this.books.find(b => {
        const n = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        const a = b.abbrev.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return a === compactBook || n === compactBook || a.startsWith(compactBook) || n.startsWith(compactBook);
      });
      if (found) targetAbbrev = found.abbrev;
    }

    if (query.trim().toLowerCase() === 'jó' || query.trim().toLowerCase().startsWith('jó ')) {
      targetAbbrev = 'jó';
    }

    if (!targetAbbrev) return null;

    const bookObj = this.books.find(b => b.abbrev.toLowerCase() === targetAbbrev.toLowerCase());
    return {
      abbrev: targetAbbrev,
      bookName: bookObj ? bookObj.name : targetAbbrev.toUpperCase(),
      bookOrder: bookObj ? bookObj.book_order : null,
      chapter: chapter || 1,
      verse: verse || 1
    };
  }

  async search(query, version = null) {
    if (!query || query.trim().length < 2) return [];
    const v = version || this.selectedVersion || 'acf';

    const ref = this.parseReference(query);
    if (ref) {
      const chapterData = await this.getChapter(ref.abbrev, ref.chapter, v);
      if (chapterData && chapterData.verses) {
        return chapterData.verses.map(verseItem => ({
          version: v,
          book: { name: chapterData.book, abbrev: ref.abbrev },
          chapter: { number: ref.chapter },
          verse: {
            number: verseItem.verse,
            text: verseItem.text,
            reference: `${chapterData.book} ${ref.chapter}:${verseItem.verse}`
          },
          isDirectReference: Number(verseItem.verse) === Number(ref.verse)
        }));
      }
    }

    try {
      const res = await fetch(`${this.apiUrl}/search?query=${encodeURIComponent(query)}&version=${encodeURIComponent(v)}&limit=40`);
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch (e) {
      console.warn('Erro na busca textual da Bíblia:', e);
    }
    return [];
  }

  async loadPassageToOrbital(bookAbbrev, chapterNum, focusVerseNum = 1, version = null) {
    await this.init();
    const v = version || this.selectedVersion || 'acf';
    const data = await this.getChapter(bookAbbrev, chapterNum, v);
    if (!data || !data.verses || data.verses.length === 0) {
      if (typeof window.showToast === 'function') window.showToast('Capítulo não encontrado na Bíblia.', 'error');
      return false;
    }

    this.selectedVerse = Number(focusVerseNum) || 1;
    this.addHistory({
      book: data.book,
      abbrev: bookAbbrev,
      chapter: chapterNum,
      verse: this.selectedVerse,
      version: v,
      timestamp: Date.now()
    });

    if (window.orbitalEngine && typeof window.orbitalEngine.loadBibleCards === 'function') {
      window.orbitalEngine.loadBibleCards(
        data.verses,
        data.book,
        chapterNum,
        v,
        this.selectedVerse
      );
    }

    if (window.slideTelemetry) {
      window.slideTelemetry.appendLog(
        `${data.book.toUpperCase()} ${chapterNum}`,
        `Capítulo bíblico carregado (${data.verses.length} versículos)`,
        'info'
      );
    }

    return true;
  }

  addHistory(item) {
    this.history = this.history.filter(h => !(h.abbrev === item.abbrev && h.chapter === item.chapter));
    this.history.unshift(item);
    if (this.history.length > 20) this.history.pop();
    try {
      localStorage.setItem('sc_bible_history', JSON.stringify(this.history));
    } catch (e) {}
  }

  getHistory() {
    if (this.history.length === 0) {
      try {
        const saved = localStorage.getItem('sc_bible_history');
        if (saved) this.history = JSON.parse(saved);
      } catch (e) {}
    }
    return this.history;
  }
}

window.bibleService = new BibleService();
window.addEventListener('DOMContentLoaded', () => {
  window.bibleService.init();
});
