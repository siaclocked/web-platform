import type { SupabaseClient } from "@supabase/supabase-js";

type SolverWorker = {
  id: string;
  name: string;
  skill_ids: string[];
  place_ids: string[];
  skill_ratings: Record<string, number>;
  start_date: string | null;
  status: string | null;
  can_open: boolean;
  can_close: boolean;
  monthly_min_hours: number | null;
  monthly_optimal_hours: number | null;
};

type SolverExistingAssignment = {
  worker_id: string;
  skill_id: string;
  day: number;
  start_minutes: number;
  end_minutes: number;
  is_locked: boolean;
};

type SolverRequest = {
  place_id: string;
  start_date: string;
  end_date: string;
  workers: SolverWorker[];
  skill_constraints: Array<{
    skill_id: string;
    enforce_min_team_rating: boolean;
    min_avg_rating: number | null;
  }>;
  coverage_windows: Array<{
    id: string;
    skill_id: string;
    day: number;
    start_minutes: number;
    end_minutes: number;
    min_workers: number;
  }>;
  existing_assignments: SolverExistingAssignment[];
  unavailability: Array<{
    worker_id: string;
    day: number;
    start_minutes?: number;
    end_minutes?: number;
    is_full_day: boolean;
  }>;
  worker_month_context: Array<{
    worker_id: string;
    month_start: string;
    worked_hours: number;
    scheduled_hours_outside_interval: number;
  }>;
  settings: {
    max_hours_per_day: number;
    min_shift_minutes: number;
    max_shift_minutes: number;
    min_hours_per_block: number;
    max_hours_per_block: number;
    min_rest_between_shifts: number;
    granularity_minutes: number;
  };
  minimize_changes: boolean;
  balance_hours: boolean;
};

type TemplateRow = {
  id: string;
  company_id: string;
  place_id: string;
  start_date: string;
  end_date: string;
  solver_result?: {
    assignments?: Array<{
      worker_id: string;
      skill_id: string;
      day: number;
      start_minutes: number;
      end_minutes: number;
      is_locked?: boolean;
    }>;
    manual_locked_assignments?: SolverExistingAssignment[];
  } | null;
  places?: {
    settings?: Record<string, number | null>;
  } | null;
};

type ShiftTemplateRow = {
  id: string;
  date: string;
  day_type: string;
  shifts: Array<{ startTime: string; endTime: string; position: string; workers?: number }> | null;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function firstMonthStart(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastMonthEnd(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function monthStartKey(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(1);
  return formatDateOnly(date);
}

function dayOffset(startDate: string, currentDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const current = new Date(`${currentDate}T00:00:00`);
  return Math.round((current.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function assignmentDate(startDate: string, day: number) {
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + day);
  return formatDateOnly(date);
}

function normalizedLockedAssignments(solverResult: TemplateRow["solver_result"]): SolverExistingAssignment[] {
  const assignments = Array.isArray(solverResult?.assignments) ? solverResult.assignments : [];
  const manualLockedKeys = new Set<string>(
    (solverResult?.manual_locked_assignments || []).map((assignment: SolverExistingAssignment) =>
      [
        assignment.worker_id,
        assignment.day,
        assignment.skill_id,
        assignment.start_minutes,
        assignment.end_minutes,
      ].join(":"),
    ),
  );

  return assignments.map((assignment) => ({
    worker_id: assignment.worker_id,
    skill_id: assignment.skill_id,
    day: assignment.day,
    start_minutes: assignment.start_minutes,
    end_minutes: assignment.end_minutes,
    is_locked:
      assignment.is_locked === true ||
      manualLockedKeys.has(
        [
          assignment.worker_id,
          assignment.day,
          assignment.skill_id,
          assignment.start_minutes,
          assignment.end_minutes,
        ].join(":"),
      ),
  }));
}

export async function buildSolverRequest(params: {
  supabase: SupabaseClient;
  template: TemplateRow;
  shiftTemplates: ShiftTemplateRow[];
  existingAssignmentsOverride?: SolverExistingAssignment[];
  minimizeChanges?: boolean;
  balanceHours?: boolean;
}): Promise<SolverRequest> {
  const {
    supabase,
    template,
    shiftTemplates,
    existingAssignmentsOverride,
    minimizeChanges = true,
    balanceHours = true,
  } = params;

  const workerPlacesResult = await supabase
    .from("worker_places")
    .select(
      `
        worker_id,
        users:worker_id (
          id,
          first_name,
          last_name,
          start_date,
          status,
          can_open,
          can_close,
          monthly_min_hours,
          monthly_optimal_hours
        )
      `,
    )
    .eq("place_id", template.place_id)
    .eq("is_active", true);

  if (workerPlacesResult.error) {
    throw new Error(`Failed to fetch workers: ${workerPlacesResult.error.message}`);
  }

  const workerIds = (workerPlacesResult.data || []).map((row) => row.worker_id);
  const workerSkillsResult = workerIds.length
    ? await supabase.from("worker_skills").select("worker_id, skill_id, rating").in("worker_id", workerIds)
    : { data: [], error: null };
  if (workerSkillsResult.error) {
    throw new Error(`Failed to fetch worker skills: ${workerSkillsResult.error.message}`);
  }

  const availabilityResult = workerIds.length
    ? await supabase
        .from("worker_availability")
        .select("*")
        .in("worker_id", workerIds)
        .gte("date", template.start_date)
        .lte("date", template.end_date)
    : { data: [], error: null };
  if (availabilityResult.error) {
    throw new Error(`Failed to fetch worker availability: ${availabilityResult.error.message}`);
  }

  const workersMap: Record<string, SolverWorker> = {};
  (workerPlacesResult.data || []).forEach((row) => {
    const userData = row.users as {
      first_name?: string;
      last_name?: string;
      start_date?: string | null;
      status?: string | null;
      can_open?: boolean;
      can_close?: boolean;
      monthly_min_hours?: number | null;
      monthly_optimal_hours?: number | null;
    } | null;
    workersMap[row.worker_id] = {
      id: row.worker_id,
      name: `${userData?.first_name || ""} ${userData?.last_name || ""}`.trim() || "Unknown",
      skill_ids: [],
      place_ids: [template.place_id],
      skill_ratings: {},
      start_date: userData?.start_date || null,
      status: userData?.status || "ACTIVE",
      can_open: userData?.can_open ?? true,
      can_close: userData?.can_close ?? true,
      monthly_min_hours: userData?.monthly_min_hours ?? null,
      monthly_optimal_hours: userData?.monthly_optimal_hours ?? null,
    };
  });

  (workerSkillsResult.data || []).forEach((row) => {
    const worker = workersMap[row.worker_id];
    if (!worker) return;
    worker.skill_ids.push(row.skill_id);
    worker.skill_ratings[row.skill_id] = row.rating || 3;
  });

  const workerAvailabilityMap: Record<
    string,
    Record<string, { type: string; start_time?: string; end_time?: string }>
  > = {};
  (availabilityResult.data || []).forEach((entry: {
    worker_id: string;
    date: string;
    availability_type: string;
    start_time?: string | null;
    end_time?: string | null;
  }) => {
    if (!workerAvailabilityMap[entry.worker_id]) {
      workerAvailabilityMap[entry.worker_id] = {};
    }
    workerAvailabilityMap[entry.worker_id][entry.date] = {
      type: entry.availability_type,
      start_time: entry.start_time,
      end_time: entry.end_time,
    };
  });

  const coverageWindows: SolverRequest["coverage_windows"] = [];
  shiftTemplates.forEach((row) => {
    if (row.day_type !== "work" || !Array.isArray(row.shifts)) {
      return;
    }
    const offset = dayOffset(template.start_date, row.date);
    row.shifts.forEach((shift, index) => {
      coverageWindows.push({
        id: `${row.id}-${index}`,
        skill_id: shift.position,
        day: offset,
        start_minutes: toMinutes(shift.startTime),
        end_minutes: toMinutes(shift.endTime),
        min_workers: shift.workers || 1,
      });
    });
  });

  const skillIdsInCoverage = [...new Set(coverageWindows.map((window) => window.skill_id))];
  const placeSkillConfigsResult =
    skillIdsInCoverage.length > 0
      ? await supabase
          .from("place_skill_configs")
          .select("skill_id, enforce_min_team_rating, min_avg_rating")
          .eq("place_id", template.place_id)
          .in("skill_id", skillIdsInCoverage)
      : { data: [], error: null };
  if (
    placeSkillConfigsResult.error &&
    !placeSkillConfigsResult.error.message?.includes("does not exist") &&
    placeSkillConfigsResult.error.code !== "42P01"
  ) {
    throw new Error(`Failed to fetch place skill configs: ${placeSkillConfigsResult.error.message}`);
  }

  const skillConstraints = ((placeSkillConfigsResult.data || []) as Array<{
    skill_id: string;
    enforce_min_team_rating: boolean | null;
    min_avg_rating: number | null;
  }>).map((row) => ({
    skill_id: row.skill_id,
    enforce_min_team_rating: row.enforce_min_team_rating ?? false,
    min_avg_rating: row.min_avg_rating ?? null,
  }));

  const unavailability: SolverRequest["unavailability"] = [];
  Object.keys(workersMap).forEach((workerId) => {
    const availabilityByDate = workerAvailabilityMap[workerId] || {};
    shiftTemplates.forEach((row) => {
      if (row.day_type !== "work") return;
      const offset = dayOffset(template.start_date, row.date);
      const availabilityEntry = availabilityByDate[row.date];
      if (!availabilityEntry || availabilityEntry.type === "unavailable" || availabilityEntry.type === "vacation") {
        unavailability.push({
          worker_id: workerId,
          day: offset,
          is_full_day: true,
        });
        return;
      }
      if (
        availabilityEntry.type === "available_range" &&
        availabilityEntry.start_time &&
        availabilityEntry.end_time
      ) {
        const availableStart = toMinutes(availabilityEntry.start_time);
        const availableEnd = toMinutes(availabilityEntry.end_time);
        if (availableStart > 0) {
          unavailability.push({
            worker_id: workerId,
            day: offset,
            start_minutes: 0,
            end_minutes: availableStart,
            is_full_day: false,
          });
        }
        if (availableEnd < 1440) {
          unavailability.push({
            worker_id: workerId,
            day: offset,
            start_minutes: availableEnd,
            end_minutes: 1440,
            is_full_day: false,
          });
        }
      }
    });
  });

  const existingAssignments =
    existingAssignmentsOverride ??
    normalizedLockedAssignments(template.solver_result || {});

  const monthWindowStart = formatDateOnly(firstMonthStart(template.start_date));
  const monthWindowEnd = formatDateOnly(lastMonthEnd(template.end_date));

  const workSessionsResult = workerIds.length
    ? await supabase
        .from("work_sessions")
        .select("worker_id, start_time, end_time")
        .in("worker_id", workerIds)
        .gte("start_time", `${monthWindowStart}T00:00:00`)
        .lte("start_time", `${monthWindowEnd}T23:59:59`)
        .not("end_time", "is", null)
    : { data: [], error: null };
  if (workSessionsResult.error) {
    throw new Error(`Failed to fetch work sessions: ${workSessionsResult.error.message}`);
  }

  const workedHoursByMonth: Record<string, number> = {};
  const workedDates = new Set<string>();
  (workSessionsResult.data || []).forEach((session: {
    worker_id: string;
    start_time: string;
    end_time: string;
  }) => {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
    const dateKey = formatDateOnly(start);
    const key = `${session.worker_id}:${monthStartKey(dateKey)}`;
    workedHoursByMonth[key] = (workedHoursByMonth[key] || 0) + hours;
    workedDates.add(`${session.worker_id}:${dateKey}`);
  });

  const publishedTemplatesResult = workerIds.length
    ? await supabase
        .from("schedule_templates")
        .select("id, start_date, end_date, status, solver_result")
        .eq("company_id", template.company_id)
        .in("status", ["schedule_published", "published"])
        .lte("start_date", monthWindowEnd)
        .gte("end_date", monthWindowStart)
    : { data: [], error: null };
  if (publishedTemplatesResult.error) {
    throw new Error(`Failed to fetch published schedules: ${publishedTemplatesResult.error.message}`);
  }

  const scheduledHoursOutsideIntervalByMonth: Record<string, number> = {};
  (publishedTemplatesResult.data || []).forEach((publishedTemplate: {
    id: string;
    start_date: string;
    solver_result?: {
      assignments?: Array<{
        worker_id: string;
        day: number;
        start_minutes: number;
        end_minutes: number;
      }>;
    } | null;
  }) => {
    if (publishedTemplate.id === template.id) return;
    const assignments = Array.isArray(publishedTemplate.solver_result?.assignments)
      ? publishedTemplate.solver_result.assignments
      : [];
    assignments.forEach((assignment) => {
      if (!workerIds.includes(assignment.worker_id)) return;
      const dateKey = assignmentDate(publishedTemplate.start_date, assignment.day);
      if (dateKey >= template.start_date && dateKey <= template.end_date) return;
      if (workedDates.has(`${assignment.worker_id}:${dateKey}`)) return;
      const key = `${assignment.worker_id}:${monthStartKey(dateKey)}`;
      scheduledHoursOutsideIntervalByMonth[key] =
        (scheduledHoursOutsideIntervalByMonth[key] || 0) +
        (assignment.end_minutes - assignment.start_minutes) / 60;
    });
  });

  const monthKeys = new Set<string>();
  let pointer = firstMonthStart(template.start_date);
  const lastMonth = firstMonthStart(template.end_date);
  while (pointer <= lastMonth) {
    monthKeys.add(formatDateOnly(pointer));
    pointer = new Date(pointer.getFullYear(), pointer.getMonth() + 1, 1);
  }

  const workerMonthContext: SolverRequest["worker_month_context"] = [];
  workerIds.forEach((workerId) => {
    monthKeys.forEach((monthKey) => {
      workerMonthContext.push({
        worker_id: workerId,
        month_start: monthKey,
        worked_hours: workedHoursByMonth[`${workerId}:${monthKey}`] || 0,
        scheduled_hours_outside_interval: scheduledHoursOutsideIntervalByMonth[`${workerId}:${monthKey}`] || 0,
      });
    });
  });

  const placeSettings = template.places?.settings || {};
  const minShiftMinutes =
    Number(placeSettings.min_shift_minutes) ||
    Number(placeSettings.min_hours_per_block || 2) * 60;
  const maxShiftMinutes =
    Number(placeSettings.max_shift_minutes) ||
    Number(placeSettings.max_hours_per_block || 10) * 60;

  return {
    place_id: template.place_id,
    start_date: template.start_date,
    end_date: template.end_date,
    workers: Object.values(workersMap),
    skill_constraints: skillConstraints,
    coverage_windows: coverageWindows,
    existing_assignments: existingAssignments,
    unavailability,
    worker_month_context: workerMonthContext,
    settings: {
      max_hours_per_day: Number(placeSettings.max_hours_per_day) || 12,
      min_shift_minutes: minShiftMinutes,
      max_shift_minutes: maxShiftMinutes,
      min_hours_per_block: minShiftMinutes / 60,
      max_hours_per_block: maxShiftMinutes / 60,
      min_rest_between_shifts: Number(placeSettings.min_rest_between_shifts) || 8,
      granularity_minutes: Number(placeSettings.schedule_granularity_minutes) || 15,
    },
    minimize_changes: minimizeChanges,
    balance_hours: balanceHours,
  };
}
