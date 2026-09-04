export const recurrenceOptions = ["none", "daily", "weekly", "monthly"] as const;

export type Recurrence = (typeof recurrenceOptions)[number];

export const isRecurrence = (value: unknown): value is Recurrence =>
  typeof value === "string" && recurrenceOptions.includes(value as Recurrence);

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const isCalendarDate = (value: string) => {
  if (!dateOnlyPattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const isReminderTime = (value: string) => timePattern.test(value);

export const getNextRecurringDueDate = (
  dueDate: string,
  recurrence: Exclude<Recurrence, "none">
) => {
  const [year, month, day] = dueDate.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("A recurring task needs a valid due date");
  }

  if (recurrence === "daily" || recurrence === "weekly") {
    const nextDate = new Date(
      Date.UTC(year, month - 1, day + (recurrence === "daily" ? 1 : 7))
    );
    return formatDateOnly(nextDate);
  }

  const nextMonth = new Date(Date.UTC(year, month, 1));
  // Day 0 of the month after it is the next month's final calendar day.
  const finalDayOfNextMonth = new Date(
    Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return formatDateParts(
    nextMonth.getUTCFullYear(),
    nextMonth.getUTCMonth() + 1,
    Math.min(day, finalDayOfNextMonth)
  );
};

const formatDateOnly = (date: Date) =>
  formatDateParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );

const formatDateParts = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
