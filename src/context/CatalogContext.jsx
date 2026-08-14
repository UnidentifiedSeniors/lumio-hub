import { useCallback, useEffect, useMemo, useState } from "react";

import staticChampions, { traits as staticTraits } from "../data/gameCatalog";
import { supabase } from "../lib/supabase";
import CatalogContext from "./catalog-context";
import useAuth from "./useAuth";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toChampion(record) {
  const rawBonuses = record.stat_bonuses && typeof record.stat_bonuses === "object" ? record.stat_bonuses : {};
  const statBonuses = Object.fromEntries(["strength", "durability", "chakra", "sword", "speed", "agility"].map((key) => [key, toNumber(rawBonuses[key])]));
  return {
    id: Number(record.id),
    name: record.name,
    rarity: record.rarity,
    statBonuses,
    statTotal: toNumber(record.stat_total),
    clanPoints: toNumber(record.clan_points),
    traits: Array.isArray(record.traits) ? record.traits : [],
    tradable: record.tradable !== false,
    image_url: record.image_url || null,
  };
}

function toTrait(record) {
  const bonuses = record.bonuses && typeof record.bonuses === "object" ? record.bonuses : {};
  return {
    name: record.name,
    rarity: record.rarity,
    bonuses,
    bonusTotal: toNumber(record.bonus_total),
    notes: record.notes || null,
  };
}

export function CatalogProvider({ children }) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState({ champions: staticChampions, traits: staticTraits, source: "bundled" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshCatalog = useCallback(async () => {
    if (!user) return false;
    setLoading(true);
    const [championResult, traitResult] = await Promise.all([
      supabase.from("champions").select("id, name, rarity, traits, tradable, stat_bonuses, stat_total, clan_points, image_url").eq("tradable", true).order("id"),
      supabase.from("catalog_traits").select("catalog_key, name, rarity, bonuses, bonus_total, notes").eq("is_active", true).order("name"),
    ]);

    if (championResult.error || traitResult.error) {
      setError(championResult.error?.message || traitResult.error?.message || "Unable to refresh the live catalog.");
      setLoading(false);
      return false;
    }

    const liveChampions = (championResult.data || []).map(toChampion);
    const liveTraits = (traitResult.data || []).map(toTrait);
    if (liveChampions.length || liveTraits.length) {
      setCatalog({
        champions: liveChampions.length ? liveChampions : staticChampions,
        traits: liveTraits.length ? liveTraits : staticTraits,
        source: "live",
      });
    } else {
      setCatalog({ champions: staticChampions, traits: staticTraits, source: "bundled" });
    }
    setError(null);
    setLoading(false);
    return true;
  }, [user]);

  useEffect(() => {
    if (!user) {
      const resetTimer = window.setTimeout(() => {
        setCatalog({ champions: staticChampions, traits: staticTraits, source: "bundled" });
        setError(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const loadTimer = window.setTimeout(() => void refreshCatalog(), 0);
    return () => window.clearTimeout(loadTimer);
  }, [refreshCatalog, user]);

  const traitsByName = useMemo(() => new Map(catalog.traits.map((trait) => [trait.name, trait])), [catalog.traits]);
  const value = useMemo(() => ({ ...catalog, traitsByName, loading, error, refreshCatalog }), [catalog, error, loading, refreshCatalog, traitsByName]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
