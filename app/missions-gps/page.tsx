"use client";

import { useMemo, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  Backdrop,
  Box,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import VirtualizedSelect from "../components/VirtualizedSelect";
import { useSiteData } from "../site-data-context";

const mapContainerStyle = {
  width: "100%",
  height: "70vh",
};

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

export default function MissionsGpsPage() {
  const { allGps, allEtapes, allAccounts, isApiSettled } = useSiteData();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const accountMissionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of allEtapes) {
      if (
        typeof row.accountid !== "number" ||
        typeof row.missionid !== "number"
      ) {
        continue;
      }
      const accountId = String(row.accountid);
      const missionId = String(row.missionid);
      if (!map.has(accountId)) {
        map.set(accountId, new Set<string>());
      }
      map.get(accountId)?.add(missionId);
    }
    return map;
  }, [allEtapes]);

  const missionIdsWithPosition = useMemo(() => {
    const ids = new Set<string>();
    for (const row of allGps) {
      if (typeof row.missionid === "number") {
        ids.add(String(row.missionid));
      }
    }
    return ids;
  }, [allGps]);

  const accountOptions = useMemo(() => {
    const accountNameById = new Map<string, string>();
    for (const account of allAccounts) {
      const id = String(account.id);
      const fullName = `${normalizeText(account.prenom)} ${normalizeText(
        account.nom
      )}`.trim();
      const fallbackIdentity =
        normalizeText(account.email) ||
        normalizeText(account.username) ||
        normalizeText(account.nconducteur) ||
        "";
      const displayName = fullName || fallbackIdentity;
      if (displayName) {
        accountNameById.set(id, displayName);
      }
    }

    return Array.from(accountMissionMap.keys())
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => {
        const missionIds = accountMissionMap.get(id) ?? new Set<string>();
        const hasPosition = Array.from(missionIds).some((missionId) =>
          missionIdsWithPosition.has(missionId)
        );
        return {
          value: id,
          label: accountNameById.has(id)
            ? `${id} - ${accountNameById.get(id)}`
            : id,
          isError: !hasPosition,
        };
      });
  }, [accountMissionMap, allAccounts, missionIdsWithPosition]);

  const effectiveAccountId =
    selectedAccountId || accountOptions[0]?.value || "";

  const missionOptions = useMemo(() => {
    const ids = new Set<string>();
    if (effectiveAccountId) {
      const missionIds = accountMissionMap.get(effectiveAccountId);
      if (missionIds) {
        for (const missionId of missionIds) {
          ids.add(missionId);
        }
      }
    } else {
      for (const row of allGps) {
        if (typeof row.missionid === "number") {
          ids.add(String(row.missionid));
        }
      }
    }
    return Array.from(ids)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => ({
        value: id,
        label: id,
        isError: !missionIdsWithPosition.has(id),
      }));
  }, [accountMissionMap, allGps, effectiveAccountId, missionIdsWithPosition]);

  const effectiveMissionId = missionOptions.some(
    (option) => option.value === selectedMissionId
  )
    ? selectedMissionId
    : "";

  const missionPositions = useMemo(() => {
    if (!effectiveMissionId) return [];
    const missionId = Number(effectiveMissionId);
    return allGps
      .filter((row) => row.missionid === missionId)
      .filter(
        (
          row
        ): row is typeof row & {
          latitude: number;
          longitude: number;
          id: number;
        } => {
          return (
            typeof row.latitude === "number" &&
            typeof row.longitude === "number" &&
            typeof row.id === "number"
          );
        }
      );
  }, [allGps, effectiveMissionId]);

  const mapCenter = useMemo(() => {
    if (missionPositions.length === 0) {
      return { lat: 48.8566, lng: 2.3522 };
    }
    return {
      lat: missionPositions[0].latitude,
      lng: missionPositions[0].longitude,
    };
  }, [missionPositions]);

  const path = useMemo(
    () =>
      missionPositions.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
      })),
    [missionPositions]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#ffffff", py: 4 }}>
      <Backdrop
        open={!isApiSettled}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: "#fff" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <CircularProgress color="inherit" size={24} />
          <Typography variant="body2">Loading data...</Typography>
        </Stack>
      </Backdrop>
      <Container maxWidth="xl">
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#333333" }}>
            Missions GPS
          </Typography>
          <Typography variant="body2" sx={{ color: "#333333" }}>
            Select a mission ID to display all GPS points from `position.json`.
          </Typography>

          <VirtualizedSelect
            label="Driver ID"
            options={accountOptions.filter(({ isError }) => !isError)}
            value={effectiveAccountId}
            onChange={setSelectedAccountId}
            width={280}
          />

          <VirtualizedSelect
            label="Mission ID"
            options={missionOptions}
            value={effectiveMissionId}
            onChange={setSelectedMissionId}
            width={280}
          />

          {!isLoaded && !loadError && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading Google Maps...</Typography>
            </Stack>
          )}

          {loadError && (
            <Paper sx={{ p: 2 }}>
              <Typography color="error">
                Failed to load Google Maps. Check your API key and billing
                setup.
              </Typography>
            </Paper>
          )}

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              {isLoaded && (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={8}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {missionPositions.map((point) => (
                    <MarkerF
                      key={point.id}
                      position={{ lat: point.latitude, lng: point.longitude }}
                      title={`ID ${point.id} - ${point.date ?? ""}`}
                    />
                  ))}
                  {path.length > 1 && (
                    <PolylineF
                      path={path}
                      options={{
                        strokeColor: "#1976d2",
                        strokeOpacity: 0.9,
                        strokeWeight: 3,
                      }}
                    />
                  )}
                </GoogleMap>
              )}
            </Box>

            <Paper
              sx={{
                p: 2,
                width: { xs: "100%", lg: 420 },
                flexShrink: 0,
                height: "70vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                Coordinates ({missionPositions.length})
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <List dense>
                  {missionPositions.map((point) => (
                    <ListItem key={point.id} divider>
                      <ListItemText
                        primary={`#${point.id} | lat: ${point.latitude}, lng: ${point.longitude}`}
                        secondary={point.date ?? "No timestamp"}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Paper>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
