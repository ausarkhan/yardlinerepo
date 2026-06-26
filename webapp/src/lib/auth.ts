import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "./types";

// Send a 6-digit one-time passcode to the given email.
export async function sendOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

// Verify the OTP code. Returns the authenticated session's user.
export async function verifyOtp(email: string, token: string): Promise<User> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  if (!data.user) throw new Error("Verification failed. Please try again.");
  return data.user;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

function handleFromEmail(email: string | undefined): string {
  const local = (email ?? "user").split("@")[0].replace(/[^a-z0-9_.]/gi, "");
  return `@${local || "user"}`;
}

// Fetch the profile for a user; create a minimal one if it doesn't exist yet.
export async function ensureProfile(user: User): Promise<Profile | null> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("Failed to load profile:", selectError.message);
  }
  if (existing) return existing as Profile;

  // profiles requires non-null name, handle, campus and joined_date.
  const nowIso = new Date().toISOString();
  const newProfile = {
    id: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.name as string) || user.email?.split("@")[0] || "New Member",
    handle: handleFromEmail(user.email),
    avatar: null,
    banner: null,
    bio: null,
    social_links: {},
    campus: "",
    joined_date: nowIso,
    is_provider: false,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create profile:", insertError.message);
    // Return the optimistic shape so the UI still works for the session.
    return newProfile as Profile;
  }
  return inserted as Profile;
}

// Persist editable profile fields.
export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "name" | "handle" | "campus" | "avatar" | "banner" | "bio" | "social_links">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

// Upload a profile image to the public `avatars` bucket and return its URL.
export async function uploadProfileImage(userId: string, file: File, kind: "avatar" | "banner"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export function uploadAvatar(userId: string, file: File): Promise<string> {
  return uploadProfileImage(userId, file, "avatar");
}
