import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { fetchMyVotes } from "@/lib/polls";

/** Map of poll id -> option ids the signed-in user already chose. */
export function useMyVotes(pollIds: string[]) {
  const { user } = useAuth();
  const key = [...pollIds].sort().join(",");

  const { data } = useQuery({
    queryKey: ["my-votes", user?.id ?? "anon", key],
    queryFn: () => fetchMyVotes(user!.id, pollIds),
    enabled: Boolean(user) && pollIds.length > 0,
  });

  return data ?? {};
}
