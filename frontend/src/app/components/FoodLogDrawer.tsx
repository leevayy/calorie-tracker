import type { ComponentProps } from "react";
import { Drawer } from "vaul";

type FoodLogDrawerRootProps = ComponentProps<typeof Drawer.Root>;

/** Drawer defaults shared by the food-entry sheet. */
export function FoodLogDrawerRoot(props: FoodLogDrawerRootProps) {
  return <Drawer.Root {...props} repositionInputs />;
}
