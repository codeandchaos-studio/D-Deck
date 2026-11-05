import type { TaskPriority, ProtocolType } from '../types';

export interface DetectedToken {
  type: 'date' | 'time' | 'priority' | 'category' | 'routine' | 'focus';
  raw: string;
  label: string;
}

export interface ParsedTaskInput {
  cleanTitle: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority?: TaskPriority;
  category?: string;
  isRoutine?: boolean;
  protocolType?: ProtocolType;
  isFocusToday?: boolean;
  detectedTokens: DetectedToken[];
}

const MONTH_NAMES: { [key: string]: number } = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAY_NAMES: { [key: string]: number } = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseNaturalLanguageInput(rawInput: string): ParsedTaskInput {
  let text = rawInput;
  const detectedTokens: DetectedToken[] = [];
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let priority: TaskPriority | undefined;
  let category: string | undefined;
  let isRoutine: boolean | undefined;
  let protocolType: ProtocolType | undefined;
  let isFocusToday: boolean | undefined;

  const now = new Date();

  // 1. Focus Flag: *focus, !focus, today focus
  const focusRegex = /(?:^|\s)(\*focus|!focus|\bstar\b|\bfocus\b)(?:\s|$)/i;
  const focusMatch = text.match(focusRegex);
  if (focusMatch) {
    isFocusToday = true;
    detectedTokens.push({
      type: 'focus',
      raw: focusMatch[1],
      label: '★ Today Focus',
    });
    text = text.replace(focusMatch[0], ' ');
  }

  // 2. Priority: p1, p2, p3, p4, !urgent, !high, !med, !low
  const priorityRegex = /(?:^|\s)(p[1-4]|!urgent|!high|!med|!medium|!low)(?:\s|$)/i;
  const prioMatch = text.match(priorityRegex);
  if (prioMatch) {
    const raw = prioMatch[1].toLowerCase();
    if (raw === 'p1' || raw === '!urgent') priority = 'urgent';
    else if (raw === 'p2' || raw === '!high') priority = 'high';
    else if (raw === 'p3' || raw === '!med' || raw === '!medium') priority = 'medium';
    else if (raw === 'p4' || raw === '!low') priority = 'low';

    if (priority) {
      detectedTokens.push({
        type: 'priority',
        raw: prioMatch[1],
        label: priority === 'urgent' ? '⚡ P1 Urgent' : priority === 'high' ? '🔥 P2 High' : priority === 'medium' ? '⚡ P3 Med' : 'P4 Low',
      });
      text = text.replace(prioMatch[0], ' ');
    }
  }

  // 3. Category: #career, #personal, #code, #daily, #health
  const categoryRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)(?:\s|$)/i;
  const catMatch = text.match(categoryRegex);
  if (catMatch) {
    category = catMatch[1];
    detectedTokens.push({
      type: 'category',
      raw: catMatch[0].trim(),
      label: `#${category}`,
    });
    text = text.replace(catMatch[0], ' ');
  }

  // 4. Routine / Protocol: every day, daily, weekly, every week
  const routineRegex = /(?:^|\s)\b(every\s+day|daily|routine|every\s+week|weekly)\b(?:\s|$)/i;
  const routineMatch = text.match(routineRegex);
  if (routineMatch) {
    const raw = routineMatch[1].toLowerCase();
    isRoutine = true;
    if (raw.includes('week')) {
      protocolType = 'weekly';
      detectedTokens.push({ type: 'routine', raw: routineMatch[1], label: 'Weekly Protocol' });
    } else {
      protocolType = 'daily';
      detectedTokens.push({ type: 'routine', raw: routineMatch[1], label: 'Daily Protocol' });
    }
    text = text.replace(routineMatch[0], ' ');
  }

  // 5. Relative Times: in 15m, in 30m, in 1h, in 2h
  const relativeTimeRegex = /(?:^|\s)\bin\s+(\d+)\s*(m|min|mins|h|hr|hours?)\b(?:\s|$)/i;
  const relTimeMatch = text.match(relativeTimeRegex);
  if (relTimeMatch) {
    const amount = parseInt(relTimeMatch[1], 10);
    const unit = relTimeMatch[2].toLowerCase();
    const futureDate = new Date(now.getTime() + (unit.startsWith('h') ? amount * 60 : amount) * 60 * 1000);
    const hh = String(futureDate.getHours()).padStart(2, '0');
    const mm = String(futureDate.getMinutes()).padStart(2, '0');
    dueTime = `${hh}:${mm}`;
    dueDate = formatDate(futureDate);
    detectedTokens.push({
      type: 'time',
      raw: relTimeMatch[0].trim(),
      label: `⏰ In ${amount}${unit.startsWith('h') ? 'h' : 'm'} (${dueTime})`,
    });
    text = text.replace(relTimeMatch[0], ' ');
  }

  // 6. Absolute Times: at 5pm, 5:30pm, at 14:00, 11:30am
  if (!dueTime) {
    const timeRegex = /(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s|$)/i;
    // We only match if it explicitly has am/pm or "at <time>" or ":"
    const explicitTimeRegex = /(?:^|\s)(?:at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm))(?:\s|$)/i;
    const timeMatch = text.match(explicitTimeRegex);
    if (timeMatch) {
      let hours = 0;
      let minutes = 0;
      let meridian: string | undefined;

      if (timeMatch[1] !== undefined) {
        hours = parseInt(timeMatch[1], 10);
        minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        meridian = timeMatch[3];
      } else if (timeMatch[4] !== undefined) {
        hours = parseInt(timeMatch[4], 10);
        minutes = parseInt(timeMatch[5], 10);
        meridian = timeMatch[6];
      } else if (timeMatch[7] !== undefined) {
        hours = parseInt(timeMatch[7], 10);
        meridian = timeMatch[8];
      }

      if (meridian) {
        const med = meridian.toLowerCase();
        if (med === 'pm' && hours < 12) hours += 12;
        if (med === 'am' && hours === 12) hours = 0;
      }

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        dueTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        detectedTokens.push({
          type: 'time',
          raw: timeMatch[0].trim(),
          label: `⏰ ${dueTime}`,
        });
        text = text.replace(timeMatch[0], ' ');
      }
    }
  }

  // 7. Dates: today, tomorrow, tmrw, weekdays, nov 12, etc.
  if (!dueDate) {
    // Check "today"
    const todayRegex = /(?:^|\s)\b(today|tonight)\b(?:\s|$)/i;
    const todayMatch = text.match(todayRegex);
    if (todayMatch) {
      dueDate = formatDate(now);
      if (todayMatch[1].toLowerCase() === 'tonight' && !dueTime) {
        dueTime = '20:00';
      }
      detectedTokens.push({
        type: 'date',
        raw: todayMatch[1],
        label: '📅 Today',
      });
      text = text.replace(todayMatch[0], ' ');
    }
  }

  if (!dueDate) {
    // Check "tomorrow" or "tmrw"
    const tmrwRegex = /(?:^|\s)\b(tomorrow|tmrw)\b(?:\s|$)/i;
    const tmrwMatch = text.match(tmrwRegex);
    if (tmrwMatch) {
      const tmrw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      dueDate = formatDate(tmrw);
      detectedTokens.push({
        type: 'date',
        raw: tmrwMatch[1],
        label: '📅 Tomorrow',
      });
      text = text.replace(tmrwMatch[0], ' ');
    }
  }

  if (!dueDate) {
    // Check weekdays: "next monday", "this friday", "sunday", etc.
    const weekdayRegex = /(?:^|\s)(?:on\s+|next\s+|this\s+)?\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b(?:\s|$)/i;
    const dayMatch = text.match(weekdayRegex);
    if (dayMatch) {
      const targetDay = DAY_NAMES[dayMatch[1].toLowerCase()];
      if (targetDay !== undefined) {
        const currentDay = now.getDay();
        let daysAhead = targetDay - currentDay;
        if (daysAhead <= 0) daysAhead += 7; // next occurrence
        const targetDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        dueDate = formatDate(targetDate);
        detectedTokens.push({
          type: 'date',
          raw: dayMatch[0].trim(),
          label: `📅 ${dayMatch[1]}`,
        });
        text = text.replace(dayMatch[0], ' ');
      }
    }
  }

  if (!dueDate) {
    // Check month + day: "nov 15", "15 nov", "october 2", "dec 31"
    const monthDayRegex = /(?:^|\s)\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:\s|$)/i;
    const mdMatch = text.match(monthDayRegex);
    if (mdMatch) {
      const monthIdx = MONTH_NAMES[mdMatch[1].toLowerCase()];
      const dayNum = parseInt(mdMatch[2], 10);
      if (monthIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
        let year = now.getFullYear();
        const candidate = new Date(year, monthIdx, dayNum);
        if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
          year += 1; // next year if already passed
        }
        dueDate = formatDate(new Date(year, monthIdx, dayNum));
        detectedTokens.push({
          type: 'date',
          raw: mdMatch[0].trim(),
          label: `📅 ${mdMatch[1]} ${dayNum}`,
        });
        text = text.replace(mdMatch[0], ' ');
      }
    }
  }

  const cleanTitle = text.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle,
    dueDate,
    dueTime,
    priority,
    category,
    isRoutine,
    protocolType,
    isFocusToday,
    detectedTokens,
  };
}
