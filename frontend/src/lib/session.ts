import { queryClient } from "./queryClient";
import { supabase } from "./supabase";

export function beginSession(): void {
  queryClient.clear();
}

export async function endSession(
  redirectTo: string = "/login"
): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  } finally {
    queryClient.clear();
    window.history.replaceState(null, "", redirectTo);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}