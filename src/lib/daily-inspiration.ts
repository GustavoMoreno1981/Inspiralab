export type FamousQuote = {
  text: string;
  author: string;
};

export type PsalmVerse = {
  reference: string;
  text: string;
};

/** Frases célebres para abrir el resumen diario. */
export const FAMOUS_QUOTES: FamousQuote[] = [
  {
    text: "La excelencia no es un acto, sino un hábito.",
    author: "Aristóteles",
  },
  {
    text: "El secreto de salir adelante es empezar.",
    author: "Mark Twain",
  },
  {
    text: "No cuentes los días, haz que los días cuenten.",
    author: "Muhammad Ali",
  },
  {
    text: "La disciplina es el puente entre metas y logros.",
    author: "Jim Rohn",
  },
  {
    text: "Haz de cada día tu obra maestra.",
    author: "John Wooden",
  },
  {
    text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
    author: "Robert Collier",
  },
  {
    text: "La única forma de hacer un gran trabajo es amar lo que haces.",
    author: "Steve Jobs",
  },
  {
    text: "Cae siete veces y levántate ocho.",
    author: "Proverbio japonés",
  },
  {
    text: "Lo que no se comienza hoy, nunca se termina mañana.",
    author: "Johann Wolfgang von Goethe",
  },
  {
    text: "La calidad no es un acto, es un hábito.",
    author: "Aristóteles",
  },
  {
    text: "El futuro pertenece a quienes creen en la belleza de sus sueños.",
    author: "Eleanor Roosevelt",
  },
  {
    text: "No hay atajos hacia ningún lugar que valga la pena.",
    author: "Beverly Sills",
  },
  {
    text: "La perseverancia es fallar diecinueve veces y triunfar la vigésima.",
    author: "Julie Andrews",
  },
  {
    text: "Hazlo con pasión o no lo hagas.",
    author: "Rosa Nouchette Carey",
  },
  {
    text: "La mejor manera de predecir el futuro es creándolo.",
    author: "Peter Drucker",
  },
  {
    text: "Empieza donde estás. Usa lo que tienes. Haz lo que puedas.",
    author: "Arthur Ashe",
  },
  {
    text: "La grandeza no consiste en ser fuerte, sino en usar bien la fuerza.",
    author: "Henry Ward Beecher",
  },
  {
    text: "Nunca es demasiado tarde para ser lo que podrías haber sido.",
    author: "George Eliot",
  },
  {
    text: "El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración.",
    author: "Thomas Edison",
  },
  {
    text: "Si puedes soñarlo, puedes hacerlo.",
    author: "Walt Disney",
  },
  {
    text: "La vida es 10% lo que nos ocurre y 90% cómo reaccionamos ante ello.",
    author: "Charles R. Swindoll",
  },
  {
    text: "Sé el cambio que quieres ver en el mundo.",
    author: "Mahatma Gandhi",
  },
  {
    text: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.",
    author: "Nelson Mandela",
  },
  {
    text: "No hay viento favorable para el que no sabe a dónde va.",
    author: "Séneca",
  },
  {
    text: "El trabajo duro supera al talento cuando el talento no trabaja duro.",
    author: "Tim Notke",
  },
  {
    text: "La oportunidad se disfraza de trabajo duro, por eso la mayoría no la reconoce.",
    author: "Ann Landers",
  },
  {
    text: "Actúa como si lo que haces marcará la diferencia. Lo hará.",
    author: "William James",
  },
  {
    text: "La constancia transforma lo ordinario en extraordinario.",
    author: "Tony Robbins",
  },
  {
    text: "Haz hoy lo que otros no quieren, haz mañana lo que otros no pueden.",
    author: "Jerry Rice",
  },
  {
    text: "La motivación te pone en marcha; el hábito te mantiene en el camino.",
    author: "Jim Ryun",
  },
];

/** Versículos de Salmos para cerrar el resumen diario. */
export const PSALM_VERSES: PsalmVerse[] = [
  {
    reference: "Salmo 23:1",
    text: "Jehová es mi pastor; nada me faltará.",
  },
  {
    reference: "Salmo 27:1",
    text: "Jehová es mi luz y mi salvación; ¿de quién temeré? Jehová es la fortaleza de mi vida; ¿de quién he de atemorizarme?",
  },
  {
    reference: "Salmo 37:5",
    text: "Encomienda a Jehová tu camino, y confía en él; y él hará.",
  },
  {
    reference: "Salmo 46:1",
    text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
  },
  {
    reference: "Salmo 51:10",
    text: "Crea en mí, oh Dios, un corazón limpio, y renueva un espíritu recto dentro de mí.",
  },
  {
    reference: "Salmo 55:22",
    text: "Echa sobre Jehová tu carga, y él te sustentará; no dejará jamás caer al justo.",
  },
  {
    reference: "Salmo 90:17",
    text: "Sea la luz de Jehová nuestro Dios sobre nosotros, y confirma la obra de nuestras manos.",
  },
  {
    reference: "Salmo 91:1-2",
    text: "El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente. Diré yo a Jehová: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.",
  },
  {
    reference: "Salmo 100:2",
    text: "Servid a Jehová con alegría; venid ante su presencia con regocijo.",
  },
  {
    reference: "Salmo 118:24",
    text: "Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.",
  },
  {
    reference: "Salmo 119:105",
    text: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino.",
  },
  {
    reference: "Salmo 121:1-2",
    text: "Alzaré mis ojos a los montes; ¿de dónde vendrá mi socorro? Mi socorro viene de Jehová, que hizo los cielos y la tierra.",
  },
  {
    reference: "Salmo 126:5",
    text: "Los que sembraron con lágrimas, con regocijo segarán.",
  },
  {
    reference: "Salmo 127:1",
    text: "Si Jehová no edificare la casa, en vano trabajan los que la edifican.",
  },
  {
    reference: "Salmo 133:1",
    text: "¡Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía!",
  },
  {
    reference: "Salmo 139:14",
    text: "Te alabaré; porque formidables, maravillosas son tus obras; estoy maravillado, y mi alma lo sabe muy bien.",
  },
  {
    reference: "Salmo 145:18",
    text: "Cercano está Jehová a todos los que le invocan, a todos los que le invocan de veras.",
  },
  {
    reference: "Salmo 16:11",
    text: "Me mostrarás la senda de la vida; en tu presencia hay plenitud de gozo; delicias a tu diestra para siempre.",
  },
  {
    reference: "Salmo 19:14",
    text: "Sean gratos los dichos de mi boca y la meditación de mi corazón delante de ti, oh Jehová, roca mía, y redentor mío.",
  },
  {
    reference: "Salmo 34:8",
    text: "Gustad, y ved que es bueno Jehová; dichoso el hombre que confía en él.",
  },
  {
    reference: "Salmo 37:4",
    text: "Deléitate asimismo en Jehová, y él te concederá las peticiones de tu corazón.",
  },
  {
    reference: "Salmo 40:1",
    text: "Pacientemente esperé a Jehová, y se inclinó a mí, y oyó mi clamor.",
  },
  {
    reference: "Salmo 62:5",
    text: "Alma mía, en Dios solamente reposa, porque de él es mi esperanza.",
  },
  {
    reference: "Salmo 73:26",
    text: "Mi carne y mi corazón desfallecen; mas la roca de mi corazón y mi porción es Dios para siempre.",
  },
  {
    reference: "Salmo 84:11",
    text: "Jehová Dios es sol y escudo; Jehová dará gracia y gloria; no quitará el bien a los que andan en integridad.",
  },
  {
    reference: "Salmo 86:5",
    text: "Porque tú, Señor, eres bueno y perdonador, y abundante en misericordia para con todos los que te invocan.",
  },
  {
    reference: "Salmo 103:1-2",
    text: "Bendice, alma mía, a Jehová, y bendiga todo mi ser su santo nombre. Bendice, alma mía, a Jehová, y no olvides ninguno de sus beneficios.",
  },
  {
    reference: "Salmo 112:7",
    text: "No tendrá temor de malas noticias; su corazón está firme, confiado en Jehová.",
  },
  {
    reference: "Salmo 143:8",
    text: "Hazme oír por la mañana tu misericordia, porque en ti he confiado; hazme saber el camino por donde ande, porque a ti he elevado mi alma.",
  },
  {
    reference: "Salmo 150:6",
    text: "Todo lo que respira alabe a JAH. Aleluya.",
  },
];

/** Misma frase/salmo durante el día; cambia al día siguiente. */
export function pickDailyQuote(date = new Date()): FamousQuote {
  const key =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return FAMOUS_QUOTES[Math.abs(key) % FAMOUS_QUOTES.length];
}

export function pickDailyPsalm(date = new Date()): PsalmVerse {
  const key =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate() +
    17;
  return PSALM_VERSES[Math.abs(key) % PSALM_VERSES.length];
}

export function formatQuoteLine(quote: FamousQuote) {
  return `_${quote.text}_ — ${quote.author}`;
}

export function formatPsalmLines(psalm: PsalmVerse): string[] {
  return [`*${psalm.reference}*`, `_${psalm.text}_`];
}
