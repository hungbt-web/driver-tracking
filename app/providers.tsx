"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { SiteDataProvider } from "./site-data-context";

const appTheme = createTheme({
  palette: {
    mode: "light",
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <SiteDataProvider>{children}</SiteDataProvider>
    </ThemeProvider>
  );
}
