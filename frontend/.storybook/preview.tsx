import type { Preview, ReactRenderer } from "@storybook/react-vite";
import type { DecoratorFunction } from "storybook/internal/types";
import { useEffect } from "react";
import { ThemeProvider } from "../src/ThemeContext";
import "../src/style.css";
import "../src/i18n";

/**
 * html.dark クラスを付与するデコレータ。
 * globals.theme === "dark" のとき dark クラスを付与する。
 */
const WithThemeClass: DecoratorFunction<ReactRenderer> = (Story, context) => {
  const isDark = context.globals.theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isDark]);

  return (
    <ThemeProvider>
      <Story />
    </ThemeProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
  globalTypes: {
    theme: {
      description: "テーマ切替",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [WithThemeClass],
};

export default preview;
