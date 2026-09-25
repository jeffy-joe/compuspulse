-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Student',
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(NEW.email, 'student@campus'), '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- POLLS
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  category text NOT NULL DEFAULT 'Campus',
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name text NOT NULL DEFAULT 'CampusPulse',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day',
  anonymous_voting boolean NOT NULL DEFAULT false,
  multiple_selection boolean NOT NULL DEFAULT false,
  total_votes integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT SELECT ON public.polls TO anon;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls_read_all" ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls_insert_own" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "polls_update_own" ON public.polls FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "polls_delete_own" ON public.polls FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE INDEX polls_created_at_idx ON public.polls (created_at DESC);

-- POLL OPTIONS
CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  votes_count integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT ON public.poll_options TO anon;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options_read_all" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "poll_options_insert_own" ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));
CREATE POLICY "poll_options_update_own" ON public.poll_options FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));
CREATE POLICY "poll_options_delete_own" ON public.poll_options FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));
CREATE INDEX poll_options_poll_id_idx ON public.poll_options (poll_id);

-- VOTES
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);
GRANT SELECT, INSERT ON public.votes TO authenticated;
GRANT SELECT ON public.votes TO anon;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_read_all" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own" ON public.votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX votes_poll_user_idx ON public.votes (poll_id, user_id);

-- VALIDATION + COUNTERS
CREATE OR REPLACE FUNCTION public.validate_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.polls%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.polls WHERE id = NEW.poll_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'poll_not_found'; END IF;
  IF p.expires_at <= now() THEN RAISE EXCEPTION 'poll_closed'; END IF;
  IF NOT p.multiple_selection AND EXISTS (
    SELECT 1 FROM public.votes v WHERE v.poll_id = NEW.poll_id AND v.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'already_voted';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER votes_validate BEFORE INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.validate_vote();

CREATE OR REPLACE FUNCTION public.sync_vote_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.poll_options SET votes_count = votes_count + 1 WHERE id = NEW.option_id;
    UPDATE public.polls SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.poll_options SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE public.polls SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER votes_sync_counts AFTER INSERT OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.sync_vote_counts();

-- REALTIME
ALTER TABLE public.polls REPLICA IDENTITY FULL;
ALTER TABLE public.poll_options REPLICA IDENTITY FULL;
ALTER TABLE public.votes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- DEMO CONTENT
WITH new_polls AS (
  INSERT INTO public.polls (question, category, creator_name, expires_at, created_at)
  VALUES
    ('Which event should our college host next semester?', 'Events', 'Student Council', now() + interval '2 days', now() - interval '3 hours'),
    ('Which workshop would you actually attend on a Saturday?', 'Academics', 'IEEE Chapter', now() + interval '18 hours', now() - interval '1 day'),
    ('Which club activity should happen this Friday?', 'Clubs', 'Cultural Committee', now() + interval '6 hours', now() - interval '5 hours'),
    ('Which topic should the next tech session cover?', 'Academics', 'CodeLab', now() + interval '3 days', now() - interval '20 minutes')
  RETURNING id, question
)
INSERT INTO public.poll_options (poll_id, label, position)
SELECT np.id, o.label, o.position
FROM new_polls np
JOIN LATERAL (
  VALUES
    ('Which event should our college host next semester?', 'Tech Fest', 0),
    ('Which event should our college host next semester?', 'Cultural Night', 1),
    ('Which event should our college host next semester?', 'Sports Day', 2),
    ('Which event should our college host next semester?', 'Hackathon', 3),
    ('Which workshop would you actually attend on a Saturday?', 'UI/UX design sprint', 0),
    ('Which workshop would you actually attend on a Saturday?', 'Cloud fundamentals', 1),
    ('Which workshop would you actually attend on a Saturday?', 'Resume & interview lab', 2),
    ('Which club activity should happen this Friday?', 'Open mic night', 0),
    ('Which club activity should happen this Friday?', 'Photowalk around campus', 1),
    ('Which club activity should happen this Friday?', 'Board games in the quad', 2),
    ('Which topic should the next tech session cover?', 'Real-time apps', 0),
    ('Which topic should the next tech session cover?', 'System design basics', 1),
    ('Which topic should the next tech session cover?', 'Git & collaboration', 2),
    ('Which topic should the next tech session cover?', 'Intro to machine learning', 3)
) AS o(q, label, position) ON o.q = np.question;