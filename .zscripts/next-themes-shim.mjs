import React from "react";
export function ThemeProvider({ children }) { return React.createElement(React.Fragment, null, children); }
export function useTheme() {
  return { theme: "dark", setTheme: () => {}, resolvedTheme: "dark", themes: ["dark", "light"], systemTheme: "dark" };
}
