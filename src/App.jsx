import { useState, useEffect } from "react";

const LOCAL_STORAGE_KEY = "todo-app-tasks";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");

  // Load tasks from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch (e) {
      console.error("Error reading from localStorage", e);
    }
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setTasks([
      ...tasks,
      { id: Date.now(), text: input.trim(), completed: false }
    ]);
    setInput("");
  }

  function toggleTask(id) {
    setTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id) {
    setTasks(tasks => tasks.filter(task => task.id !== id));
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 rounded-lg shadow-lg bg-[#232946] text-[#eebbc3]">
      <h1 className="text-2xl font-bold mb-4 text-[#fffffe]">To-Do App</h1>
      <form onSubmit={addTask} className="flex mb-4">
        <input
          className="flex-1 rounded px-3 py-2 mr-2 bg-[#b8c1ec] text-[#232946] border border-[#eebbc3] focus:outline-none focus:ring-2 focus:ring-[#eebbc3]"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a new task"
        />
        <button
          className="px-4 py-2 rounded bg-[#eebbc3] text-[#232946] font-bold hover:bg-[#f6c177] transition"
          type="submit"
        >
          Add
        </button>
      </form>
      <ul>
        {tasks.map(task => (
          <li
            key={task.id}
            className="flex items-center mb-2 bg-[#393d63] rounded-md px-3 py-2"
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="mr-3 accent-[#eebbc3] w-5 h-5"
            />
            <span
              className={`flex-1 ${task.completed ? "line-through text-[#b8c1ec]" : "text-[#fffffe]"}`}
            >
              {task.text}
            </span>
            <button
              className="ml-3 text-[#f6c177] font-bold hover:underline"
              onClick={() => deleteTask(task.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
