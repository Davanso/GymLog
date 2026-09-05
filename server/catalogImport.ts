import { getDatabase } from './db.js';
import type { ProviderExercise } from './exerciseProvider.js';

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'outro';
const taxonomySlug = (value: string) =>
  value === 'Posteriores de coxa' ? 'posteriores' : slug(value);

type ExerciseDatabase = ReturnType<typeof getDatabase>;

export async function importExercise(
  item: ProviderExercise,
  sql: ExerciseDatabase = getDatabase(),
) {
  const equipmentName = item.equipments[0] || 'Sem equipamento';
  const primaryGroup = item.primaryMuscleGroup || item.targetMuscles[0] || 'Corpo inteiro';
  const secondaryGroups = [
    ...new Set([...item.targetMuscles.slice(1), ...item.secondaryMuscles]),
  ].filter((name) => name !== primaryGroup);
  const muscles = [primaryGroup, ...secondaryGroups];
  const bodyweight = /body|peso corporal/i.test(equipmentName);
  const exerciseSlug = `ascend-${slug(item.externalId)}`;
  const image = item.imageUrl || item.imageUrls['720p'] || item.imageUrls['480p'] || null;
  const media = [
    item.videoUrl && { kind: 'video', url: item.videoUrl, position: 1 },
    image && { kind: 'image', url: image, position: 2 },
  ].filter((value): value is { kind: string; url: string; position: number } => Boolean(value));
  await sql.transaction([
    sql`INSERT INTO equipment(slug,name) VALUES (${slug(equipmentName)},${equipmentName.slice(0, 120)}) ON CONFLICT(slug) DO NOTHING`,
    ...muscles.map(
      (name) =>
        sql`INSERT INTO muscle_groups(slug,name) VALUES (${taxonomySlug(name)},${name.slice(0, 120)}) ON CONFLICT(slug) DO NOTHING`,
    ),
    sql`INSERT INTO exercises(slug,name,description,instructions,equipment_id,tracking_mode,load_mode,load_convention,provider,external_id)
      VALUES (${exerciseSlug},${item.name.slice(0, 120)},${item.overview?.slice(0, 2000) || null},${item.instructions},
        (SELECT id FROM equipment WHERE slug=${slug(equipmentName)}),'reps',${bodyweight ? 'bodyweight' : 'external'},${bodyweight ? 'added' : 'total'},'ascendapi',${item.externalId})
      ON CONFLICT(provider,external_id) WHERE provider IS NOT NULL AND external_id IS NOT NULL
      DO UPDATE SET name=excluded.name,description=coalesce(excluded.description,exercises.description),
        instructions=CASE WHEN cardinality(excluded.instructions)>0 THEN excluded.instructions ELSE exercises.instructions END,
        equipment_id=excluded.equipment_id`,
    sql`DELETE FROM exercise_muscles WHERE exercise_id=(
      SELECT id FROM exercises WHERE provider='ascendapi' AND external_id=${item.externalId}
    )`,
    ...muscles.map(
      (name) =>
        sql`INSERT INTO exercise_muscles(exercise_id,muscle_group_id,role)
          SELECT e.id,m.id,${name === primaryGroup ? 'primary' : 'secondary'} FROM exercises e,muscle_groups m
          WHERE e.provider='ascendapi' AND e.external_id=${item.externalId} AND m.slug=${taxonomySlug(name)}
          ON CONFLICT(exercise_id,muscle_group_id) DO NOTHING`,
    ),
    ...media.map(
      ({ kind, url, position }) =>
        sql`MERGE INTO exercise_media target USING (
              SELECT id exercise_id FROM exercises WHERE provider='ascendapi' AND external_id=${item.externalId}
            ) source ON target.exercise_id=source.exercise_id AND target.position=${position}
            WHEN MATCHED THEN UPDATE SET kind=${kind},url=${url},alt_text=${`Execução de ${item.name}`}
            WHEN NOT MATCHED THEN INSERT(exercise_id,kind,url,alt_text,position,provider,external_id)
              VALUES(source.exercise_id,${kind},${url},${`Execução de ${item.name}`},${position},'ascendapi',${item.externalId})`,
    ),
  ]);
  const rows = await sql`
    SELECT e.id,e.name,q.name equipment,e.tracking_mode,e.load_mode,e.load_convention,e.external_id,
      (SELECT url FROM exercise_media WHERE exercise_id=e.id AND kind='image' ORDER BY position LIMIT 1) image_url,
      (SELECT url FROM exercise_media WHERE exercise_id=e.id AND kind='video' ORDER BY position LIMIT 1) video_url,
      ARRAY(SELECT m.name::text FROM exercise_muscles em JOIN muscle_groups m ON m.id=em.muscle_group_id
        WHERE em.exercise_id=e.id ORDER BY em.role,m.name) muscle_groups,
      ARRAY(SELECT m.name::text FROM exercise_muscles em JOIN muscle_groups m ON m.id=em.muscle_group_id
        WHERE em.exercise_id=e.id AND em.role='primary' ORDER BY m.name) primary_muscle_groups,
      ARRAY(SELECT m.name::text FROM exercise_muscles em JOIN muscle_groups m ON m.id=em.muscle_group_id
        WHERE em.exercise_id=e.id AND em.role='secondary' ORDER BY m.name) secondary_muscle_groups
    FROM exercises e JOIN equipment q ON q.id=e.equipment_id
    WHERE e.provider='ascendapi' AND e.external_id=${item.externalId}`;
  return rows[0];
}
