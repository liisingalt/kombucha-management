import { cn } from "@/lib/utils";

interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  className?: string;
}

export function ChipSelector({ options, value, onChange, multi = false, className }: ChipSelectorProps) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (optionValue: string) => {
    if (multi) {
      const arr = selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue];
      onChange(arr);
    } else {
      onChange(selected.includes(optionValue) ? "" : optionValue);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 select-none",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
