import { useState } from 'react';
import { COLUMNS, useStore, actions, canEdit, canMoveTo, today } from './store';
import './App.css';

const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const Ava = ({ name }) => <span className="ava" title={name}>{initials(name)}</span>;
const roleName = (r) => (r === 'teacher' ? 'преподаватель' : 'студент');

/* ---------------------------------------------------------------- вход */
function Login({ s }) {
  const [name, setName] = useState('');
  return (
    <div className="app narrow">
      <section className="panel hero">
        <small className="eyebrow">УЧЕБНАЯ ДОСКА</small>
        <h1>Прогресс группы</h1>
        <p className="muted">Выберите профиль или создайте свой</p>
      </section>
      <section className="panel">
        <h2 className="sect">профили</h2>
        <div className="chips">
          {s.users.map((u) => (
            <button key={u.id} className="chip" onClick={() => actions.login(u.id)}>
              <Ava name={u.name} /> {u.name} <em>{roleName(u.role)}</em>
            </button>
          ))}
        </div>
      </section>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); if (name.trim()) actions.register(name); }}>
        <h2 className="sect">новый студент</h2>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя и фамилия" />
          <button className="cta" type="submit">Войти</button>
        </div>
      </form>
      <button className="link" onClick={() => window.confirm('Удалить все данные и вернуть демо-доску?') && actions.reset()}>
        Сбросить демо-данные
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- карточка задачи */
function TaskModal({ task, me, users, onClose }) {
  const students = users.filter((u) => u.role === 'student');
  const [f, setF] = useState({
    id: task.id, title: task.title ?? '', desc: task.desc ?? '', due: task.due ?? '',
    assignee: task.assignee ?? (me.role === 'student' ? me.id : students[0]?.id ?? ''),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    actions.saveTask({ ...f, title: f.title.trim(), ...(f.id ? {} : { author: me.id }) });
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{f.id ? 'Карточка' : 'Новая карточка'}</h2>
        <label>Название<input autoFocus value={f.title} onChange={set('title')} placeholder="Что нужно сделать" /></label>
        <label>Описание<textarea rows="3" value={f.desc} onChange={set('desc')} placeholder="Детали, ссылки, критерии" /></label>
        <div className="two">
          <label>Исполнитель
            <select value={f.assignee} onChange={set('assignee')} disabled={me.role === 'student'}>
              {students.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>Срок<input type="date" value={f.due} onChange={set('due')} /></label>
        </div>
        <div className="row end">
          {f.id && canEdit(me, task) && (
            <button type="button" className="reset danger" onClick={() => { actions.removeTask(f.id); onClose(); }}>Удалить</button>
          )}
          <button type="button" className="reset" onClick={onClose}>Отмена</button>
          <button type="submit" className="cta">Сохранить</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- дейлик */
function DailyModal({ me, tasks, existing, onClose, flash }) {
  const [f, setF] = useState({
    id: existing?.id, date: existing?.date ?? today(), done: existing?.done ?? '',
    plan: existing?.plan ?? '', blockers: existing?.blockers ?? '', task: existing?.task ?? '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = (sent) => {
    if (!f.done.trim() && !f.plan.trim()) return flash('Напишите, что сделали или что планируете');
    actions.saveDaily({ ...f, author: me.id, sent });
    flash(sent ? 'Дейлик отправлен на общую доску ✓' : 'Черновик сохранён');
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Дейлик</h2>
        <label>Что сделал(а)<textarea autoFocus rows="3" value={f.done} onChange={set('done')} placeholder="Над чем работали, что получилось" /></label>
        <label>Что планирую<textarea rows="2" value={f.plan} onChange={set('plan')} placeholder="Следующие шаги" /></label>
        <label>Что мешает<textarea rows="2" value={f.blockers} onChange={set('blockers')} placeholder="Если всё хорошо — оставьте пустым" /></label>
        <div className="two">
          <label>Связанная карточка
            <select value={f.task} onChange={set('task')}>
              <option value="">Без карточки</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label>Дата<input type="date" value={f.date} onChange={set('date')} /></label>
        </div>
        <div className="row end">
          <button type="button" className="reset" onClick={onClose}>Отмена</button>
          <button type="button" className="reset" onClick={() => save(false)}>Сохранить черновик</button>
          <button type="button" className="cta" onClick={() => save(true)}>Отправить на доску</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- лента дейликов */
function Feed({ s, me, byId, onEdit }) {
  const visible = s.dailies.filter((d) => d.sent || d.author === me.id);
  const dates = [...new Set(visible.map((d) => d.date))].sort().reverse();
  const silent = s.users.filter((u) => u.role === 'student' && !s.dailies.some((d) => d.author === u.id && d.date === today() && d.sent));
  return (
    <>
      {silent.length > 0 && (
        <section className="panel note">
          <b>Сегодня ещё не отправили дейлик:</b> {silent.map((u) => u.name).join(', ')}
        </section>
      )}
      {!dates.length && <section className="panel"><p className="empty">Пока нет дейликов. Напишите первый!</p></section>}
      {dates.map((date) => (
        <section className="panel" key={date}>
          <h2 className="sect">{date === today() ? 'сегодня' : fmt(date)}</h2>
          <div className="list">
            {visible.filter((d) => d.date === date).map((d) => {
              const author = byId[d.author];
              const task = s.tasks.find((t) => t.id === d.task);
              return (
                <article className="daily" key={d.id}>
                  <div className="who"><Ava name={author?.name ?? '?'} /> <b>{author?.name ?? 'Неизвестный'}</b>
                    {!d.sent && <span className="badge">черновик</span>}
                    {task && <span className="tag">📌 {task.title}</span>}
                  </div>
                  {d.done && <p><span className="lbl">Сделал(а)</span>{d.done}</p>}
                  {d.plan && <p><span className="lbl">Планирую</span>{d.plan}</p>}
                  {d.blockers && <p className="warn"><span className="lbl">Мешает</span>{d.blockers}</p>}
                  <div className="row end">
                    {!d.sent && d.author === me.id && <button className="act" onClick={() => actions.saveDaily({ id: d.id, sent: true })}>Отправить</button>}
                    {d.author === me.id && <button className="reset" onClick={() => onEdit(d)}>Изменить</button>}
                    {(d.author === me.id || me.role === 'teacher') && (
                      <button className="reset danger" onClick={() => window.confirm('Удалить дейлик?') && actions.removeDaily(d.id)}>Удалить</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- главный экран */
function Main({ s, me }) {
  const [tab, setTab] = useState('board');
  const [mine, setMine] = useState(false);
  const [task, setTask] = useState(null);       // карточка в окне (или {} для новой)
  const [daily, setDaily] = useState(null);     // дейлик в окне (или {} для нового)
  const [over, setOver] = useState('');
  const [toast, setToast] = useState('');

  const byId = Object.fromEntries(s.users.map((u) => [u.id, u]));
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };
  const count = (st) => s.tasks.filter((t) => t.status === st).length;
  const pct = s.tasks.length ? Math.round((count('done') / s.tasks.length) * 100) : 0;
  const myTasks = s.tasks.filter((t) => t.assignee === me.id);

  const move = (t, to) => {
    if (!canMoveTo(me, t, to)) {
      return flash(me.role === 'student' && canEdit(me, t) ? 'В «Готово» карточку переводит преподаватель после проверки' : 'Это не ваша карточка');
    }
    actions.moveTask(t.id, to);
  };
  const step = (t, d) => {
    const next = COLUMNS[COLUMNS.findIndex((c) => c.id === t.status) + d];
    if (next) move(t, next.id);
  };
  const drop = (e, col) => {
    e.preventDefault();
    setOver('');
    const t = s.tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (t && t.status !== col) move(t, col);
  };
  const openDaily = () => setDaily(s.dailies.find((d) => d.author === me.id && d.date === today() && !d.sent) ?? {});

  return (
    <div className="app">
      <header className="topbar">
        <b className="logo">Учебная доска</b>
        <div className="user"><Ava name={me.name} /> <span>{me.name}<small>{roleName(me.role)}</small></span>
          <button className="reset" onClick={actions.logout}>Выйти</button>
        </div>
      </header>

      <section className="panel hero">
        <small className="eyebrow">ПРОГРЕСС ГРУППЫ</small>
        <h1>{pct}% выполнено</h1>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div>
        <div className="stats">
          <div className="stat"><span>В РАБОТЕ</span><b>{count('doing')}</b></div>
          <div className="stat"><span>НА ПРОВЕРКЕ</span><b>{count('review')}</b></div>
          <div className="stat good"><span>ГОТОВО</span><b>{count('done')}</b></div>
        </div>
        <button className="cta" onClick={openDaily}>✍️ Написать дейлик</button>
      </section>

      <div className="bar-row">
        <div className="seg">
          <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>Доска</button>
          <button className={tab === 'daily' ? 'on' : ''} onClick={() => setTab('daily')}>Дейлики</button>
        </div>
        {tab === 'board' && (
          <div className="seg">
            <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Все</button>
            <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Мои</button>
          </div>
        )}
      </div>

      {tab === 'board' ? (
        <div className="board">
          {COLUMNS.map((col) => {
            const cards = s.tasks.filter((t) => t.status === col.id && (!mine || t.assignee === me.id));
            return (
              <section
                key={col.id}
                className={`col ${over === col.id ? 'over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
                onDragLeave={() => setOver('')}
                onDrop={(e) => drop(e, col.id)}
              >
                <header><h3>{col.title}</h3><span>{cards.length}</span></header>
                {cards.map((t) => {
                  const a = byId[t.assignee];
                  const late = t.due && t.status !== 'done' && t.due < today();
                  return (
                    <article key={t.id} className="card" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }}>
                      <b>{t.title}</b>
                      {t.desc && <p>{t.desc}</p>}
                      <footer>
                        <span className="who">{a && <Ava name={a.name} />}{a?.name ?? 'Не назначено'}</span>
                        {t.due && <span className={`due ${late ? 'late' : ''}`}>{fmt(t.due)}</span>}
                      </footer>
                      <div className="mv">
                        <button aria-label="Назад" disabled={col.id === 'todo'} onClick={() => step(t, -1)}>‹</button>
                        <button aria-label="Вперёд" disabled={col.id === 'done'} onClick={() => step(t, 1)}>›</button>
                        {canEdit(me, t) && <button aria-label="Изменить" onClick={() => setTask(t)}>✎</button>}
                      </div>
                    </article>
                  );
                })}
                {!cards.length && <p className="empty">Пусто</p>}
                {col.id === 'todo' && <button className="add" onClick={() => setTask({})}>+ Карточка</button>}
              </section>
            );
          })}
        </div>
      ) : (
        <Feed s={s} me={me} byId={byId} onEdit={setDaily} />
      )}

      {task && <TaskModal task={task} me={me} users={s.users} onClose={() => setTask(null)} />}
      {daily && <DailyModal me={me} tasks={me.role === 'teacher' ? s.tasks : myTasks} existing={daily.id ? daily : null} onClose={() => setDaily(null)} flash={flash} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default function App() {
  const s = useStore();
  const me = s.users.find((u) => u.id === s.me);
  return me ? <Main s={s} me={me} /> : <Login s={s} />;
}
