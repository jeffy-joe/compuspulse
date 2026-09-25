REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_vote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_vote_counts() FROM PUBLIC, anon, authenticated;