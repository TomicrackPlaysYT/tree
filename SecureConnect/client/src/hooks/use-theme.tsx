import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "./use-toast";

type ThemeType = "light" | "dark" | "system";

type ThemeContextType = {
  theme: ThemeType;
  primaryColor: string;
  background: string;
  setTheme: (theme: ThemeType) => void;
  setPrimaryColor: (color: string) => void;
  setBackground: (background: string) => void;
  saveSettings: () => Promise<void>;
};

const defaultTheme: ThemeType = "light";
const defaultPrimaryColor = "#4A7DFF";
const defaultBackground = "default";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [theme, setThemeState] = useState<ThemeType>(defaultTheme);
  const [primaryColor, setPrimaryColorState] = useState<string>(defaultPrimaryColor);
  const [background, setBackgroundState] = useState<string>(defaultBackground);
  const [loaded, setLoaded] = useState(false);

  // Load theme from user settings when user is loaded
  useEffect(() => {
    if (user?.settings && !loaded) {
      setThemeState(user.settings.theme || defaultTheme);
      setPrimaryColorState(user.settings.primaryColor || defaultPrimaryColor);
      setBackgroundState(user.settings.background || defaultBackground);
      setLoaded(true);
    }
  }, [user, loaded]);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    const resolvedTheme = 
      theme === "system" 
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Set primary color CSS variables
    const hsl = hexToHSL(primaryColor);
    if (hsl) {
      document.documentElement.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%');
    }
    
  }, [theme, primaryColor]);

  // Save settings to server
  const saveSettings = async () => {
    if (!user) return;
    
    try {
      await apiRequest("PATCH", "/api/user/settings", {
        settings: {
          theme,
          primaryColor,
          background,
          notificationsEnabled: user.settings?.notificationsEnabled ?? true
        }
      });
      
      // Update local cache
      queryClient.setQueryData(["/api/user"], (oldData: any) => ({
        ...oldData,
        settings: {
          ...oldData.settings,
          theme,
          primaryColor,
          background,
        }
      }));
      
      toast({
        title: "Settings saved",
        description: "Your theme preferences have been updated."
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "Failed to save your theme preferences.",
        variant: "destructive"
      });
    }
  };

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
  };

  const setBackground = (newBackground: string) => {
    setBackgroundState(newBackground);
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      primaryColor,
      background,
      setTheme,
      setPrimaryColor,
      setBackground,
      saveSettings
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Helper function to convert hex color to HSL
function hexToHSL(hex: string) {
  // Remove the # if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else {
    return null;
  }
  
  // Find min and max
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h = Math.round(h * 60);
  }
  
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return { h, s, l };
}
