import { atom } from 'jotai'
import { Profile } from "../types/user.ts";

export const profileAtom = atom<Profile | null>(null)
export const tokenAtom = atom<string | null>(null)