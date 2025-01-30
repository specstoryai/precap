import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { CalendarEvent } from './Calendar';

interface CalendarGridProps {
  events: CalendarEvent[];
  selectedDate: Date;
  selectedWeek: Date | null;
  onDateSelect: (date: Date) => void;
  onWeekSelect: (startDate: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  events,
  selectedDate,
  selectedWeek,
  onDateSelect,
  onWeekSelect,
}) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [selectedDate]);

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start.dateTime);
      return isSameDay(eventDate, date);
    });
  };

  const getDayClassNames = (date: Date) => {
    const baseClasses = "relative min-h-[120px] p-2 transition-all duration-200 ease-in-out";
    const isCurrentMonth = format(date, 'M') === format(selectedDate, 'M');
    const isSelectedDay = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);
    const isInSelectedWeek = selectedWeek && isSameWeek(date, selectedWeek);
    const hasEvents = getEventsForDay(date).length > 0;

    let classes = baseClasses;

    // Base background and text colors
    if (!isCurrentMonth) {
      classes += ' bg-gray-50/50 dark:bg-gray-800/50 text-gray-400';
    } else {
      classes += ' bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    }

    // Hover state
    classes += ' hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer';

    // Selected states
    if (isSelectedDay) {
      classes += ' bg-blue-50 dark:bg-blue-900/30 shadow-sm';
    }
    if (isInSelectedWeek) {
      classes += ' ring-1 ring-blue-200 dark:ring-blue-500/30';
    }

    // Current day highlight
    if (isCurrentDay) {
      classes += ' font-semibold';
    }

    // Events indicator
    if (hasEvents) {
      classes += ' shadow-sm';
    }

    return classes;
  };

  const handleDayClick = (date: Date, e: React.MouseEvent) => {
    if (e.shiftKey) {
      onWeekSelect(date);
    } else {
      onDateSelect(date);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm">
      <div className="grid grid-cols-7 border dark:border-gray-800 rounded-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-800"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((day, idx) => (
          <div
            key={idx}
            className={getDayClassNames(day)}
            onClick={(e) => handleDayClick(day, e)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm ${isToday(day) ? 'bg-blue-500 text-white w-6 h-6 flex items-center justify-center rounded-full' : ''}`}>
                {format(day, 'd')}
              </span>
              {getEventsForDay(day).length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200 font-medium">
                  {getEventsForDay(day).length}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {getEventsForDay(day).slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="text-xs px-1.5 py-1 rounded-md bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-200 truncate hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/30 dark:hover:to-blue-700/30 transition-colors cursor-pointer"
                  title={event.summary}
                >
                  {format(new Date(event.start.dateTime), 'HH:mm')} {event.summary}
                </div>
              ))}
              {getEventsForDay(day).length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pl-1.5">
                  +{getEventsForDay(day).length - 3} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 text-sm text-gray-500 dark:text-gray-400 border-t dark:border-gray-800">
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        Hold Shift + Click to select entire week
      </div>
    </div>
  );
}; 