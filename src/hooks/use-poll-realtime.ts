import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Periodically polls / refetches votes for active poll views without requiring Supabase websockets.
 */
export function usePollRealtime(pollId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Poll updates every 6 seconds while the user is actively viewing polls
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    }, 6000);

    return () => {
      clearInterval(interval);
    };
  }, [pollId, queryClient]);
}
