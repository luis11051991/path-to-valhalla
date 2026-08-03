-- Actualizacion de enemigos de las zonas 79 a 100
-- Cambia unicamente name e image_url. Conserva IDs, estadisticas, recompensas y demas campos.
-- El prefijo/directorio actual de image_url se conserva; solo se reemplaza el archivo por un .png nuevo.

BEGIN;

-- Seguridad: cada zona debe tener exactamente 6 enemigos y exactamente 1 boss.
DO $$
DECLARE
    zona integer;
    total integer;
    bosses integer;
BEGIN
    FOR zona IN 79..100 LOOP
        SELECT COUNT(*), COUNT(*) FILTER (WHERE is_boss IS TRUE)
          INTO total, bosses
          FROM public.enemies
         WHERE zone_id = zona;

        IF total <> 6 THEN
            RAISE EXCEPTION 'Zona %: se esperaban 6 enemigos, pero existen %', zona, total;
        END IF;

        IF bosses <> 1 THEN
            RAISE EXCEPTION 'Zona %: se esperaba 1 boss, pero existen %', zona, bosses;
        END IF;
    END LOOP;
END $$;

CREATE TEMP TABLE tmp_enemy_replacements (
    zone_id integer NOT NULL,
    slot integer NOT NULL,
    new_name varchar(100) NOT NULL,
    new_slug varchar(255) NOT NULL,
    PRIMARY KEY (zone_id, slot)
) ON COMMIT DROP;

INSERT INTO tmp_enemy_replacements (zone_id, slot, new_name, new_slug)
VALUES
    (79, 1, 'Vástago de la Mentira Primordial', 'vastago_de_la_mentira_primordial'),
    (79, 2, 'Jötunn de los Rostros Robados', 'jotunn_de_los_rostros_robados'),
    (79, 3, 'Serpiente de la Risa Verde', 'serpiente_de_la_risa_verde'),
    (79, 4, 'Hrafn del Espejo Quebrado', 'hrafn_del_espejo_quebrado'),
    (79, 5, 'Avatar de las Mil Máscaras', 'avatar_de_las_mil_mascaras'),
    (79, 6, 'Loptr, Príncipe del Engaño de Zona 79', 'loptr_principe_del_engano_de_zona_79'),
    (80, 1, 'Oráculo de Ceniza Eterna', 'oraculo_de_ceniza_eterna'),
    (80, 2, 'Einherjar de la Profecía Carbonizada', 'einherjar_de_la_profecia_carbonizada'),
    (80, 3, 'Vargr de los Futuros Ardientes', 'vargr_de_los_futuros_ardientes'),
    (80, 4, 'Jötunn del Destino Incinerado', 'jotunn_del_destino_incinerado'),
    (80, 5, 'Seiðkona del Último Presagio', 'seidkona_del_ultimo_presagio'),
    (80, 6, 'Surtrún, Dios Menor de la Profecía Ígnea de Zona 80', 'surtrun_dios_menor_de_la_profecia_ignea_de_zona_80'),
    (81, 1, 'Heraldo Semidivino del Ocaso', 'heraldo_semidivino_del_ocaso'),
    (81, 2, 'Einherjar del Último Ciclo', 'einherjar_del_ultimo_ciclo'),
    (81, 3, 'Hrafn de las Nueve Ruinas', 'hrafn_de_las_nueve_ruinas'),
    (81, 4, 'Vargr del Crepúsculo Divino', 'vargr_del_crepusculo_divino'),
    (81, 5, 'Jötunn del Mundo Quebrado', 'jotunn_del_mundo_quebrado'),
    (81, 6, 'Valthor, Semidiós del Ragnarök de Zona 81', 'valthor_semidios_del_ragnarok_de_zona_81'),
    (82, 1, 'Acólito del Sol Encadenado', 'acolito_del_sol_encadenado'),
    (82, 2, 'Bestia Solar de Obsidiana', 'bestia_solar_de_obsidiana'),
    (82, 3, 'Einherjar del Eclipse Forjado', 'einherjar_del_eclipse_forjado'),
    (82, 4, 'Sköllborn, Devorador de Brasas', 'skollborn_devorador_de_brasas'),
    (82, 5, 'Hierofante del Astro Negro', 'hierofante_del_astro_negro'),
    (82, 6, 'Svarsol, Dios Menor del Sol Negro de Zona 82', 'svarsol_dios_menor_del_sol_negro_de_zona_82'),
    (83, 1, 'Náyade Negra del Mar Sin Fondo', 'nayade_negra_del_mar_sin_fondo'),
    (83, 2, 'Einherjar de la Corona Abisal', 'einherjar_de_la_corona_abisal'),
    (83, 3, 'Kraken Rúnico de las Nueve Mareas', 'kraken_runico_de_las_nueve_mareas'),
    (83, 4, 'Heraldo de la Reina Ahogada', 'heraldo_de_la_reina_ahogada'),
    (83, 5, 'Ormr del Trono Sumergido', 'ormr_del_trono_sumergido'),
    (83, 6, 'Ránveig, Diosa Menor del Abismo de Zona 83', 'ranveig_diosa_menor_del_abismo_de_zona_83'),
    (84, 1, 'Custodio del Trono Sin Rey', 'custodio_del_trono_sin_rey'),
    (84, 2, 'Jarl Espectral de la Corona Vacía', 'jarl_espectral_de_la_corona_vacia'),
    (84, 3, 'Hrafn de los Reyes Olvidados', 'hrafn_de_los_reyes_olvidados'),
    (84, 4, 'Avatar del Salón Deshabitado', 'avatar_del_salon_deshabitado'),
    (84, 5, 'Devorador de Coronas Muertas', 'devorador_de_coronas_muertas'),
    (84, 6, 'Hásæti, Dios Menor de los Tronos Vacíos de Zona 84', 'hasaeti_dios_menor_de_los_tronos_vacios_de_zona_84'),
    (85, 1, 'Paladín del Invierno Inmortal', 'paladin_del_invierno_inmortal'),
    (85, 2, 'Einherjar de la Aurora Congelada', 'einherjar_de_la_aurora_congelada'),
    (85, 3, 'Vargr de Cristal Divino', 'vargr_de_cristal_divino'),
    (85, 4, 'Hrímþurs de la Sangre Blanca', 'hrimthurs_de_la_sangre_blanca'),
    (85, 5, 'Oráculo del Cero Eterno', 'oraculo_del_cero_eterno'),
    (85, 6, 'Ísvald, Dios Menor del Invierno Eterno de Zona 85', 'isvald_dios_menor_del_invierno_eterno_de_zona_85'),
    (86, 1, 'Caminante del Fimbulvetr', 'caminante_del_fimbulvetr'),
    (86, 2, 'Draugr de las Tres Nieves', 'draugr_de_las_tres_nieves'),
    (86, 3, 'Vargr de la Tormenta Sin Sol', 'vargr_de_la_tormenta_sin_sol'),
    (86, 4, 'Jötunn del Horizonte Blanco', 'jotunn_del_horizonte_blanco'),
    (86, 5, 'Heraldo de los Años Helados', 'heraldo_de_los_anos_helados'),
    (86, 6, 'Vetrgrim, Semidiós del Fimbulvetr de Zona 86', 'vetrgrim_semidios_del_fimbulvetr_de_zona_86'),
    (87, 1, 'Vargr de la Constelación Rota', 'vargr_de_la_constelacion_rota'),
    (87, 2, 'Guardián Lupino del Firmamento', 'guardian_lupino_del_firmamento'),
    (87, 3, 'Fenrisúlfr de Luz Estelar', 'fenrisulfr_de_luz_estelar'),
    (87, 4, 'Einherjar Domador de Cometas', 'einherjar_domador_de_cometas'),
    (87, 5, 'Espíritu del Aullido Cósmico', 'espiritu_del_aullido_cosmico'),
    (87, 6, 'Mániulf, Dios Menor de los Lobos Celestes de Zona 87', 'maniulf_dios_menor_de_los_lobos_celestes_de_zona_87'),
    (88, 1, 'Espina de Urd, Memoria Viviente', 'espina_de_urd_memoria_viviente'),
    (88, 2, 'Guerrero Hilado por Verdandi', 'guerrero_hilado_por_verdandi'),
    (88, 3, 'Hrafn de las Tijeras de Skuld', 'hrafn_de_las_tijeras_de_skuld'),
    (88, 4, 'Tejedora de los Tres Tiempos', 'tejedora_de_los_tres_tiempos'),
    (88, 5, 'Jötunn del Telar Cósmico', 'jotunn_del_telar_cosmico'),
    (88, 6, 'Nornveig, Diosa Menor del Destino de Zona 88', 'nornveig_diosa_menor_del_destino_de_zona_88'),
    (89, 1, 'Vástago del Lobo Padre', 'vastago_del_lobo_padre'),
    (89, 2, 'Sacerdote de la Sangre de Fenrir', 'sacerdote_de_la_sangre_de_fenrir'),
    (89, 3, 'Vargr de la Mandíbula Primordial', 'vargr_de_la_mandibula_primordial'),
    (89, 4, 'Einherjar de las Cadenas Divinas', 'einherjar_de_las_cadenas_divinas'),
    (89, 5, 'Avatar del Aullido Ancestral', 'avatar_del_aullido_ancestral'),
    (89, 6, 'Fenrvald, Semidiós del Lobo Padre de Zona 89', 'fenrvald_semidios_del_lobo_padre_de_zona_89'),
    (90, 1, 'Custodio del Umbral de Éljúðnir', 'custodio_del_umbral_de_eljudnir'),
    (90, 2, 'Einherjar de la Mitad Muerta', 'einherjar_de_la_mitad_muerta'),
    (90, 3, 'Hrafn de la Reina Pálida', 'hrafn_de_la_reina_palida'),
    (90, 4, 'Avatar de la Enfermedad Helada', 'avatar_de_la_enfermedad_helada'),
    (90, 5, 'Sabueso del Palacio de Hel', 'sabueso_del_palacio_de_hel'),
    (90, 6, 'Helveig, Diosa Menor de los Dos Rostros de Zona 90', 'helveig_diosa_menor_de_los_dos_rostros_de_zona_90'),
    (91, 1, 'Descendiente del Trueno Caído', 'descendiente_del_trueno_caido'),
    (91, 2, 'Draugr de Sangre Ásica', 'draugr_de_sangre_asica'),
    (91, 3, 'Hrafn del Linaje Divino', 'hrafn_del_linaje_divino'),
    (91, 4, 'Guerrero de la Chispa Semidivina', 'guerrero_de_la_chispa_semidivina'),
    (91, 5, 'Vargr de la Sangre Dorada', 'vargr_de_la_sangre_dorada'),
    (91, 6, 'Týrsson, Semidiós Deshonrado de Zona 91', 'tyrsson_semidios_deshonrado_de_zona_91'),
    (92, 1, 'Centinela del Asgard Quebrado', 'centinela_del_asgard_quebrado'),
    (92, 2, 'Einherjar del Oro Celestial Roto', 'einherjar_del_oro_celestial_roto'),
    (92, 3, 'Águila del Bifröst Caído', 'aguila_del_bifrost_caido'),
    (92, 4, 'Runista de los Salones Partidos', 'runista_de_los_salones_partidos'),
    (92, 5, 'Vargr de la Luz Ásica', 'vargr_de_la_luz_asica'),
    (92, 6, 'Ásgarðrún, Dios Menor de las Ruinas Divinas de Zona 92', 'asgardrun_dios_menor_de_las_ruinas_divinas_de_zona_92'),
    (93, 1, 'Custodio de la Sangre de los Dioses', 'custodio_de_la_sangre_de_los_dioses'),
    (93, 2, 'Draugr de Icor Dorado', 'draugr_de_icor_dorado'),
    (93, 3, 'Águila de las Alas Heridas', 'aguila_de_las_alas_heridas'),
    (93, 4, 'Runista de las Cicatrices Divinas', 'runista_de_las_cicatrices_divinas'),
    (93, 5, 'Vargr del Resplandor Moribundo', 'vargr_del_resplandor_moribundo'),
    (93, 6, 'Sárgod, Dios Menor de las Heridas Eternas de Zona 93', 'sargod_dios_menor_de_las_heridas_eternas_de_zona_93'),
    (94, 1, 'Dvergr de la Primera Forja', 'dvergr_de_la_primera_forja'),
    (94, 2, 'Escarabajo de Uru Primordial', 'escarabajo_de_uru_primordial'),
    (94, 3, 'Maestro Rúnico de Svartálfaheim', 'maestro_runico_de_svartalfaheim'),
    (94, 4, 'Gólem del Martillo Creador', 'golem_del_martillo_creador'),
    (94, 5, 'Espectro del Herrero de los Dioses', 'espectro_del_herrero_de_los_dioses'),
    (94, 6, 'Sindrvald, Dios Menor de la Forja Primordial de Zona 94', 'sindrvald_dios_menor_de_la_forja_primordial_de_zona_94'),
    (95, 1, 'Vástago del Ojo de Yggdrasil', 'vastago_del_ojo_de_yggdrasil'),
    (95, 2, 'Eikþyrnir de la Savia Estelar', 'eikthyrnir_de_la_savia_estelar'),
    (95, 3, 'Einherjar de las Raíces Conscientes', 'einherjar_de_las_raices_conscientes'),
    (95, 4, 'Dvergr Custodio del Corazón Verde', 'dvergr_custodio_del_corazon_verde'),
    (95, 5, 'Ormr de la Savia Cósmica', 'ormr_de_la_savia_cosmica'),
    (95, 6, 'Yggveig, Dios Menor del Ojo del Mundo de Zona 95', 'yggveig_dios_menor_del_ojo_del_mundo_de_zona_95'),
    (96, 1, 'Centinela del Último Umbral Helado', 'centinela_del_ultimo_umbral_helado'),
    (96, 2, 'Einherjar del Invierno Terminal', 'einherjar_del_invierno_terminal'),
    (96, 3, 'Vargr del Frío del Fin', 'vargr_del_frio_del_fin'),
    (96, 4, 'Hrímþurs de la Puerta Negra', 'hrimthurs_de_la_puerta_negra'),
    (96, 5, 'Heraldo de la Escarcha Absoluta', 'heraldo_de_la_escarcha_absoluta'),
    (96, 6, 'Nástrvetr, Dios Menor del Último Invierno de Zona 96', 'nastrvetr_dios_menor_del_ultimo_invierno_de_zona_96'),
    (97, 1, 'Escamado del Círculo Mundial', 'escamado_del_circulo_mundial'),
    (97, 2, 'Einherjar del Veneno de Jörmungandr', 'einherjar_del_veneno_de_jormungandr'),
    (97, 3, 'Ormr de las Raíces Oceánicas', 'ormr_de_las_raices_oceanicas'),
    (97, 4, 'Hrafn de Sangre Serpentina', 'hrafn_de_sangre_serpentina'),
    (97, 5, 'Gusano del Anillo de Midgard', 'gusano_del_anillo_de_midgard'),
    (97, 6, 'Jörmveig, Dios Menor de la Serpiente Mundial de Zona 97', 'jormveig_dios_menor_de_la_serpiente_mundial_de_zona_97'),
    (98, 1, 'Vargr del Aullido Terminal', 'vargr_del_aullido_terminal'),
    (98, 2, 'Sacerdote del Colmillo del Fin', 'sacerdote_del_colmillo_del_fin'),
    (98, 3, 'Fenrisúlfr de las Cadenas Rotas', 'fenrisulfr_de_las_cadenas_rotas'),
    (98, 4, 'Einherjar Domador del Último Aullido', 'einherjar_domador_del_ultimo_aullido'),
    (98, 5, 'Espíritu de la Jauría del Ocaso', 'espiritu_de_la_jauria_del_ocaso'),
    (98, 6, 'Úlfdómr, Dios Menor del Aullido Final de Zona 98', 'ulfdromr_dios_menor_del_aullido_final_de_zona_98'),
    (99, 1, 'Custodio de los Cadáveres Divinos', 'custodio_de_los_cadaveres_divinos'),
    (99, 2, 'Draugr del Icor Extinguido', 'draugr_del_icor_extinguido'),
    (99, 3, 'Águila del Cielo Sin Dioses', 'aguila_del_cielo_sin_dioses'),
    (99, 4, 'Runista de los Nombres Borrados', 'runista_de_los_nombres_borrados'),
    (99, 5, 'Vargr del Último Resplandor', 'vargr_del_ultimo_resplandor'),
    (99, 6, 'Goðdauði, Dios Menor de los Dioses Muertos de Zona 99', 'goddauði_dios_menor_de_los_dioses_muertos_de_zona_99'),
    (100, 1, 'Heraldo del Instante Anterior', 'heraldo_del_instante_anterior'),
    (100, 2, 'Einherjar del Umbral del Ragnarök', 'einherjar_del_umbral_del_ragnarok'),
    (100, 3, 'Hrafn del Último Presente', 'hrafn_del_ultimo_presente'),
    (100, 4, 'Vargr de la Ruina Inminente', 'vargr_de_la_ruina_inminente'),
    (100, 5, 'Jötunn del Latido Final', 'jotunn_del_latido_final'),
    (100, 6, 'Ragnarvald, Semidiós del Fin Inminente de Zona 100', 'ragnarvald_semidios_del_fin_inminente_de_zona_100');

-- Evita crear nombres que ya existan en las zonas 1-78.
DO $$
DECLARE
    conflict_count integer;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM tmp_enemy_replacements r
    JOIN public.enemies e
      ON LOWER(BTRIM(e.name)) = LOWER(BTRIM(r.new_name))
    WHERE e.zone_id NOT BETWEEN 79 AND 100;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Uno o mas nombres nuevos ya existen fuera de las zonas 79-100';
    END IF;
END $$;

WITH ranked_enemies AS (
    SELECT
        e.id,
        e.zone_id,
        e.image_url,
        ROW_NUMBER() OVER (
            PARTITION BY e.zone_id
            ORDER BY CASE WHEN e.is_boss IS TRUE THEN 1 ELSE 0 END, e.id
        ) AS slot
    FROM public.enemies e
    WHERE e.zone_id BETWEEN 79 AND 100
), updated AS (
    UPDATE public.enemies e
       SET name = r.new_name,
           image_url = CASE
               WHEN COALESCE(BTRIM(e.image_url), '') = ''
                   THEN r.new_slug || '.png'
               WHEN POSITION('/' IN e.image_url) > 0
                   THEN REGEXP_REPLACE(e.image_url, '[^/]+$', r.new_slug || '.png')
               ELSE r.new_slug || '.png'
           END
      FROM ranked_enemies re
      JOIN tmp_enemy_replacements r
        ON r.zone_id = re.zone_id
       AND r.slot = re.slot
     WHERE e.id = re.id
    RETURNING e.id, e.zone_id, e.name, e.image_url, e.is_boss
)
SELECT *
FROM updated
ORDER BY zone_id, is_boss, id;

-- Verificacion final: no deben quedar nombres o rutas repetidos en las zonas 79-100.
DO $$
DECLARE
    duplicated_names integer;
    duplicated_urls integer;
BEGIN
    SELECT COUNT(*) INTO duplicated_names
    FROM (
        SELECT LOWER(BTRIM(name))
        FROM public.enemies
        WHERE zone_id BETWEEN 79 AND 100
        GROUP BY LOWER(BTRIM(name))
        HAVING COUNT(*) > 1
    ) d;

    SELECT COUNT(*) INTO duplicated_urls
    FROM (
        SELECT LOWER(BTRIM(image_url))
        FROM public.enemies
        WHERE zone_id BETWEEN 79 AND 100
        GROUP BY LOWER(BTRIM(image_url))
        HAVING COUNT(*) > 1
    ) d;

    IF duplicated_names > 0 OR duplicated_urls > 0 THEN
        RAISE EXCEPTION 'Persisten duplicados: nombres=%, image_url=%', duplicated_names, duplicated_urls;
    END IF;
END $$;

COMMIT;

-- Consulta de comprobacion posterior.
SELECT id, zone_id, name, image_url, is_boss
FROM public.enemies
WHERE zone_id BETWEEN 79 AND 100
ORDER BY zone_id, is_boss, id;
