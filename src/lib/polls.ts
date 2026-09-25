export const CATEGORIES = ["Campus", "Events", "Academics", "Clubs", "Fun"] as const;
export type Category = (typeof CATEGORIES)[number];

export const VISTAS_CLASSES = [
  "BCA-CC",
  "BCA-DS",
  "MBA",
  "BSC-Cyber",
  "BBA-Aviation",
  "BSC-Areonautical",
] as const;
export type VistasClass = (typeof VISTAS_CLASSES)[number];

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  votes_count: number;
};

export type Poll = {
  id: string;
  question: string;
  category: string;
  creator_id: string | null;
  creator_name: string;
  created_at: string;
  expires_at: string;
  anonymous_voting: boolean;
  multiple_selection: boolean;
  total_votes: number;
  poll_options: PollOption[];
  is_global?: boolean;
  class_name?: string | null;
  department?: string | null;
  year?: string | null;
};

export type SortKey = "recent" | "votes" | "ending";

export function isClosed(poll: Pick<Poll, "expires_at">, now = Date.now()) {
  return new Date(poll.expires_at).getTime() <= now;
}

/** Human, non-technical message for anything that can go wrong. */
export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("already_voted") || raw.includes("already voted")) return "You've already voted in this poll.";
  if (raw.includes("poll_closed") || raw.includes("closed")) return "This poll has closed — voting is no longer open.";
  if (raw.includes("duplicate key")) return "You've already voted for that option.";
  if (raw.includes("poll_not_found") || raw.includes("not found")) return "We couldn't find that poll.";
  if (/network|fetch|failed to fetch/i.test(raw)) return "Connection lost. Check your network and try again.";
  return "Something went wrong. Please try again.";
}

export async function fetchPolls(opts: {
  category?: string | undefined;
  search?: string | undefined;
  sort?: SortKey | undefined;
  feed?: "class" | "global" | "all" | undefined;
  className?: string | undefined;
} = {}): Promise<Poll[]> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.search) params.set("search", opts.search);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.feed) params.set("feed", opts.feed);
  if (opts.className) params.set("className", opts.className);

  const res = await fetch(`/api/polls?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load polls");
  return json.data || [];
}

export async function fetchPoll(id: string): Promise<Poll | null> {
  const res = await fetch(`/api/polls/${id}`);
  if (res.status === 404) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load poll");
  return json.data || null;
}

export async function fetchMyPolls(userId: string): Promise<Poll[]> {
  const res = await fetch("/api/polls/my");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load your polls");
  return json.data || [];
}

/** Option ids the current user has already picked, keyed by poll id. */
export async function fetchMyVotes(userId: string, pollIds: string[]): Promise<Record<string, string[]>> {
  if (pollIds.length === 0) return {};
  const res = await fetch("/api/votes/my", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pollIds }),
  });
  const json = await res.json();
  return json.data || {};
}

export type NewPoll = {
  question: string;
  options: string[];
  category: string;
  durationMinutes: number;
  anonymousVoting: boolean;
  multipleSelection: boolean;
  isGlobal?: boolean | undefined;
  className?: string | undefined;
  year?: string | undefined;
  department?: string | undefined;
};

export function validatePoll(draft: { question: string; options: string[] }): string | null {
  const question = draft.question.trim();
  if (!question) return "Add a question so people know what they're deciding.";
  if (question.length < 8) return "That question is a little short — add a bit more context.";
  if (question.length > 200) return "Keep the question under 200 characters.";

  const options = draft.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) return "A poll needs at least two options.";
  if (options.some((o) => o.length > 80)) return "Keep each option under 80 characters.";
  const seen = new Set(options.map((o) => o.toLowerCase()));
  if (seen.size !== options.length) return "Two options are the same — make each one distinct.";
  return null;
}

export async function createPoll(draft: NewPoll, user: { id: string; name: string }): Promise<string> {
  const res = await fetch("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create poll");
  return json.id;
}

export async function castVote(pollId: string, optionIds: string[], userId: string) {
  const res = await fetch(`/api/polls/${pollId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionIds }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to cast vote");
}

export async function deletePoll(pollId: string) {
  const res = await fetch(`/api/polls/${pollId}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to delete poll");
}

export function percentage(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}
