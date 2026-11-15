import { createContext, useContext } from "react";

// The owner's name and photo come from the database after unlock; nothing
// identifying is bundled with the site.
export type Owner = { name: string; avatar: string };

export const fallbackAvatar = () => `${import.meta.env.BASE_URL}icon-192.png`;

export const OwnerContext = createContext<Owner>({ name: "", avatar: fallbackAvatar() });
export const useOwner = () => useContext(OwnerContext);
