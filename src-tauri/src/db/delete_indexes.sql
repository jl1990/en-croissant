DROP INDEX IF EXISTS games_date_idx;
DROP INDEX IF EXISTS games_white_idx;
DROP INDEX IF EXISTS games_black_idx;
DROP INDEX IF EXISTS games_result_idx;
DROP INDEX IF EXISTS games_white_elo_idx;
DROP INDEX IF EXISTS games_black_elo_idx;
DROP INDEX IF EXISTS games_plycount_idx;
DROP INDEX IF EXISTS games_event_id_idx;
DROP INDEX IF EXISTS games_site_id_idx;
DROP INDEX IF EXISTS games_white_material_idx;
DROP INDEX IF EXISTS games_black_material_idx;
DROP INDEX IF EXISTS games_pawn_home_idx;

VACUUM;