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

export const FAMOUS_QUOTES_EN: FamousQuote[] = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Don't count the days; make the days count.", author: "Muhammad Ali" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "What is not started today is never finished tomorrow.", author: "Johann Wolfgang von Goethe" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "There are no shortcuts to any place worth going.", author: "Beverly Sills" },
  { text: "Perseverance is failing nineteen times and succeeding the twentieth.", author: "Julie Andrews" },
  { text: "Do it with passion or not at all.", author: "Rosa Nouchette Carey" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Greatness is not found in strength, but in using strength well.", author: "Henry Ward Beecher" },
  { text: "It is never too late to be what you might have been.", author: "George Eliot" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "If you can dream it, you can do it.", author: "Walt Disney" },
  { text: "Life is 10% what happens to us and 90% how we react to it.", author: "Charles R. Swindoll" },
  { text: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
  { text: "No wind is favorable for the sailor who does not know where to go.", author: "Seneca" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Opportunity is missed by most people because it is dressed in overalls and looks like work.", author: "Ann Landers" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Consistency turns the ordinary into the extraordinary.", author: "Tony Robbins" },
  { text: "Do today what others won't, so tomorrow you can do what others can't.", author: "Jerry Rice" },
  { text: "Motivation gets you going; habit keeps you growing.", author: "Jim Ryun" },
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

export const PSALM_VERSES_EN: PsalmVerse[] = [
  { reference: "Psalm 23:1", text: "The Lord is my shepherd; I shall not want." },
  { reference: "Psalm 27:1", text: "The Lord is my light and my salvation; whom shall I fear?" },
  { reference: "Psalm 37:5", text: "Commit your way to the Lord; trust in him, and he will act." },
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { reference: "Psalm 51:10", text: "Create in me a clean heart, O God, and renew a right spirit within me." },
  { reference: "Psalm 55:22", text: "Cast your burden on the Lord, and he will sustain you." },
  { reference: "Psalm 90:17", text: "Let the favor of the Lord our God be upon us, and establish the work of our hands." },
  { reference: "Psalm 91:1-2", text: "He who dwells in the shelter of the Most High will abide in the shadow of the Almighty." },
  { reference: "Psalm 100:2", text: "Serve the Lord with gladness; come into his presence with singing." },
  { reference: "Psalm 118:24", text: "This is the day that the Lord has made; let us rejoice and be glad in it." },
  { reference: "Psalm 119:105", text: "Your word is a lamp to my feet and a light to my path." },
  { reference: "Psalm 121:1-2", text: "I lift up my eyes to the hills. From where does my help come? My help comes from the Lord." },
  { reference: "Psalm 127:1", text: "Unless the Lord builds the house, those who build it labor in vain." },
  { reference: "Psalm 130:5", text: "I wait for the Lord, my soul waits, and in his word I hope." },
  { reference: "Psalm 139:14", text: "I praise you, for I am fearfully and wonderfully made." },
  { reference: "Psalm 145:18", text: "The Lord is near to all who call on him, to all who call on him in truth." },
  { reference: "Psalm 16:8", text: "I have set the Lord always before me; because he is at my right hand, I shall not be shaken." },
  { reference: "Psalm 18:2", text: "The Lord is my rock and my fortress and my deliverer." },
  { reference: "Psalm 28:7", text: "The Lord is my strength and my shield; in him my heart trusts." },
  { reference: "Psalm 34:8", text: "Oh, taste and see that the Lord is good!" },
  { reference: "Psalm 40:1", text: "I waited patiently for the Lord; he inclined to me and heard my cry." },
  { reference: "Psalm 62:1", text: "For God alone my soul waits in silence; from him comes my salvation." },
  { reference: "Psalm 73:26", text: "My flesh and my heart may fail, but God is the strength of my heart and my portion forever." },
  { reference: "Psalm 84:11", text: "For the Lord God is a sun and shield; the Lord bestows favor and honor." },
  { reference: "Psalm 86:5", text: "For you, O Lord, are good and forgiving, abounding in steadfast love to all who call upon you." },
  { reference: "Psalm 103:1-2", text: "Bless the Lord, O my soul, and forget not all his benefits." },
  { reference: "Psalm 112:7", text: "He is not afraid of bad news; his heart is firm, trusting in the Lord." },
  { reference: "Psalm 143:8", text: "Let me hear in the morning of your steadfast love, for in you I trust." },
  { reference: "Psalm 150:6", text: "Let everything that has breath praise the Lord. Praise the Lord!" },
  { reference: "Psalm 23:4", text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me." },
];

/** Misma frase/salmo durante el día; cambia al día siguiente. */
export type InspirationLocale = "en" | "es";

export function pickDailyQuote(
  date = new Date(),
  locale: InspirationLocale = "es",
): FamousQuote {
  const quotes = locale === "en" ? FAMOUS_QUOTES_EN : FAMOUS_QUOTES;
  const key =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return quotes[Math.abs(key) % quotes.length];
}

export function pickDailyPsalm(
  date = new Date(),
  locale: InspirationLocale = "es",
): PsalmVerse {
  const verses = locale === "en" ? PSALM_VERSES_EN : PSALM_VERSES;
  const key =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate() +
    17;
  return verses[Math.abs(key) % verses.length];
}

export function formatQuoteLine(quote: FamousQuote) {
  return `_${quote.text}_ — ${quote.author}`;
}

export function formatPsalmLines(psalm: PsalmVerse): string[] {
  return [`*${psalm.reference}*`, `_${psalm.text}_`];
}
