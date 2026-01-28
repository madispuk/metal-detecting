import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Admin permission utilities
export const checkAdminPermission = (user) => {
  if (!user) return false;
  return user.user_metadata?.admin === true;
};

export const requireAdmin = (user) => {
  if (!checkAdminPermission(user)) {
    throw new Error("Admin permission required for this operation");
  }
  return true;
};

// Format metal detecting type names for display
export const formatTypeName = (type) => {
  if (!type) return "Unknown";

  const typeMap = {
    coins: "Coins",
    jewelry: "Jewelry",
    relics: "Relics",
    "tools-and-hardware": "Tools and Hardware",
    "tokens-and-medallions": "Tokens and Medallions",
    "weapons-and-ammunition": "Weapons and Ammunition",
    "household-items": "Household Items",
    "military-items": "Military Items",
    "industrial-scrap-junk": "Industrial Scrap / Junk",
    "religious-or-decorative-items": "Religious or Decorative Items",
    unknown: "Unknown",
  };

  return (
    typeMap[type] ||
    type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
};
