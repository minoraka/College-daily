// Хранилище данных. Сейчас всё лежит в localStorage браузера.
// Когда появится сервер (например, Django REST), заменяются только функции в `actions`,
// а интерфейс (App.jsx) остаётся прежним.
import { useSyncExternalStore } from 'react';

const KEY = 'student-board-v1';

export const COLUMNS = [
  { id: 'todo', title: 'К выполнению' },
  { id: 'doing', title: 'В работе' },
  { id: 'review', title: 'На проверке' },
  { id: 'done', title: 'Готово' },
];

const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function seed() {
  const users = [
    { id: 'teacher', name: 'Преподаватель', role: 'teacher' },
    { id: 'aidana', name: 'Айдана Ж.', role: 'student' },
    { id: 'bekzat', name: 'Бекзат К.', role: 'student' },
    { id: 'nurs', name: 'Нурсултан А.', role: 'student' },
  ];
  const t = (title, status, assignee, desc = '', due = '') => ({ id: uid(), title, desc, status, assignee, author: 'teacher', due });
  return {
    me: null,
    users,
    tasks: [
      t('Макет страницы входа', 'done', 'aidana', 'Figma, десктоп и мобильная версия'),
      t('Вёрстка карточки товара', 'review', 'bekzat', 'Адаптив, без фреймворков', daysAgo(-2)),
      t('REST API для заявок', 'doing', 'nurs', 'Модели, сериализаторы, тесты', daysAgo(-4)),
      t('Подключить React к API', 'doing', 'aidana', '', daysAgo(-5)),
      t('Написать README проекта', 'todo', 'bekzat'),
      t('Настроить Docker', 'todo', 'nurs', 'docker compose up должен запускать всё'),
    ],
    dailies: [
      { id: uid(), author: 'aidana', date: daysAgo(1), done: 'Закончила макет входа, выложила в Figma.', plan: 'Начну подключать форму к API.', blockers: '', task: '', sent: true },
      { id: uid(), author: 'nurs', date: daysAgo(1), done: 'Сделал модели Ticket и Room.', plan: 'Сериализаторы и тесты.', blockers: 'Не понял, как лучше хранить статусы.', task: '', sent: true },
    ],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённые данные — начинаем заново */ }
  return seed();
}

let state = load();
const listeners = new Set();

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* хранилище недоступно */ }
  listeners.forEach((l) => l());
}

// Синхронизация между вкладками одного браузера
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { state = load(); listeners.forEach((l) => l()); }
});

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useStore = () => useSyncExternalStore(subscribe, () => state);

// ---- правила доступа ----
// Преподаватель может всё. Студент правит свои карточки (где он исполнитель или автор),
// но в «Готово» их переводит только преподаватель — после проверки.
export const canEdit = (user, task) => user.role === 'teacher' || task.assignee === user.id || task.author === user.id;
export const canMoveTo = (user, task, to) =>
  user.role === 'teacher' || (canEdit(user, task) && task.status !== 'done' && to !== 'done');

// ---- действия ----
const patchTask = (id, patch) => commit({ ...state, tasks: state.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

export const actions = {
  login: (id) => commit({ ...state, me: id }),
  logout: () => commit({ ...state, me: null }),
  register(name) {
    const user = { id: uid(), name: name.trim(), role: 'student' };
    commit({ ...state, users: [...state.users, user], me: user.id });
  },
  saveTask(task) {
    if (task.id) return patchTask(task.id, task);
    commit({ ...state, tasks: [...state.tasks, { ...task, id: uid(), status: 'todo' }] });
  },
  moveTask: (id, status) => patchTask(id, { status }),
  removeTask: (id) => commit({ ...state, tasks: state.tasks.filter((x) => x.id !== id) }),
  saveDaily(daily) {
    if (daily.id) return commit({ ...state, dailies: state.dailies.map((x) => (x.id === daily.id ? { ...x, ...daily } : x)) });
    commit({ ...state, dailies: [...state.dailies, { ...daily, id: uid() }] });
  },
  removeDaily: (id) => commit({ ...state, dailies: state.dailies.filter((x) => x.id !== id) }),
  reset: () => commit(seed()),
};
