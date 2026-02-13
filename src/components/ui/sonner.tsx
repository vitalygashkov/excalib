import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-solid";
import type { Component, ComponentProps, JSX } from "solid-js";
import { Toaster as Sonner } from "solid-sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster: Component<ToasterProps> = (props) => {
  const currentTheme =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

  return (
    <Sonner
      class="toaster group"
      icons={{
        success: <CircleCheck class="size-4" />,
        info: <Info class="size-4" />,
        warning: <TriangleAlert class="size-4" />,
        error: <OctagonX class="size-4" />,
        loading: <LoaderCircle class="size-4 animate-spin" />,
      }}
      position="top-center"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as JSX.CSSProperties
      }
      theme={currentTheme}
      {...props}
    />
  );
};

export { Toaster };
