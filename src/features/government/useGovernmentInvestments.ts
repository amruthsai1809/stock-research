"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GovernmentRepository } from "@/src/application/ports/repositories";
import { buildExposureSignals, filerStats, type GovernmentFiler, type GovernmentLeaderboardDataset, type GovernmentMeta, type GovernmentProfile, type GovernmentTrade } from "@/src/domain/government";
import { buildGovernmentDirectory, filterGovernmentTrades, type ActionFilter, type BranchFilter, type TimeFilter, type UniverseFilter } from "@/src/features/government/governmentViewModel";

export function useGovernmentInvestments(repository: GovernmentRepository) {
  const [meta, setMeta] = useState<GovernmentMeta | null>(null);
  const [filers, setFilers] = useState<GovernmentFiler[]>([]);
  const [recent, setRecent] = useState<GovernmentTrade[]>([]);
  const [leaderboard, setLeaderboard] = useState<GovernmentLeaderboardDataset | null>(null);
  const [profile, setProfile] = useState<GovernmentProfile | null>(null);
  const [filerId, setFilerId] = useState("house_nancy_pelosi");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("current");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("3Y");
  const [tradeQuery, setTradeQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  const profileFocusRequested = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([repository.loadMeta(), repository.loadIndex(), repository.loadRecent(), repository.loadLeaderboard()])
      .then(([nextMeta, nextFilers, nextRecent, nextLeaderboard]) => {
        if (!active) return;
        setMeta(nextMeta); setFilers(nextFilers); setRecent(nextRecent); setLeaderboard(nextLeaderboard);
      })
      .catch(() => { if (active) setSnapshotFailed(true); });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository.loadProfile(filerId)
      .then((payload) => { if (active) { setProfile(payload); setProfileFailed(false); } })
      .catch(() => { if (active) setProfileFailed(true); });
    return () => { active = false; };
  }, [filerId, repository]);

  useEffect(() => {
    if (!profile || !profileFocusRequested.current) return;
    profileFocusRequested.current = false;
    requestAnimationFrame(() => document.querySelector(".official-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [profile]);

  const directory = useMemo(() => buildGovernmentDirectory(filers, { universe: universeFilter, branch: branchFilter, query: directoryQuery }), [branchFilter, directoryQuery, filers, universeFilter]);
  const exposureSignals = useMemo(() => buildExposureSignals(profile?.trades ?? []), [profile]);
  const effectiveTicker = selectedTicker && exposureSignals.some((signal) => signal.ticker === selectedTicker) ? selectedTicker : exposureSignals[0]?.ticker ?? null;
  const selectedExposure = exposureSignals.find((signal) => signal.ticker === effectiveTicker) ?? null;
  const filteredTrades = useMemo(() => filterGovernmentTrades(profile?.trades ?? [], { action: actionFilter, time: timeFilter, query: tradeQuery }), [actionFilter, profile, timeFilter, tradeQuery]);
  const globalActivity = useMemo(() => recent.slice(0, 8), [recent]);
  const official = profile ? filers.find((filer) => filer.id === profile.filer.id) ?? profile.filer : null;

  const chooseFiler = (id: string) => {
    setFilerId(id); setSelectedTicker(null); setActionFilter("all"); setTradeQuery(""); setDirectoryOpen(false); setProfileFailed(false);
  };
  const chooseRankedFiler = (id: string) => {
    if (id === official?.id) {
      document.querySelector(".official-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    profileFocusRequested.current = true;
    chooseFiler(id);
  };

  return {
    ready: Boolean(meta && filers.length && profile && leaderboard), snapshotFailed, profileFailed,
    meta, filers, leaderboard, profile, official,
    stats: profile ? filerStats(profile) : null,
    currentCount: filers.filter((filer) => filer.active === true).length,
    lateRate: meta?.disclosureLag.tradesWithLag ? (meta.disclosureLag.lateCount / meta.disclosureLag.tradesWithLag) * 100 : 0,
    directory, exposureSignals, effectiveTicker, selectedExposure, filteredTrades, globalActivity,
    directoryQuery, universeFilter, branchFilter, directoryOpen, actionFilter, timeFilter, tradeQuery,
    setDirectoryQuery, setUniverseFilter, setBranchFilter, setDirectoryOpen, setActionFilter, setTimeFilter, setTradeQuery, setSelectedTicker,
    chooseFiler, chooseRankedFiler,
  };
}
