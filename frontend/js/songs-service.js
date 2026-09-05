/**
 * SLIDECONTROL V3 — SONGS & REPERTOIRE SERVICE
 * Manages hymns, worship songs, strophes and quick chord/chorus navigation
 */

class SongsService {
  constructor() {
    this.songs = [
      {
        id: 'porque-ele-vive',
        title: 'Porque Ele Vive',
        author: 'Harpa Cristã / Bill Gaither',
        strophes: [
          { tag: 'E1', label: 'Estrofe 1', text: 'Deus enviou seu Filho amado\nPara morrer em meu lugar\nNa cruz pagou por meus pecados\nMas o sepulcro vazio está porque Ele vive' },
          { tag: 'CORO', label: 'Refrão', text: 'Porque Ele vive, eu posso crer no amanhã\nPorque Ele vive, temor não há\nMas eu bem sei, eu sei que a minha vida\nEstá nas mãos do meu Jesus, que vivo está' },
          { tag: 'E2', label: 'Estrofe 2', text: 'E quando, enfim, chegar a hora\nEm que a morte enfrentarei\nSem medo, então, terei vitória\nIrei nas glórias ver meu Jesus, que vivo está' },
          { tag: 'CORO', label: 'Refrão', text: 'Porque Ele vive, eu posso crer no amanhã\nPorque Ele vive, temor não há\nMas eu bem sei, eu sei que a minha vida\nEstá nas mãos do meu Jesus, que vivo está' }
        ]
      },
      {
        id: 'grandioso-es-tu',
        title: 'Grandioso És Tu',
        author: 'Stuart K. Hine',
        strophes: [
          { tag: 'E1', label: 'Estrofe 1', text: 'Senhor meu Deus, quando eu maravilhado\nFico a pensar nas obras de tuas mãos\nNo céu azul de estrelas pontilhado\nO teu poder mostrando a criação' },
          { tag: 'CORO', label: 'Refrão', text: 'Então minh’alma canta a ti, Senhor\nGrandioso és tu! Grandioso és tu!\nEntão minh’alma canta a ti, Senhor\nGrandioso és tu! Grandioso és tu!' },
          { tag: 'E2', label: 'Estrofe 2', text: 'Quando a vagar nas matas e florestas\nO ninho das aves ouço a cantar\nOlhando os montes, vejo as fontes frescas\nE sinto a brisa suave sussurrar' }
        ]
      },
      {
        id: 'ousado-amor',
        title: 'Ousado Amor',
        author: 'Cory Asbury / Isaias Saad',
        strophes: [
          { tag: 'E1', label: 'Estrofe 1', text: 'Antes de eu falar, tu cantavas sobre mim\nTu tens sido tão, tão bom pra mim\nAntes de eu respirar, sopraste tua vida em mim\nTu tens sido tão, tão bom pra mim' },
          { tag: 'CORO', label: 'Refrão', text: 'Oh, impressionante, infinito e ousado amor de Deus\nOh, que deixa as noventa e nove só pra me encontrar\nNão posso comprá-lo, nem merecê-lo\nMesmo assim se entregou\nOh, impressionante, infinito e ousado amor de Deus' },
          { tag: 'PONTE', label: 'Ponte', text: 'Traz luz para as sombras\nEscala montanhas pra me encontrar\nDerruba muralhas, destrói as mentiras pra me encontrar' }
        ]
      }
    ];

    this.currentSong = this.songs[0];
  }

  getSong(id) {
    return this.songs.find(s => s.id === id) || this.songs[0];
  }
}

window.songsService = new SongsService();
