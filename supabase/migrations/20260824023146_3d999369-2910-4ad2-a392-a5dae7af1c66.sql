DELETE FROM public.votes WHERE poll_id IN (SELECT id FROM public.polls WHERE creator_id IS NULL);
DELETE FROM public.poll_options WHERE poll_id IN (SELECT id FROM public.polls WHERE creator_id IS NULL);
DELETE FROM public.polls WHERE creator_id IS NULL;