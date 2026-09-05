-- Fixed pt-BR catalogue supplied for the first GymLog release.
-- Re-running this seed is safe. Previous catalogue rows are archived to preserve history.

CREATE TEMP TABLE fixed_exercise_seed (
  external_id text PRIMARY KEY, name text NOT NULL, equipment_slug text NOT NULL,
  muscle_slug text NOT NULL, tracking_mode text NOT NULL, load_mode text NOT NULL,
  load_convention text NOT NULL
) ON COMMIT DROP;

INSERT INTO fixed_exercise_seed VALUES
  ('supino-reto-com-barra','Supino reto com barra','barra','peito','reps','external','total'),
  ('supino-inclinado-com-barra','Supino inclinado com barra','barra','peito','reps','external','total'),
  ('supino-declinado-com-barra','Supino declinado com barra','barra','peito','reps','external','total'),
  ('supino-reto-com-halteres','Supino reto com halteres','halteres','peito','reps','external','per_hand'),
  ('supino-inclinado-com-halteres','Supino inclinado com halteres','halteres','peito','reps','external','per_hand'),
  ('crucifixo-reto-com-halteres','Crucifixo reto com halteres','halteres','peito','reps','external','per_hand'),
  ('crucifixo-inclinado-com-halteres','Crucifixo inclinado com halteres','halteres','peito','reps','external','per_hand'),
  ('peck-deck','Peck deck','maquina','peito','reps','external','machine'),
  ('chest-press','Chest press','maquina','peito','reps','external','machine'),
  ('crossover-na-polia-alta','Crossover na polia alta','polia','peito','reps','external','machine'),
  ('crossover-na-polia-media','Crossover na polia média','polia','peito','reps','external','machine'),
  ('crossover-na-polia-baixa','Crossover na polia baixa','polia','peito','reps','external','machine'),
  ('flexao-de-bracos','Flexão de braços','sem-equipamento','peito','reps','bodyweight','added'),
  ('puxada-alta-aberta','Puxada alta aberta','polia','costas','reps','external','machine'),
  ('puxada-alta-fechada','Puxada alta fechada','polia','costas','reps','external','machine'),
  ('puxada-alta-pegada-neutra','Puxada alta pegada neutra','polia','costas','reps','external','machine'),
  ('puxada-alta-supinada','Puxada alta supinada','polia','costas','reps','external','machine'),
  ('remada-baixa-com-triangulo','Remada baixa com triângulo','polia','costas','reps','external','machine'),
  ('remada-baixa-aberta','Remada baixa aberta','polia','costas','reps','external','machine'),
  ('remada-curvada-com-barra','Remada curvada com barra','barra','costas','reps','external','total'),
  ('remada-unilateral-com-halter','Remada unilateral com halter','halteres','costas','reps','external','per_hand'),
  ('remada-cavalinho','Remada cavalinho','barra','costas','reps','external','total'),
  ('remada-articulada','Remada articulada','maquina','costas','reps','external','machine'),
  ('remada-maquina-pegada-neutra','Remada máquina pegada neutra','maquina','costas','reps','external','machine'),
  ('pulldown-com-bracos-estendidos','Pulldown com braços estendidos','polia','costas','reps','external','machine'),
  ('pullover-com-halter','Pullover com halter','halteres','costas','reps','external','per_hand'),
  ('barra-fixa-pronada','Barra fixa pronada','sem-equipamento','costas','reps','bodyweight','added'),
  ('barra-fixa-supinada','Barra fixa supinada','sem-equipamento','costas','reps','bodyweight','added'),
  ('desenvolvimento-militar-com-barra','Desenvolvimento militar com barra','barra','ombros','reps','external','total'),
  ('desenvolvimento-com-halteres','Desenvolvimento com halteres','halteres','ombros','reps','external','per_hand'),
  ('desenvolvimento-na-maquina','Desenvolvimento na máquina','maquina','ombros','reps','external','machine'),
  ('elevacao-lateral-com-halteres','Elevação lateral com halteres','halteres','ombros','reps','external','per_hand'),
  ('elevacao-lateral-na-polia','Elevação lateral na polia','polia','ombros','reps','external','machine'),
  ('elevacao-lateral-na-maquina','Elevação lateral na máquina','maquina','ombros','reps','external','machine'),
  ('elevacao-frontal-com-halteres','Elevação frontal com halteres','halteres','ombros','reps','external','per_hand'),
  ('elevacao-frontal-com-barra','Elevação frontal com barra','barra','ombros','reps','external','total'),
  ('crucifixo-inverso','Crucifixo inverso','maquina','ombros','reps','external','machine'),
  ('crucifixo-inverso-com-halteres','Crucifixo inverso com halteres','halteres','ombros','reps','external','per_hand'),
  ('face-pull','Face pull','polia','ombros','reps','external','machine'),
  ('remada-alta-com-barra','Remada alta com barra','barra','ombros','reps','external','total'),
  ('rosca-direta-com-barra','Rosca direta com barra','barra','biceps','reps','external','total'),
  ('rosca-direta-com-halteres','Rosca direta com halteres','halteres','biceps','reps','external','per_hand'),
  ('rosca-alternada','Rosca alternada','halteres','biceps','reps','external','per_hand'),
  ('rosca-martelo','Rosca martelo','halteres','biceps','reps','external','per_hand'),
  ('rosca-concentrada','Rosca concentrada','halteres','biceps','reps','external','per_hand'),
  ('rosca-scott-com-barra','Rosca Scott com barra','barra','biceps','reps','external','total'),
  ('rosca-scott-na-maquina','Rosca Scott na máquina','maquina','biceps','reps','external','machine'),
  ('rosca-direta-na-polia','Rosca direta na polia','polia','biceps','reps','external','machine'),
  ('rosca-martelo-na-polia-com-corda','Rosca martelo na polia com corda','polia','biceps','reps','external','machine'),
  ('rosca-inclinada-com-halteres','Rosca inclinada com halteres','halteres','biceps','reps','external','per_hand'),
  ('triceps-na-polia-com-corda','Tríceps na polia com corda','polia','triceps','reps','external','machine'),
  ('triceps-na-polia-com-barra','Tríceps na polia com barra','polia','triceps','reps','external','machine'),
  ('triceps-frances-com-halter','Tríceps francês com halter','halteres','triceps','reps','external','per_hand'),
  ('triceps-frances-unilateral','Tríceps francês unilateral','halteres','triceps','reps','external','per_hand'),
  ('triceps-testa-com-barra','Tríceps testa com barra','barra','triceps','reps','external','total'),
  ('triceps-testa-com-halteres','Tríceps testa com halteres','halteres','triceps','reps','external','per_hand'),
  ('triceps-coice','Tríceps coice','halteres','triceps','reps','external','per_hand'),
  ('triceps-unilateral-na-polia','Tríceps unilateral na polia','polia','triceps','reps','external','machine'),
  ('supino-fechado','Supino fechado','barra','triceps','reps','external','total'),
  ('mergulho-nas-paralelas','Mergulho nas paralelas','sem-equipamento','triceps','reps','bodyweight','added'),
  ('agachamento-livre-com-barra','Agachamento livre com barra','barra','quadriceps','reps','external','total'),
  ('agachamento-frontal','Agachamento frontal','barra','quadriceps','reps','external','total'),
  ('agachamento-goblet','Agachamento goblet','halteres','quadriceps','reps','external','per_hand'),
  ('agachamento-no-smith','Agachamento no Smith','maquina','quadriceps','reps','external','machine'),
  ('hack-squat','Hack squat','maquina','quadriceps','reps','external','machine'),
  ('leg-press-45','Leg press 45°','maquina','quadriceps','reps','external','machine'),
  ('leg-press-horizontal','Leg press horizontal','maquina','quadriceps','reps','external','machine'),
  ('cadeira-extensora','Cadeira extensora','maquina','quadriceps','reps','external','machine'),
  ('afundo-com-halteres','Afundo com halteres','halteres','quadriceps','reps','external','per_hand'),
  ('passada-com-halteres','Passada com halteres','halteres','quadriceps','reps','external','per_hand'),
  ('agachamento-bulgaro','Agachamento búlgaro','halteres','quadriceps','reps','external','per_hand'),
  ('step-up','Step-up','halteres','quadriceps','reps','external','per_hand'),
  ('stiff-com-barra','Stiff com barra','barra','posteriores','reps','external','total'),
  ('stiff-com-halteres','Stiff com halteres','halteres','posteriores','reps','external','per_hand'),
  ('levantamento-terra-romeno','Levantamento terra romeno','barra','posteriores','reps','external','total'),
  ('mesa-flexora','Mesa flexora','maquina','posteriores','reps','external','machine'),
  ('cadeira-flexora','Cadeira flexora','maquina','posteriores','reps','external','machine'),
  ('flexora-em-pe-unilateral','Flexora em pé unilateral','maquina','posteriores','reps','external','machine'),
  ('flexora-unilateral-deitada','Flexora unilateral deitada','maquina','posteriores','reps','external','machine'),
  ('good-morning','Good morning','barra','posteriores','reps','external','total'),
  ('elevacao-pelvica-com-barra','Elevação pélvica com barra','barra','gluteos','reps','external','total'),
  ('elevacao-pelvica-na-maquina','Elevação pélvica na máquina','maquina','gluteos','reps','external','machine'),
  ('glute-bridge','Glute bridge','sem-equipamento','gluteos','reps','bodyweight','added'),
  ('coice-na-polia','Coice na polia','polia','gluteos','reps','external','machine'),
  ('gluteo-na-maquina','Glúteo na máquina','maquina','gluteos','reps','external','machine'),
  ('cadeira-abdutora','Cadeira abdutora','maquina','gluteos','reps','external','machine'),
  ('abducao-de-quadril-na-polia','Abdução de quadril na polia','polia','gluteos','reps','external','machine'),
  ('agachamento-sumo-com-halter','Agachamento sumô com halter','halteres','gluteos','reps','external','per_hand'),
  ('agachamento-sumo-com-barra','Agachamento sumô com barra','barra','gluteos','reps','external','total'),
  ('panturrilha-em-pe-na-maquina','Panturrilha em pé na máquina','maquina','panturrilhas','reps','external','machine'),
  ('panturrilha-sentada','Panturrilha sentada','maquina','panturrilhas','reps','external','machine'),
  ('panturrilha-no-leg-press','Panturrilha no leg press','maquina','panturrilhas','reps','external','machine'),
  ('panturrilha-em-pe-com-halteres','Panturrilha em pé com halteres','halteres','panturrilhas','reps','external','per_hand'),
  ('panturrilha-unilateral','Panturrilha unilateral','sem-equipamento','panturrilhas','reps','bodyweight','added'),
  ('abdominal-crunch','Abdominal crunch','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('abdominal-na-maquina','Abdominal na máquina','maquina','abdomen','reps','external','machine'),
  ('abdominal-na-polia','Abdominal na polia','polia','abdomen','reps','external','machine'),
  ('prancha','Prancha','sem-equipamento','abdomen','duration','bodyweight','added'),
  ('prancha-lateral','Prancha lateral','sem-equipamento','abdomen','duration','bodyweight','added'),
  ('elevacao-de-pernas','Elevação de pernas','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('elevacao-de-joelhos-na-barra','Elevação de joelhos na barra','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('abdominal-bicicleta','Abdominal bicicleta','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('russian-twist','Russian twist','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('dead-bug','Dead bug','sem-equipamento','abdomen','reps','bodyweight','added'),
  ('levantamento-terra-convencional','Levantamento terra convencional','barra','corpo-inteiro','reps','external','total'),
  ('levantamento-terra-sumo','Levantamento terra sumô','barra','corpo-inteiro','reps','external','total'),
  ('farmer-s-walk','Farmer''s walk','halteres','corpo-inteiro','reps','external','per_hand');

INSERT INTO public.muscle_groups(slug,name)
SELECT DISTINCT muscle_slug, CASE muscle_slug
  WHEN 'peito' THEN 'Peito' WHEN 'costas' THEN 'Costas' WHEN 'ombros' THEN 'Ombros'
  WHEN 'biceps' THEN 'Bíceps' WHEN 'triceps' THEN 'Tríceps'
  WHEN 'quadriceps' THEN 'Quadríceps' WHEN 'posteriores' THEN 'Posteriores de coxa'
  WHEN 'gluteos' THEN 'Glúteos' WHEN 'panturrilhas' THEN 'Panturrilhas'
  WHEN 'abdomen' THEN 'Abdômen' WHEN 'corpo-inteiro' THEN 'Corpo inteiro' END
FROM fixed_exercise_seed ON CONFLICT(slug) DO NOTHING;

INSERT INTO public.equipment(slug,name)
SELECT DISTINCT equipment_slug, CASE equipment_slug
  WHEN 'barra' THEN 'Barra' WHEN 'halteres' THEN 'Halteres' WHEN 'maquina' THEN 'Máquina'
  WHEN 'polia' THEN 'Polia' WHEN 'sem-equipamento' THEN 'Sem equipamento' END
FROM fixed_exercise_seed ON CONFLICT(slug) DO NOTHING;

UPDATE public.exercises SET archived_at=now()
WHERE archived_at IS NULL AND (provider IS DISTINCT FROM 'fixed' OR slug NOT IN (SELECT 'fixed-'||external_id FROM fixed_exercise_seed));

INSERT INTO public.exercises(
  slug,name,equipment_id,tracking_mode,load_mode,load_convention,provider,external_id,archived_at
)
SELECT 'fixed-'||s.external_id,s.name,e.id,s.tracking_mode,s.load_mode,s.load_convention,
  'fixed',NULL,NULL
FROM fixed_exercise_seed s JOIN public.equipment e ON e.slug=s.equipment_slug
ON CONFLICT(slug)
DO UPDATE SET name=excluded.name,equipment_id=excluded.equipment_id,provider='fixed',external_id=NULL,archived_at=NULL;

DELETE FROM public.exercise_muscles em USING public.exercises e
WHERE em.exercise_id=e.id AND e.provider='fixed';

INSERT INTO public.exercise_muscles(exercise_id,muscle_group_id,role)
SELECT e.id,m.id,'primary'
FROM fixed_exercise_seed s
JOIN public.exercises e ON e.slug='fixed-'||s.external_id
JOIN public.muscle_groups m ON m.slug=s.muscle_slug;


