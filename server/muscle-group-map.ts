/**
 * Lista editável dos grupos musculares do GymLog.
 *
 * A chave é o músculo recebido da API (em inglês ou já traduzido) e o valor é o
 * grupo curto exibido na busca. Para reclassificar um músculo, altere somente o
 * valor correspondente e execute `npm run catalog:sync`.
 * Exercícios sem músculo informado pela API usam o grupo `Corpo inteiro`.
 */
export const muscleGroupMap: Record<string, string> = {
  'ADDUCTOR BREVIS': 'Adutores',
  'ADDUCTOR LONGUS': 'Adutores',
  'ADDUCTOR MAGNUS': 'Adutores',
  GRACILIS: 'Adutores',
  PECTINEUS: 'Adutores',
  BRACHIALIS: 'Bíceps',
  BRACHIORADIALIS: 'Bíceps',
  'BICEPS BRACHII': 'Bíceps',
  'WRIST EXTENSORS': 'Antebraços',
  'WRIST FLEXORS': 'Antebraços',
  'PECTORALIS MAJOR CLAVICULAR HEAD': 'Peito',
  'PECTORALIS MAJOR STERNAL HEAD': 'Peito',
  'ANTERIOR DELTOID': 'Ombros',
  'LATERAL DELTOID': 'Ombros',
  'POSTERIOR DELTOID': 'Ombros',
  INFRASPINATUS: 'Ombros',
  SUBSCAPULARIS: 'Ombros',
  'TERES MINOR': 'Ombros',
  'ERECTOR SPINAE': 'Costas',
  'LATISSIMUS DORSI': 'Costas',
  'LEVATOR SCAPULAE': 'Costas',
  'TERES MAJOR': 'Costas',
  'TRAPEZIUS LOWER FIBERS': 'Costas',
  'TRAPEZIUS MIDDLE FIBERS': 'Costas',
  'TRAPEZIUS UPPER FIBERS': 'Costas',
  SPLENIUS: 'Pescoço',
  STERNOCLEIDOMASTOID: 'Pescoço',
  'GLUTEUS MAXIMUS': 'Glúteos',
  'GLUTEUS MEDIUS': 'Glúteos',
  'GLUTEUS MINIMUS': 'Glúteos',
  'DEEP HIP EXTERNAL ROTATORS': 'Glúteos',
  HAMSTRINGS: 'Posteriores de coxa',
  QUADRICEPS: 'Quadríceps',
  SARTORIUS: 'Quadríceps',
  GASTROCNEMIUS: 'Panturrilhas',
  SOLEUS: 'Panturrilhas',
  'TIBIALIS ANTERIOR': 'Panturrilhas',
  ILIOPSOAS: 'Abdômen',
  OBLIQUES: 'Abdômen',
  'RECTUS ABDOMINIS': 'Abdômen',
  'SERRATUS ANTE': 'Abdômen',
  'SERRATUS ANTERIOR': 'Abdômen',
  'TENSOR FASCIAE LATAE': 'Abdômen',
  'TRANSVERSUS ABDOMINIS': 'Abdômen',
  'TRICEPS BRACHII': 'Tríceps',
};

export function standardMuscleGroup(value: string) {
  return muscleGroupMap[value.toUpperCase()] || 'Outros';
}
