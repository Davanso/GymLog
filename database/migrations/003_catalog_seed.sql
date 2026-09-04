-- Initial taxonomy and named exercises only. No unlicensed media or invented URLs.
INSERT INTO public.muscle_groups(slug,name) VALUES
('peito','Peito'),('costas','Costas'),('ombros','Ombros'),('biceps','Bíceps'),
('triceps','Tríceps'),('quadriceps','Quadríceps'),('posteriores','Posteriores de coxa'),
('gluteos','Glúteos'),('panturrilhas','Panturrilhas'),('abdomen','Abdômen')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.equipment(slug,name) VALUES
('barra','Barra'),('halteres','Halteres'),('maquina','Máquina'),('polia','Polia'),
('elastico','Elástico'),('sem-equipamento','Sem equipamento')
ON CONFLICT (slug) DO NOTHING;

WITH seed(slug,name,equipment,tracking,load,convention) AS (VALUES
('supino-reto-barra','Supino reto com barra','barra','reps','external','total'),
('supino-reto-halteres','Supino reto com halteres','halteres','reps','external','per_hand'),
('remada-curvada-barra','Remada curvada com barra','barra','reps','external','total'),
('puxada-frontal-polia','Puxada frontal na polia','polia','reps','external','machine'),
('desenvolvimento-halteres','Desenvolvimento com halteres','halteres','reps','external','per_hand'),
('rosca-direta-barra','Rosca direta com barra','barra','reps','external','total'),
('triceps-polia','Tríceps na polia','polia','reps','external','machine'),
('agachamento-barra','Agachamento com barra','barra','reps','external','total'),
('cadeira-flexora','Cadeira flexora','maquina','reps','external','machine'),
('elevacao-panturrilha','Elevação de panturrilha sem equipamento','sem-equipamento','reps','bodyweight','added'),
('prancha','Prancha','sem-equipamento','duration','bodyweight','added'),
('barra-fixa-assistida','Barra fixa assistida na máquina','maquina','reps','assisted','assistance'))
INSERT INTO public.exercises(slug,name,equipment_id,tracking_mode,load_mode,load_convention)
SELECT s.slug,s.name,e.id,s.tracking,s.load,s.convention FROM seed s JOIN public.equipment e ON e.slug=s.equipment
ON CONFLICT (slug) DO NOTHING;

WITH seed(exercise,muscle,role) AS (VALUES
('supino-reto-barra','peito','primary'),('supino-reto-barra','triceps','secondary'),
('supino-reto-halteres','peito','primary'),('supino-reto-halteres','triceps','secondary'),
('remada-curvada-barra','costas','primary'),('remada-curvada-barra','biceps','secondary'),
('puxada-frontal-polia','costas','primary'),('puxada-frontal-polia','biceps','secondary'),
('desenvolvimento-halteres','ombros','primary'),('rosca-direta-barra','biceps','primary'),
('triceps-polia','triceps','primary'),('agachamento-barra','quadriceps','primary'),
('agachamento-barra','gluteos','secondary'),('cadeira-flexora','posteriores','primary'),
('elevacao-panturrilha','panturrilhas','primary'),('prancha','abdomen','primary'),
('barra-fixa-assistida','costas','primary'),('barra-fixa-assistida','biceps','secondary'))
INSERT INTO public.exercise_muscles(exercise_id,muscle_group_id,role)
SELECT e.id,m.id,s.role FROM seed s JOIN public.exercises e ON e.slug=s.exercise
JOIN public.muscle_groups m ON m.slug=s.muscle ON CONFLICT DO NOTHING;
