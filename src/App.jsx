import React, { useState, useRef, useEffect, useCallback } from "react";

const timeSlots = Array.from({ length: 18 }, (_, i) => `${(i + 5).toString().padStart(2, '0')}:00`);
const SLOT_HEIGHT = 60; // px per hour slot
const AUTO_DELETE_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper to format a date to YYYY-MM-DD string for local storage keys
const formatDateToYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Scheduler() {
  // tasks: Array of { id, text, isCompleted, completedAt (timestamp) }
  const [tasks, setTasks] = useState(() => {
    try {
      const storedTasks = localStorage.getItem('scheduler_tasks');
      return storedTasks ? JSON.parse(storedTasks) : [];
    } catch (error) {
      console.error("Failed to parse stored tasks:", error);
      return [];
    }
  });

  // schedule: Object where keys are YYYY-MM-DD strings and values are { time: { taskId, duration } }
  const [allSchedules, setAllSchedules] = useState(() => {
    try {
      const storedAllSchedules = localStorage.getItem('scheduler_all_schedules');
      return storedAllSchedules ? JSON.parse(storedAllSchedules) : {};
    } catch (error) {
      console.error("Failed to parse stored schedules:", error);
      return {};
    }
  });

  const [draggedTask, setDraggedTask] = useState(null);
  const resizingRef = useRef(null);
  const [newTaskText, setNewTaskText] = useState("");
  const rightPanelRef = useRef(null);
  const leftPanelRef = useRef(null);

  // State for the date displayed in the header, initialized with local computer's date
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const storedDate = localStorage.getItem('scheduler_current_date');
      // If a date was stored, use it. Otherwise, use the current local date.
      return storedDate ? new Date(storedDate) : new Date();
    } catch (error) {
      console.error("Failed to parse stored current date:", error);
      return new Date(); // Fallback to current date on error
    }
  });

  // Derived state: schedule for the currently selected date
  const currentDayKey = formatDateToYYYYMMDD(currentDate);
  const scheduleForCurrentDate = allSchedules[currentDayKey] || {};


  const findTimeIndex = (time) => timeSlots.indexOf(time);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('scheduler_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('scheduler_all_schedules', JSON.stringify(allSchedules));
  }, [allSchedules]);

  useEffect(() => {
    localStorage.setItem('scheduler_current_date', currentDate.toISOString());
  }, [currentDate]);
  // --- End Persistence Effects ---

  // --- Auto-delete completed tasks after delay ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTasks(prevTasks => {
        // Filter out tasks that are completed and have passed the auto-delete delay
        return prevTasks.filter(task =>
          !(task.isCompleted && task.completedAt && (now - task.completedAt > AUTO_DELETE_DELAY))
        );
      });
    }, 1000 * 30); // Check every 30 seconds

    return () => clearInterval(interval); // Clean up interval on component unmount
  }, []);
  // --- End Auto-delete ---


  const handleTaskDragStart = (taskId, e) => {
    setDraggedTask(taskId);
    e.dataTransfer.setData("text/plain", "");
  };

  const placeTask = useCallback((startTime, taskId, duration) => {
    setAllSchedules((prevAllSchedules) => {
      const newAllSchedules = { ...prevAllSchedules };
      const currentDaySchedule = { ...(newAllSchedules[currentDayKey] || {}) };

      const startIndex = findTimeIndex(startTime);

      // Clear existing instances of this task for the current day
      for (const key in currentDaySchedule) {
        if (currentDaySchedule[key]?.taskId === taskId) {
          delete currentDaySchedule[key];
        }
      }

      // Push tasks down if needed (within the current day's schedule)
      const pushTasksDown = (scheduleMap, startIndex, duration) => {
        for (let i = startIndex; i < startIndex + duration; i++) {
          const time = timeSlots[i];
          if (scheduleMap[time]) {
            const { taskId: existingTaskId, duration: taskDur } = scheduleMap[time];
            const nextIndex = i + duration;
            delete scheduleMap[time];
            if (timeSlots[nextIndex]) { // Ensure the next slot exists
              pushTasksDown(scheduleMap, nextIndex, taskDur);
              scheduleMap[timeSlots[nextIndex]] = { taskId: existingTaskId, duration: taskDur };
            }
          }
        }
      };

      pushTasksDown(currentDaySchedule, startIndex, duration);
      currentDaySchedule[startTime] = { taskId, duration };

      newAllSchedules[currentDayKey] = currentDaySchedule;
      return newAllSchedules;
    });
  }, [currentDayKey]); // Depend on currentDayKey

  const handleDrop = (time, e) => {
    e.preventDefault();
    if (!draggedTask) return;
    const task = tasks.find(t => t.id === draggedTask);
    if (task && task.isCompleted) {
      // Prevent dragging completed tasks into the schedule
      setDraggedTask(null);
      return;
    }
    placeTask(time, draggedTask, 1);
    setDraggedTask(null);
  };

  const handleDragOver = (e) => e.preventDefault();

  const removeTask = useCallback((startTime) => {
    setAllSchedules((prevAllSchedules) => {
      const newAllSchedules = { ...prevAllSchedules };
      const currentDaySchedule = { ...(newAllSchedules[currentDayKey] || {}) };
      delete currentDaySchedule[startTime];
      newAllSchedules[currentDayKey] = currentDaySchedule;
      return newAllSchedules;
    });
  }, [currentDayKey]); // Depend on currentDayKey

  const handleMouseDown = useCallback((startTime, e) => {
    e.stopPropagation();
    if (!scheduleForCurrentDate[startTime]) return;
    resizingRef.current = {
      startTime,
      startY: e.clientY,
      startDuration: scheduleForCurrentDate[startTime].duration,
    };
  }, [scheduleForCurrentDate]);


  const handleMouseMove = useCallback((e) => {
    if (!resizingRef.current) return;
    const { startTime, startY, startDuration } = resizingRef.current;
    const dy = e.clientY - startY;
    let newDuration = Math.max(1, Math.round(startDuration + dy / SLOT_HEIGHT));
    const startIndex = findTimeIndex(startTime);
    newDuration = Math.min(newDuration, timeSlots.length - startIndex);

    setAllSchedules((prevAllSchedules) => {
      const newAllSchedules = { ...prevAllSchedules };
      const currentDaySchedule = { ...(newAllSchedules[currentDayKey] || {}) };

      // Before updating duration, ensure no overlap is created
      let canResize = true;
      for (let i = startIndex; i < startIndex + newDuration; i++) {
        const time = timeSlots[i];
        if (currentDaySchedule[time] && time !== startTime) {
          // If a different task is in the way
          canResize = false;
          break;
        }
      }

      if (canResize) {
        // Only update if duration actually changes
        if (currentDaySchedule[startTime]?.duration !== newDuration) {
          const existingTask = currentDaySchedule[startTime];
          // Temporarily remove to avoid self-overlap check during iteration
          delete currentDaySchedule[startTime];
          // Check for conflicts after removal but before re-adding
          for (let i = startIndex; i < startIndex + newDuration; i++) {
            const time = timeSlots[i];
            if (currentDaySchedule[time]) { // If any other task is occupying the space
                canResize = false;
                break;
            }
          }

          if (canResize) {
              currentDaySchedule[startTime] = { taskId: existingTask.taskId, duration: newDuration };
          } else {
              // If conflict, revert to previous state
              currentDaySchedule[startTime] = existingTask;
          }
        }
      }

      newAllSchedules[currentDayKey] = currentDaySchedule;
      return newAllSchedules;
    });
  }, [currentDayKey]);


  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Sync scroll between time slots and scheduling area
  useEffect(() => {
    const rightPanel = rightPanelRef.current;
    const leftPanel = leftPanelRef.current;

    const handleScroll = () => {
      if (rightPanel && leftPanel) {
        leftPanel.scrollTop = rightPanel.scrollTop;
      }
    };

    if (rightPanel) {
      rightPanel.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (rightPanel) {
        rightPanel.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const addTask = () => {
    if (newTaskText.trim()) {
      // Initialize new tasks as not completed, and no completedAt timestamp yet
      setTasks([...tasks, { id: Date.now().toString(), text: newTaskText.trim(), isCompleted: false, completedAt: null }]);
      setNewTaskText("");
    }
  };

  // Handler for 'Enter' key press in the input field
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      addTask();
    }
  };

  const formatHeaderDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const navigateDate = (direction) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setDate(prevDate.getDate() + direction);
      return newDate;
    });
  };

  const handleCheckboxChange = (taskId, startTime) => {
    // 1. Mark task as completed in the tasks state and add a timestamp
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, isCompleted: true, completedAt: Date.now() } : task
      )
    );

    // 2. Remove the task from the schedule state (right panel)
    removeTask(startTime);
  };

  // New function to uncomplete a task from the left panel
  const handleUnstrikeTask = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, isCompleted: false, completedAt: null } : task
      )
    );
  };

  // Filter tasks for display: exclude tasks that are completed and past their auto-delete time
  const visibleTasks = tasks.filter(task =>
    !(task.isCompleted && task.completedAt && (Date.now() - task.completedAt > AUTO_DELETE_DELAY))
  );

  // Sort tasks: uncompleted first, then completed at the bottom
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1; // a is completed, b is not -> a comes after b
    if (!a.isCompleted && b.isCompleted) return -1; // a is not completed, b is -> a comes before b
    return 0; // maintain original order otherwise
  });


  return (
    <div className="flex bg-[#06090F] text-[#EBF1F7] min-h-screen font-sans p-6 gap-8">
      {/* Left: Task List */}
      <div className="w-1/4 bg-[#0a0d14] rounded-lg p-4 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-center">Task List</h2>
        <div className="mb-6 flex">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={handleKeyDown} // Add keydown handler
            className="flex-1 p-2 rounded-l-md bg-[#252831] text-[#EBF1F7] placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C76B9D]"
            placeholder="New Task"
          />
          <button
            onClick={addTask}
            className="bg-[#C76B9D] text-white px-4 py-2 rounded-r-md hover:bg-[#a95780] transition-colors"
          >
            →
          </button>
        </div>
        <div className="space-y-4"> {/* Increased spacing */}
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              draggable={!task.isCompleted} // Make non-completed tasks draggable
              onDragStart={(e) => handleTaskDragStart(task.id, e)}
              className={`group flex items-center justify-between cursor-grab select-none rounded-lg bg-[#252831] px-4 py-3 text-white shadow-md transition-all duration-200
                ${task.isCompleted ? 'opacity-50 line-through italic cursor-not-allowed' : 'active:cursor-grabbing hover:shadow-lg'}`}
            >
              <div className="flex items-center gap-2">
                {/* Three dots drag handle */}
                <div className="flex flex-col gap-0.5 text-gray-500">
                  <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                  <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                  <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                </div>
                <span>{task.text}</span>
              </div>
              {task.isCompleted && ( // Show unstrike option only if completed
                <button
                  onClick={() => handleUnstrikeTask(task.id)}
                  className="text-xs text-[#C76B9D] hover:text-[#a95780] opacity-100 group-hover:opacity-100 transition-opacity ml-2"
                  title="Mark as incomplete"
                >
                  Unstrike
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Schedule */}
      <div className="flex-1 bg-[#0a0d14] rounded-lg shadow-lg flex flex-col overflow-hidden">
        {/* Date Header */}
        <div className="flex items-center justify-center py-4 px-6 border-b border-[#252831] mb-2">
          <button
            onClick={() => navigateDate(-1)}
            className="p-2 text-xl text-[#C76B9D] hover:text-[#a95780]"
          >
            &lt;
          </button>
          <span className="flex-1 text-center text-lg font-semibold tracking-wide">
            {formatHeaderDate(currentDate)}
          </span>
          <button
            onClick={() => navigateDate(1)}
            className="p-2 text-xl text-[#C76B9D] hover:text-[#a95780]"
          >
            &gt;
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Time slots column */}
          <div
            ref={leftPanelRef}
            className="w-20 border-r border-[#252831] overflow-y-scroll scrollbar-hide"
            style={{ height: 'calc(80vh - 70px)' }} // Adjusted height to account for header
          >
            {timeSlots.map((time) => (
              <div
                key={time}
                style={{ height: SLOT_HEIGHT }}
                className="flex items-center justify-center text-xs border-b border-[#252831] select-none text-gray-400"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Scheduling area */}
          <div
            ref={rightPanelRef}
            className="flex-1 relative overflow-y-scroll scrollbar-hide"
            style={{ height: 'calc(80vh - 70px)' }} // Adjusted height to account for header
          >
            {/* Empty slots for dropping */}
            {timeSlots.map((time, idx) => {
              let isCovered = false;
              for (const start in scheduleForCurrentDate) {
                const startIdx = findTimeIndex(start);
                const dur = scheduleForCurrentDate[start].duration;
                if (idx >= startIdx && idx < startIdx + dur) {
                  isCovered = true;
                  break;
                }
              }
              if (!isCovered) {
                return (
                  <div
                    key={time}
                    onDrop={(e) => handleDrop(time, e)}
                    onDragOver={handleDragOver}
                    style={{
                      height: SLOT_HEIGHT,
                      borderBottom: "1px dashed #252831",
                      position: 'absolute',
                      top: idx * SLOT_HEIGHT,
                      left: 0,
                      right: 0
                    }}
                    className="hover:bg-[#1f2937]/50"
                  />
                );
              }
              return null;
            })}

            {/* Scheduled tasks */}
            {Object.entries(scheduleForCurrentDate).map(([startTime, { taskId, duration }]) => {
              const task = tasks.find((t) => t.id === taskId);
              // Only render scheduled tasks that are NOT completed (or not found)
              if (!task || task.isCompleted) return null;
              const top = findTimeIndex(startTime) * SLOT_HEIGHT;
              const height = duration * SLOT_HEIGHT - 4; // Minus 4 for padding/border look

              return (
                <div
                  key={taskId + startTime}
                  className="absolute left-2 right-2 rounded-md bg-[#2B2735] shadow-lg cursor-pointer select-none p-3 box-border group"
                  style={{ top, height }}
                  onMouseDown={(e) => e.preventDefault()} // Prevent text selection
                >
                  <div className="flex justify-between items-start h-full"> {/* Use items-start for checkbox alignment */}
                    <div className="flex items-center gap-2 text-white text-sm font-medium">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-[#C76B9D] rounded focus:ring-[#C76B9D] bg-gray-700 border-gray-600"
                        checked={task.isCompleted} // Checkbox reflects task status
                        onChange={() => handleCheckboxChange(taskId, startTime)}
                      />
                      <span>{task.text}</span>
                    </div>
                    <button
                      className="text-xs bg-[#C76B9D]/80 hover:bg-[#C76B9D] text-white px-2 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeTask(startTime)}
                      title="Remove task from schedule"
                    >
                      Remove
                    </button>
                  </div>
                  <div
                    onMouseDown={(e) => handleMouseDown(startTime, e)}
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize rounded-b-md bg-[#C76B9D] hover:h-4 transition-all"
                    title="Drag to resize task duration"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}