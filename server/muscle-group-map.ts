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

/** Correções pontuais para classificações inconsistentes do fornecedor. */
export const exerciseGroupOverrides: Record<string, string> = {
  exr_41n2huf7mAC2rhfC: 'Quadríceps', // Agachamento com salto com halteres
  exr_41n2hGRSg9WCoTYT: 'Quadríceps', // Agachamento pistol com salto
  exr_41n2haNJ3NA8yCE2: 'Peito', // Supino inclinado unilateral com halter
  exr_41n2hGioS8HumEF7: 'Bíceps', // Rosca martelo
  exr_41n2hgCHNgtVLHna: 'Bíceps', // Rosca martelo cruzada
};

export function standardMuscleGroup(value: string) {
  return muscleGroupMap[value.toUpperCase()] || 'Outros';
}

const bodyPartGroup: Record<string, string> = {
  BACK: 'Costas',
  BICEPS: 'Bíceps',
  CALVES: 'Panturrilhas',
  CHEST: 'Peito',
  FOREARMS: 'Antebraços',
  'FULL BODY': 'Corpo inteiro',
  HAMSTRINGS: 'Posteriores de coxa',
  NECK: 'Pescoço',
  QUADRICEPS: 'Quadríceps',
  SHOULDERS: 'Ombros',
  TRICEPS: 'Tríceps',
  WAIST: 'Abdômen',
};

export function primaryMuscleGroup(
  bodyParts: string[],
  targetMuscles: string[],
  externalId?: string,
) {
  if (externalId && exerciseGroupOverrides[externalId]) return exerciseGroupOverrides[externalId];
  const bodyPart = bodyParts[0]?.toUpperCase();
  return bodyPartGroup[bodyPart] || standardMuscleGroup(targetMuscles[0] || '');
}
