"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "right" | "left";
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-900/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex h-full w-full max-w-md flex-col border-zinc-200 bg-white shadow-xl",
            side === "right" && "right-0 top-0 border-l",
            side === "left" && "left-0 top-0 border-r",
          )}
        >
          <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
            <div className="space-y-1 pr-8">
              <Dialog.Title className="text-base font-semibold text-zinc-900">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-zinc-500">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Fechar">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
