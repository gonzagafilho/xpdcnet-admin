"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Modal central operacional XPDCNET: overlay sobre o painel, painel branco, título forte.
 * Usar para cadastro/edição rápida (não drawer lateral).
 */
export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/45" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] max-h-[min(90vh,880px)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xp-card outline-none sm:max-w-xl",
            className,
          )}
        >
          <div className="flex flex-col gap-1.5 pr-10">
            <Dialog.Title className="text-xl font-bold tracking-tight text-slate-900">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="text-sm leading-relaxed text-slate-600">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          <div className="mt-5">{children}</div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className="absolute right-3 top-4 shrink-0" aria-label="Fechar">
              <X className="h-4 w-4 text-slate-600" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
