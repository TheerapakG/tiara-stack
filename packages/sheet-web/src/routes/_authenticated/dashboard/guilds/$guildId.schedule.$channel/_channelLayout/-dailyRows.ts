import { Sheet } from "sheet-apis/schema";

export const classifyDailyHourSchedules = (
  schedules: readonly Sheet.PopulatedScheduleResult[],
): "break" | "schedule" =>
  schedules.some((schedule) => schedule._tag === "PopulatedSchedule") ? "schedule" : "break";

export const getDailyHourSchedules = (
  schedules: readonly Sheet.PopulatedScheduleResult[],
): readonly Sheet.PopulatedSchedule[] =>
  schedules.filter((schedule): schedule is Sheet.PopulatedSchedule => {
    return schedule._tag === "PopulatedSchedule";
  });
