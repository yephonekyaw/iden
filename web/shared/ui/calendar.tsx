import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { DayPicker, type DateRange, type DayPickerProps } from "react-day-picker";
import { Button } from "./button";
import { cn } from "./cn";

/**
 * A span of days to filter by. One click picks a single day; a second click
 * extends it into a range. The highlighted span is what says which days are
 * included — a lone date on a button would leave the reader guessing whether it
 * means that day, or that day onwards.
 */
export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder,
  className,
  ...calendar
}: {
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  label: string;
  placeholder?: string;
  className?: string;
} & Pick<DayPickerProps, "disabled" | "startMonth" | "endMonth">) {
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          aria-label={label}
          className={cn("h-control justify-start px-3.5 font-normal", className)}
        >
          <CalendarDays aria-hidden="true" className="text-muted-soft" />
          <span className={value?.from ? "text-ink" : "text-muted-soft"}>
            {describe(value) ?? placeholder}
          </span>
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className={cn(
            "z-50 rounded-lg border border-border bg-background p-3",
            "shadow-[0_1px_3px_rgba(20,20,19,0.08)] data-[state=open]:step-in",
          )}
        >
          <Calendar
            mode="range"
            autoFocus
            selected={value}
            defaultMonth={value?.from}
            onSelect={onChange}
            {...calendar}
          />
          {value?.from ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

const DAY = { dateStyle: "medium" } as const;

function describe(range: DateRange | undefined): string | null {
  if (!range?.from) return null;
  const from = range.from.toLocaleDateString(undefined, DAY);
  if (!range.to || range.to.getTime() === range.from.getTime()) return from;
  return `${from} – ${range.to.toLocaleDateString(undefined, DAY)}`;
}

const END_CAP = "bg-surface-soft [&_button]:bg-primary [&_button]:text-on-primary";

/**
 * react-day-picker wearing this system's tokens rather than its own stylesheet.
 * Every element it renders is named here, because `style.css` is not imported —
 * an unstyled element would otherwise fall back to bare browser table markup.
 *
 * Range mode only, which is why `selected` carries no fill of its own: in a
 * range every day in the span is selected, and the three range_* modifiers are
 * what distinguish an end cap from the days between.
 */
function Calendar({ className, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("text-body-sm text-body", className)}
      classNames={{
        months: "relative",
        month: "flex flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: NAV_BUTTON,
        button_next: NAV_BUTTON,
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-title-sm text-ink",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-caption font-normal text-muted-soft",
        week: "flex w-full",
        day: "h-9 w-9 p-0",
        day_button: cn(
          "h-9 w-9 rounded-md text-body-sm text-body",
          "hover:bg-surface-soft hover:text-ink disabled:pointer-events-none",
        ),
        today:
          "[&:not([data-selected])_button]:font-medium [&:not([data-selected])_button]:text-primary",
        range_start: cn("rounded-l-md", END_CAP),
        range_end: cn("rounded-r-md", END_CAP),
        range_middle: "bg-surface-soft [&_button]:text-ink",
        outside: "[&_button]:text-muted-soft",
        disabled: "[&_button]:text-muted-soft [&_button]:opacity-50",
        hidden: "invisible",
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) => (
          <CalendarChevron orientation={orientation} className={chevronClass} />
        ),
      }}
      {...props}
    />
  );
}

const NAV_BUTTON = cn(
  "inline-flex h-8 w-8 items-center justify-center rounded-md",
  "text-muted-foreground hover:bg-surface-soft hover:text-ink disabled:text-muted-soft disabled:opacity-40",
);

function CalendarChevron({
  orientation,
  className,
}: {
  orientation?: "up" | "down" | "left" | "right";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <path d={orientation === "right" ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
    </svg>
  );
}
