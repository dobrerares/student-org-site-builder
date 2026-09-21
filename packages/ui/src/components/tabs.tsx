/** @jsxImportSource react */
/**
 * Tabs — shadcn-shaped composition over Base UI's Tabs.
 *
 * The editor's narrow-viewport layout ("Edit" / "Preview") and the Site
 * Health panel both want real tab semantics: roving focus, `aria-selected`,
 * arrow-key travel. Base UI provides all three; the builder supplies the
 * chrome.
 */
import { Tabs as BaseTabs } from "@base-ui-components/react/tabs";
import { forwardRef } from "react";

import { cn } from "../lib/cn.js";

export const TabsRoot = BaseTabs.Root;

export type TabsListProps = React.ComponentPropsWithoutRef<typeof BaseTabs.List>;

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { className, ...rest },
  ref,
) {
  return (
    <BaseTabs.List
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "inline-flex items-center gap-1 rounded-(--radius-sosb-md) bg-secondary p-1",
        className,
      )}
      {...rest}
    />
  );
});

export type TabsTabProps = React.ComponentPropsWithoutRef<typeof BaseTabs.Tab>;

export const TabsTab = forwardRef<HTMLButtonElement, TabsTabProps>(function TabsTab(
  { className, ...rest },
  ref,
) {
  return (
    <BaseTabs.Tab
      ref={ref}
      data-sosb-ui=""
      className={cn(
        "rounded-(--radius-sosb-sm) px-3 py-1.5 text-sm font-medium text-muted-foreground data-[selected]:bg-card data-[selected]:text-foreground data-[selected]:shadow-sm",
        className,
      )}
      {...rest}
    />
  );
});

export type TabsPanelProps = React.ComponentPropsWithoutRef<typeof BaseTabs.Panel>;

export const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(function TabsPanel(
  { className, ...rest },
  ref,
) {
  return <BaseTabs.Panel ref={ref} data-sosb-ui="" className={cn(className)} {...rest} />;
});

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
};
