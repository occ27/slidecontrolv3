/**
 * SLIDECONTROL V3 — BIBLE SERVICE
 * Fast scripture retrieval and formatting for projection
 */

class BibleService {
  constructor() {
    this.passages = {
      'joao 3': {
        name: 'João 3',
        verses: [
          { num: 16, text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.' },
          { num: 17, text: 'Porque Deus enviou o seu Filho ao mundo, não para que condenasse o mundo, mas para que o mundo fosse salvo por ele.' },
          { num: 18, text: 'Quem crê nele não é condenado; mas quem não crê já está condenado, porquanto não crê no nome do unigênito Filho de Deus.' }
        ]
      },
      'salmos 23': {
        name: 'Salmos 23',
        verses: [
          { num: 1, text: 'O Senhor é o meu pastor; nada me faltará.' },
          { num: 2, text: 'Deitar-me faz em verdes pastos, guia-me mansamente a águas tranqüilas.' },
          { num: 3, text: 'Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome.' },
          { num: 4, text: 'Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo; a tua vara e o teu cajado me consolam.' },
          { num: 5, text: 'Preparas uma mesa perante mim na presença dos meus inimigos, unges a minha cabeça com óleo, o meu cálice transborda.' },
          { num: 6, text: 'Certamente que a bondade e a misericórdia me seguirão todos os dias da minha vida; e habitarei na casa do Senhor por longos dias.' }
        ]
      },
      'filipenses 4': {
        name: 'Filipenses 4',
        verses: [
          { num: 4, text: 'Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.' },
          { num: 6, text: 'Não estejais inquietos por coisa alguma; antes as vossas petições sejam em tudo conhecidas diante de Deus pela oração e súplica, com ação de graças.' },
          { num: 7, text: 'E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos pensamentos em Cristo Jesus.' },
          { num: 13, text: 'Posso todas as coisas naquele que me fortalece.' }
        ]
      },
      'romanos 8': {
        name: 'Romanos 8',
        verses: [
          { num: 1, text: 'Portanto, agora nenhuma condenação há para os que estão em Cristo Jesus, que não andam segundo a carne, mas segundo o Espírito.' },
          { num: 28, text: 'E sabemos que todas as coisas concorrem para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.' },
          { num: 31, text: 'Que diremos, pois, a estas coisas? Se Deus é por nós, quem será contra nós?' },
          { num: 38, text: 'Porque estou certo de que, nem a morte, nem a vida, nem os anjos, nem os principados, nem as potestades, nem o presente, nem o porvir,' },
          { num: 39, text: 'Nem a altura, nem a profundidade, nem alguma outra criatura nos poderá separar do amor de Deus, que está em Cristo Jesus nosso Senhor.' }
        ]
      },
      '1 corintios 13': {
        name: '1 Coríntios 13',
        verses: [
          { num: 4, text: 'O amor é paciente, é benigno; o amor não arde em ciúmes, não se ufana, não se ensoberbe,' },
          { num: 7, text: 'Tudo sofre, tudo crê, tudo espera, tudo suporta.' },
          { num: 8, text: 'O amor nunca perece; mas as profecias desaparecerão, as línguas cessarão, o conhecimento passará.' },
          { num: 13, text: 'Agora, pois, permanecem a fé, a esperança e o amor, estes três; mas o maior destes é o amor.' }
        ]
      }
    };
  }

  search(query) {
    const q = query.toLowerCase().trim()
      .replace('jo ', 'joao ')
      .replace('sl ', 'salmos ')
      .replace('fp ', 'filipenses ')
      .replace('rm ', 'romanos ')
      .replace('1co ', '1 corintios ');

    for (let key in this.passages) {
      if (q.startsWith(key) || key.startsWith(q)) {
        return this.passages[key];
      }
    }

    // Default fallback to João 3
    return this.passages['joao 3'];
  }
}

window.bibleService = new BibleService();
