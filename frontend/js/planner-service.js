/**
 * SLIDECONTROL V3 — PLANNER SERVICE (LITURGIA DO CULTO)
 * Manages sequential worship service moments, auto-advancing the 3D Planner Ring
 */

class PlannerService {
  constructor() {
    this.steps = [
      {
        id: 'step-01',
        num: '01',
        name: 'Abertura & Boas-Vindas',
        type: 'general',
        targetNode: 'node_liturgia',
        slide: {
          header: 'CULTO DE CELEBRAÇÃO',
          text: 'Sejam todos bem-vindos à Casa do Senhor!',
          subtitle: 'Alegrei-me quando me disseram: Vamos à casa do Senhor. (Sl 122:1)',
          theme: 'general'
        }
      },
      {
        id: 'step-02',
        num: '02',
        name: 'Momento de Louvor',
        type: 'song',
        songId: 'porque-ele-vive',
        targetNode: 'node_louvor',
        slide: {
          header: 'PORQUE ELE VIVE — HARPA CRISTÃ',
          text: 'Deus enviou seu Filho amado\nPara morrer em meu lugar\nNa cruz pagou por meus pecados\nMas o sepulcro vazio está porque Ele vive',
          subtitle: 'Estrofe 1',
          theme: 'song'
        }
      },
      {
        id: 'step-03',
        num: '03',
        name: 'Momento de Oração',
        type: 'general',
        targetNode: 'node_liturgia',
        slide: {
          header: 'INTERCESSÃO E ORAÇÃO',
          text: 'Clama a mim, e responder-te-ei,\ne anunciar-te-ei coisas grandes e ocultas, que não sabes.\n(Jeremias 33:3)',
          subtitle: 'Oração pela Igreja e pelas Famílias',
          theme: 'general'
        }
      },
      {
        id: 'step-04',
        num: '04',
        name: 'Mensagem & Palavra Pastoral',
        type: 'bible',
        targetNode: 'node_biblia',
        passage: 'joao 3',
        slide: {
          header: '',
          text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.',
          subtitle: 'João 3:16 — ACF',
          reference: 'João 3:16 — ACF',
          caption: 'João 3:16 — ACF',
          theme: 'bible'
        }
      },
      {
        id: 'step-05',
        num: '05',
        name: 'Avisos da Semana & Dízimos',
        type: 'general',
        targetNode: 'node_alertas',
        slide: {
          header: 'AVISOS DA SEMANA',
          text: '• Reunião de Oração: Terça-feira às 19h30\n• Ensaio do Louvor: Sábado às 16h\n• Escola Bíblica Dominical: Domingo às 9h',
          subtitle: 'Participe das nossas programações semanais',
          theme: 'general'
        }
      },
      {
        id: 'step-06',
        num: '06',
        name: 'Bênção & Encerramento',
        type: 'song',
        songId: 'ousado-amor',
        targetNode: 'node_louvor',
        slide: {
          header: 'BÊNÇÃO APOSTÓLICA',
          text: 'A graça de nosso Senhor Jesus Cristo,\no amor de Deus e a comunhão do Espírito Santo\nsejam com todos nós. Amém!',
          subtitle: 'Ide em paz e servi ao Senhor com alegria',
          theme: 'general'
        }
      }
    ];

    this.currentIndex = 0;
  }

  getCurrentStep() {
    return this.steps[this.currentIndex];
  }

  nextStep() {
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0; // Loop back
    }
    return this.getCurrentStep();
  }

  setStep(index) {
    if (index >= 0 && index < this.steps.length) {
      this.currentIndex = index;
    }
    return this.getCurrentStep();
  }
}

window.plannerService = new PlannerService();
