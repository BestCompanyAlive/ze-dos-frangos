import { Page } from '@playwright/test';

export async function clearStorage(page: Page) {
  await page.evaluate(() => localStorage.clear());
}

export async function setupSugestaoMes(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('sugestaoMes', JSON.stringify({
      mes: 'Julho',
      nome: 'Cabrito Assado',
      preco: '13.50',
      desc: 'Cabrito assado lentamente com ervas aromáticas.',
      foto: '',
    }));
  });
}

export async function setupVinhoMes(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('vinhoMes', JSON.stringify({
      mes: 'Julho',
      nome: 'Quinta de Ventozelo Tinto',
      preco: '18.00',
      desc: 'Vinho tinto regional com notas de frutos vermelhos.',
      foto: '',
    }));
  });
}

export async function setupMaisVendidos(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('maisVendidos', JSON.stringify({
      carne: [
        { nome: 'Frango no Churrasco', preco: '9.50', foto: null },
        { nome: 'Entrecosto Grelhado', preco: '12.00', foto: null },
        { nome: 'Costeleta de Porco', preco: '10.50', foto: null },
      ],
      peixe: [
        { nome: 'Dourada Grelhada', preco: '11.00', foto: null },
        { nome: 'Robalo no Sal', preco: '13.50', foto: null },
        { nome: 'Bacalhau à Brasa', preco: '12.50', foto: null },
      ],
    }));
  });
}

export async function setupEvento(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('eventos', JSON.stringify([{
      titulo: 'Jantar de Natal',
      dataInicio: '2026-12-20',
      dataFim: '2026-12-25',
      desc: 'Celebre o Natal connosco com um menu especial de época.',
      foto: '',
    }]));
  });
}

export async function setupMenuGrupos(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('menuGrupos', JSON.stringify([{
      nome: 'Menu Executivo',
      desc: 'Ideal para grupos com paladar distinto.',
      preco: '18',
      minPessoas: '10',
      entradas: 'Chouriço Assado\nAzeitonas',
      pratos: 'Frango no Churrasco\nEntrecosto',
      bebidas: 'Água, Vinho da Casa',
      sobremesas: 'Arroz Doce',
    }]));
  });
}

export async function setupVaga(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('vagasEmprego', JSON.stringify([{
      titulo: 'Empregado de Mesa',
      local: 'Vila Real',
      procura: 'Experiência mínima de 1 ano\nDisponibilidade total',
      oferece: 'Ordenado competitivo\nFormação contínua',
      urgente: false,
      ativa: true,
    }]));
  });
}

export async function setupEmenta(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('menuData', JSON.stringify({
      entradas: [
        { nome: 'Chouriço Especial da Casa', desc: '', preco: '4,50' },
        { nome: 'Tábua de Enchidos', desc: 'Seleção da casa', preco: '13,50' },
      ],
      carnes: [
        { nome: 'Frango no Churrasco', desc: 'Meio frango grelhado no carvão', preco: '9,50' },
        { nome: 'Entrecosto Grelhado', desc: '', preco: '12,00' },
      ],
      peixe: [
        { nome: 'Dourada Grelhada', desc: '', preco: '11,00' },
      ],
      sobremesas: [
        { nome: 'Arroz Doce', desc: '', preco: '2,50' },
      ],
    }));
  });
}

// A entrada "Reservas" está escondida na sidebar enquanto as reservas online
// não estiverem activas (ver src/pages/reservas.astro). O painel continua a
// existir e a funcionar — revelamos a entrada para poder chegar-lhe.
export async function abrirPainelReservas(page: Page) {
  await page.evaluate(() => {
    const nav = document.getElementById('nav-reservas');
    if (nav) nav.style.display = '';
  });
  await page.locator('#nav-reservas').click();
}

export async function injectReserva(page: Page, overrides: Record<string, unknown> = {}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  await page.evaluate(({ date, overrides }) => {
    const reserva = {
      id: 9001,
      nome: 'João Teste',
      email: 'joao@teste.pt',
      telefone: '912000000',
      date,
      hora: '12:30',
      pessoas: '2',
      status: 'pendente',
      ...overrides,
    };
    localStorage.setItem('reservas', JSON.stringify([reserva]));
  }, { date: tomorrow.toISOString().split('T')[0], overrides });
}
