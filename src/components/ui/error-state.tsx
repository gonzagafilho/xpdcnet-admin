import { AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
  icon?: LucideIcon;
};

export function ErrorState({
  title = "Não foi possível concluir esta operação",
  description,
  retryLabel = "Tentar novamente",
  onRetry,
  className,
  icon: Icon = AlertTriangle,
}: ErrorStateProps) {
  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 ${className || ""}`} role="alert">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm">{description}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 border-red-200 bg-white text-red-800 hover:bg-red-100"
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
