
REVOKE ALL ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_schedule_for_lecturer(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_schedule_for_lecturer(UUID) TO authenticated;
