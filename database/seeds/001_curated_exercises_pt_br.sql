-- =========================================================
-- 1. GRUPOS MUSCULARES
-- =========================================================

INSERT INTO public.muscle_groups(slug,name) VALUES

('peito','Peito'),
('costas','Costas'),
('ombros','Ombros'),
('biceps','Bíceps'),
('triceps','Tríceps'),
('antebracos','Antebraços'),

('quadriceps','Quadríceps'),
('posteriores','Posteriores de coxa'),
('gluteos','Glúteos'),
('adutores','Adutores'),
('panturrilhas','Panturrilhas'),

('abdomen','Abdômen'),
('pescoco','Pescoço')

ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 2. EQUIPAMENTOS
-- =========================================================

INSERT INTO public.equipment(slug,name) VALUES

('barra','Barra'),
('halteres','Halteres'),
('maquina','Máquina'),
('polia','Polia'),
('elastico','Elástico'),
('sem-equipamento','Sem equipamento')

ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 3. EXERCÍCIOS
-- =========================================================

WITH seed(slug,name,equipment,tracking,load,convention) AS (VALUES

-- PEITO
('supino-reto-barra',
 'Supino reto com barra',
 'barra','reps','external','total'),

('supino-reto-halteres',
 'Supino reto com halteres',
 'halteres','reps','external','per_hand'),

('supino-inclinado-barra',
 'Supino inclinado com barra',
 'barra','reps','external','total'),

('supino-inclinado-halteres',
 'Supino inclinado com halteres',
 'halteres','reps','external','per_hand'),

('crucifixo-halteres',
 'Crucifixo com halteres',
 'halteres','reps','external','per_hand'),

('peck-deck',
 'Peck deck',
 'maquina','reps','external','machine'),

('crossover-polia',
 'Crossover na polia',
 'polia','reps','external','machine'),


-- COSTAS
('remada-curvada-barra',
 'Remada curvada com barra',
 'barra','reps','external','total'),

('remada-unilateral-halter',
 'Remada unilateral com halter',
 'halteres','reps','external','per_hand'),

('remada-baixa-polia',
 'Remada baixa na polia',
 'polia','reps','external','machine'),

('puxada-frontal-polia',
 'Puxada frontal na polia',
 'polia','reps','external','machine'),

('pulldown-polia',
 'Pulldown na polia',
 'polia','reps','external','machine'),

('barra-fixa',
 'Barra fixa',
 'sem-equipamento','reps','bodyweight','added'),

('barra-fixa-assistida',
 'Barra fixa assistida na máquina',
 'maquina','reps','assisted','assistance'),


-- OMBROS
('desenvolvimento-halteres',
 'Desenvolvimento com halteres',
 'halteres','reps','external','per_hand'),

('desenvolvimento-maquina',
 'Desenvolvimento na máquina',
 'maquina','reps','external','machine'),

('elevacao-lateral-halteres',
 'Elevação lateral com halteres',
 'halteres','reps','external','per_hand'),

('elevacao-frontal-halteres',
 'Elevação frontal com halteres',
 'halteres','reps','external','per_hand'),

('crucifixo-inverso',
 'Crucifixo inverso',
 'maquina','reps','external','machine'),

('face-pull',
 'Face pull',
 'polia','reps','external','machine'),


-- BÍCEPS
('rosca-direta-barra',
 'Rosca direta com barra',
 'barra','reps','external','total'),

('rosca-direta-halteres',
 'Rosca direta com halteres',
 'halteres','reps','external','per_hand'),

('rosca-alternada',
 'Rosca alternada com halteres',
 'halteres','reps','external','per_hand'),

('rosca-martelo',
 'Rosca martelo',
 'halteres','reps','external','per_hand'),

('rosca-scott-maquina',
 'Rosca Scott na máquina',
 'maquina','reps','external','machine'),

('rosca-polia',
 'Rosca na polia',
 'polia','reps','external','machine'),


-- TRÍCEPS
('triceps-polia',
 'Tríceps na polia',
 'polia','reps','external','machine'),

('triceps-corda',
 'Tríceps corda',
 'polia','reps','external','machine'),

('triceps-frances-halter',
 'Tríceps francês com halter',
 'halteres','reps','external','total'),

('triceps-testa-barra',
 'Tríceps testa com barra',
 'barra','reps','external','total'),

('triceps-mergulho',
 'Mergulho para tríceps',
 'sem-equipamento','reps','bodyweight','added'),


-- QUADRÍCEPS
('agachamento-barra',
 'Agachamento com barra',
 'barra','reps','external','total'),

('agachamento-smith',
 'Agachamento no Smith',
 'maquina','reps','external','machine'),

('agachamento-goblet',
 'Agachamento Goblet',
 'halteres','reps','external','total'),

('leg-press',
 'Leg press',
 'maquina','reps','external','machine'),

('cadeira-extensora',
 'Cadeira extensora',
 'maquina','reps','external','machine'),

('afundo-halteres',
 'Afundo com halteres',
 'halteres','reps','external','per_hand'),

('passada-halteres',
 'Passada com halteres',
 'halteres','reps','external','per_hand'),


-- POSTERIORES
('cadeira-flexora',
 'Cadeira flexora',
 'maquina','reps','external','machine'),

('mesa-flexora',
 'Mesa flexora',
 'maquina','reps','external','machine'),

('flexora-unilateral',
 'Flexora unilateral em pé',
 'maquina','reps','external','machine'),

('stiff-barra',
 'Stiff com barra',
 'barra','reps','external','total'),

('stiff-halteres',
 'Stiff com halteres',
 'halteres','reps','external','per_hand'),

('stiff-unilateral',
 'Stiff unilateral com halter',
 'halteres','reps','external','total'),


-- GLÚTEOS
('elevacao-pelvica-barra',
 'Elevação pélvica com barra',
 'barra','reps','external','total'),

('elevacao-pelvica-maquina',
 'Elevação pélvica na máquina',
 'maquina','reps','external','machine'),

('gluteo-polia',
 'Extensão de quadril na polia',
 'polia','reps','external','machine'),

('abducao-polia',
 'Abdução de quadril na polia',
 'polia','reps','external','machine'),

('cadeira-abdutora',
 'Cadeira abdutora',
 'maquina','reps','external','machine'),


-- ADUTORES
('cadeira-adutora',
 'Cadeira adutora',
 'maquina','reps','external','machine'),

('aducao-polia',
 'Adução de quadril na polia',
 'polia','reps','external','machine'),


-- PANTURRILHA
('panturrilha-em-pe-maquina',
 'Panturrilha em pé na máquina',
 'maquina','reps','external','machine'),

('panturrilha-sentada',
 'Panturrilha sentada',
 'maquina','reps','external','machine'),

('panturrilha-leg-press',
 'Panturrilha no leg press',
 'maquina','reps','external','machine'),

('elevacao-panturrilha',
 'Elevação de panturrilha sem equipamento',
 'sem-equipamento','reps','bodyweight','added'),


-- ABDÔMEN
('prancha',
 'Prancha',
 'sem-equipamento','duration','bodyweight','added'),

('prancha-lateral',
 'Prancha lateral',
 'sem-equipamento','duration','bodyweight','added'),

('abdominal-crunch',
 'Abdominal crunch',
 'sem-equipamento','reps','bodyweight','added'),

('abdominal-infra',
 'Abdominal infra',
 'sem-equipamento','reps','bodyweight','added'),

('abdominal-polia',
 'Abdominal na polia',
 'polia','reps','external','machine')

)

INSERT INTO public.exercises(
    slug,
    name,
    equipment_id,
    tracking_mode,
    load_mode,
    load_convention
)

SELECT
    s.slug,
    s.name,
    e.id,
    s.tracking,
    s.load,
    s.convention

FROM seed s

JOIN public.equipment e
    ON e.slug = s.equipment

ON CONFLICT (slug) DO NOTHING;


-- =========================================================
-- 4. RELAÇÃO EXERCÍCIO -> GRUPO MUSCULAR
-- =========================================================

WITH seed(exercise,muscle,role) AS (VALUES

-- PEITO
('supino-reto-barra','peito','primary'),
('supino-reto-barra','triceps','secondary'),
('supino-reto-barra','ombros','secondary'),

('supino-reto-halteres','peito','primary'),
('supino-reto-halteres','triceps','secondary'),
('supino-reto-halteres','ombros','secondary'),

('supino-inclinado-barra','peito','primary'),
('supino-inclinado-barra','triceps','secondary'),
('supino-inclinado-barra','ombros','secondary'),

('supino-inclinado-halteres','peito','primary'),
('supino-inclinado-halteres','triceps','secondary'),
('supino-inclinado-halteres','ombros','secondary'),

('crucifixo-halteres','peito','primary'),

('peck-deck','peito','primary'),

('crossover-polia','peito','primary'),


-- COSTAS
('remada-curvada-barra','costas','primary'),
('remada-curvada-barra','biceps','secondary'),

('remada-unilateral-halter','costas','primary'),
('remada-unilateral-halter','biceps','secondary'),

('remada-baixa-polia','costas','primary'),
('remada-baixa-polia','biceps','secondary'),

('puxada-frontal-polia','costas','primary'),
('puxada-frontal-polia','biceps','secondary'),

('pulldown-polia','costas','primary'),

('barra-fixa','costas','primary'),
('barra-fixa','biceps','secondary'),

('barra-fixa-assistida','costas','primary'),
('barra-fixa-assistida','biceps','secondary'),


-- OMBROS
('desenvolvimento-halteres','ombros','primary'),
('desenvolvimento-halteres','triceps','secondary'),

('desenvolvimento-maquina','ombros','primary'),
('desenvolvimento-maquina','triceps','secondary'),

('elevacao-lateral-halteres','ombros','primary'),
('elevacao-frontal-halteres','ombros','primary'),
('crucifixo-inverso','ombros','primary'),

('face-pull','ombros','primary'),
('face-pull','costas','secondary'),


-- BÍCEPS
('rosca-direta-barra','biceps','primary'),
('rosca-direta-barra','antebracos','secondary'),

('rosca-direta-halteres','biceps','primary'),
('rosca-direta-halteres','antebracos','secondary'),

('rosca-alternada','biceps','primary'),

('rosca-martelo','biceps','primary'),
('rosca-martelo','antebracos','secondary'),

('rosca-scott-maquina','biceps','primary'),
('rosca-polia','biceps','primary'),


-- TRÍCEPS
('triceps-polia','triceps','primary'),
('triceps-corda','triceps','primary'),
('triceps-frances-halter','triceps','primary'),
('triceps-testa-barra','triceps','primary'),

('triceps-mergulho','triceps','primary'),
('triceps-mergulho','peito','secondary'),


-- QUADRÍCEPS
('agachamento-barra','quadriceps','primary'),
('agachamento-barra','gluteos','secondary'),
('agachamento-barra','posteriores','secondary'),

('agachamento-smith','quadriceps','primary'),
('agachamento-smith','gluteos','secondary'),

('agachamento-goblet','quadriceps','primary'),
('agachamento-goblet','gluteos','secondary'),

('leg-press','quadriceps','primary'),
('leg-press','gluteos','secondary'),

('cadeira-extensora','quadriceps','primary'),

('afundo-halteres','quadriceps','primary'),
('afundo-halteres','gluteos','secondary'),

('passada-halteres','quadriceps','primary'),
('passada-halteres','gluteos','secondary'),


-- POSTERIORES
('cadeira-flexora','posteriores','primary'),
('mesa-flexora','posteriores','primary'),
('flexora-unilateral','posteriores','primary'),

('stiff-barra','posteriores','primary'),
('stiff-barra','gluteos','secondary'),

('stiff-halteres','posteriores','primary'),
('stiff-halteres','gluteos','secondary'),

('stiff-unilateral','posteriores','primary'),
('stiff-unilateral','gluteos','secondary'),


-- GLÚTEOS
('elevacao-pelvica-barra','gluteos','primary'),
('elevacao-pelvica-barra','posteriores','secondary'),

('elevacao-pelvica-maquina','gluteos','primary'),
('elevacao-pelvica-maquina','posteriores','secondary'),

('gluteo-polia','gluteos','primary'),
('abducao-polia','gluteos','primary'),
('cadeira-abdutora','gluteos','primary'),


-- ADUTORES
('cadeira-adutora','adutores','primary'),
('aducao-polia','adutores','primary'),


-- PANTURRILHAS
('panturrilha-em-pe-maquina','panturrilhas','primary'),
('panturrilha-sentada','panturrilhas','primary'),
('panturrilha-leg-press','panturrilhas','primary'),
('elevacao-panturrilha','panturrilhas','primary'),


-- ABDÔMEN
('prancha','abdomen','primary'),
('prancha-lateral','abdomen','primary'),
('abdominal-crunch','abdomen','primary'),
('abdominal-infra','abdomen','primary'),
('abdominal-polia','abdomen','primary')

)

INSERT INTO public.exercise_muscles(
    exercise_id,
    muscle_group_id,
    role
)

SELECT
    e.id,
    m.id,
    s.role

FROM seed s

JOIN public.exercises e
    ON e.slug = s.exercise

JOIN public.muscle_groups m
    ON m.slug = s.muscle

ON CONFLICT DO NOTHING;