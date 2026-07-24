"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  align = "end",
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        avoidCollisions
        className={cn(
          "z-50 min-w-[148px] overflow-hidden rounded-[12px_14px_13px_11px]",
          "border-[1.5px] border-stroke-doodle/40 bg-surface shadow-[var(--paper-shadow)]",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  danger,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  danger?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex w-full cursor-default items-center gap-2 px-3 py-2 text-left text-sm outline-none select-none",
        "transition-colors hover:bg-sticky-ink focus:bg-sticky-ink",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    />
  );
}
