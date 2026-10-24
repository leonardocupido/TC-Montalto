import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Summary, User } from "./types";

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],

    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, level")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      return profile as User;
    },

    retry: false,
  });
}

export function useSummary(enabled: boolean) {
  return useQuery<Summary>({
    queryKey: ["summary"],
    enabled,
    refetchInterval: 30000,

    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Utente non autenticato");
      }

      const userId = user.id;

      const { data: ownedMatches, error: matchesError } = await supabase
        .from("matches")
        .select("id")
        .eq("owner_id", userId)
        .eq("status", "aperta");

      if (matchesError) {
        throw matchesError;
      }

      const ownedMatchIds = (ownedMatches ?? []).map(
        (match) => match.id
      );

      let pendingReviews = 0;

      if (ownedMatchIds.length > 0) {
        const { count, error } = await supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .in("match_id", ownedMatchIds)
          .eq("status", "in_attesa");

        if (error) {
          throw error;
        }

        pendingReviews = count ?? 0;
      }

      const [
        acceptedResult,
        newAcceptancesResult,
        cancellationsResult,
        pendingChallengesResult,
        sentChallengeUpdatesResult,
        receivedChallengeUpdatesResult,
      ] = await Promise.all([
        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "accettata"),

        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "accettata")
          .eq("applicant_seen", false),

        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("cancel_seen", false),

        supabase
          .from("challenges")
          .select("*", { count: "exact", head: true })
          .eq("challenged_id", userId)
          .eq("status", "in_attesa"),

        supabase
          .from("challenges")
          .select("*", { count: "exact", head: true })
          .eq("challenger_id", userId)
          .eq("result_seen", false),

        supabase
          .from("challenges")
          .select("*", { count: "exact", head: true })
          .eq("challenged_id", userId)
          .eq("seen_by_challenged", false)
          .neq("status", "in_attesa"),
      ]);

      const results = [
        acceptedResult,
        newAcceptancesResult,
        cancellationsResult,
        pendingChallengesResult,
        sentChallengeUpdatesResult,
        receivedChallengeUpdatesResult,
      ];

      const failedResult = results.find(
        (result) => result.error
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      return {
        pending_reviews: pendingReviews,
        accepted_applications: acceptedResult.count ?? 0,
        new_acceptances: newAcceptancesResult.count ?? 0,
        new_cancellations: cancellationsResult.count ?? 0,
        pending_challenges: pendingChallengesResult.count ?? 0,
        challenge_updates:
          (sentChallengeUpdatesResult.count ?? 0) +
          (receivedChallengeUpdatesResult.count ?? 0),
      };
    },
  });
}