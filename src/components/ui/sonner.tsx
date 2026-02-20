import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-solid";
import type { Component, ComponentProps, JSX } from "solid-js";
import { Toaster as Sonner } from "solid-sonner";

type ToasterProps = Omit<ComponentProps<typeof Sonner>, "theme"> & {
  theme: "light" | "dark";
};

const Toaster: Component<ToasterProps> = (props) => {
  const { theme, ...rest } = props;

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
      theme={theme}
      {...rest}
    />
  );
};

export { Toaster };
