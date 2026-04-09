"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

export type EtapeRecord = {
  id: number;
  accountid: number;
  missionid: number;
  date?: string | null;
  nomtypedetape?: string | null;
  adresse?: string | null;
  heuredebutreelle?: string | null;
  heurefinreelle?: string | null;
};

export type AccountRecord = {
  id: number;
  nom?: string | number | null;
  prenom?: string | number | null;
  email?: string | number | null;
  username?: string | number | null;
  nconducteur?: string | number | null;
};

export type MissionRecord = {
  missionid: number;
  accountid?: number | null;
  [key: string]: unknown;
};

export type GpsRecord = {
  id?: number;
  missionid: number;
  latitude?: number | null;
  longitude?: number | null;
  date?: string | null;
  [key: string]: unknown;
};

type SiteDataContextValue = {
  allEtapes: EtapeRecord[];
  allAccounts: AccountRecord[];
  allMissions: MissionRecord[];
  allGps: GpsRecord[];
  isApiSettled: boolean;
};

const SiteDataContext = createContext<SiteDataContextValue | null>(null);

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return (await response.json()) as T;
}

export function SiteDataProvider({ children }: { children: React.ReactNode }) {
  const [allEtapes, setAllEtapes] = useState<EtapeRecord[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountRecord[]>([]);
  const [allMissions, setAllMissions] = useState<MissionRecord[]>([]);
  const [allGps, setAllGps] = useState<GpsRecord[]>([]);
  const [isApiSettled, setIsApiSettled] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;
    Promise.allSettled([
      fetchJson<EtapeRecord[]>("/api/etapes"),
      fetchJson<AccountRecord[]>("/api/accounts"),
      fetchJson<MissionRecord[]>("/api/missions"),
      fetchJson<GpsRecord[]>("/api/gps"),
    ]).then(([etapesRes, accountsRes, missionsRes, gpsRes]) => {
      if (!active) return;

      if (etapesRes.status === "fulfilled") setAllEtapes(etapesRes.value);
      else console.error(etapesRes.reason);

      if (accountsRes.status === "fulfilled") setAllAccounts(accountsRes.value);
      else console.error(accountsRes.reason);

      if (missionsRes.status === "fulfilled") setAllMissions(missionsRes.value);
      else console.error(missionsRes.reason);

      if (gpsRes.status === "fulfilled") setAllGps(gpsRes.value);
      else console.error(gpsRes.reason);

      setIsApiSettled(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ allEtapes, allAccounts, allMissions, allGps, isApiSettled }),
    [allEtapes, allAccounts, allMissions, allGps, isApiSettled],
  );

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const ctx = useContext(SiteDataContext);
  if (!ctx) {
    throw new Error("useSiteData must be used within SiteDataProvider");
  }
  return ctx;
}

