import type { LucideIcon } from "lucide-react";
import { Button, type ButtonState } from "./Button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  state?: ButtonState;
  disabled?: boolean;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-32 text-center">
      <Icon className="h-9 w-9 text-t4" aria-hidden="true" />
      <div className="grid max-w-md gap-2">
        <h2 className="font-display text-xl text-t1">{title}</h2>
        <p className="font-body text-sm text-t2">{description}</p>
      </div>
      {action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={action.onClick}
          {...(action.state ? { state: action.state } : {})}
          {...(action.disabled !== undefined ? { disabled: action.disabled } : {})}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
